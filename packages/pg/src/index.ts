/**
 * @since 1.0.0
 */
import { Tag } from "@effect/data/Context"
import type { Duration } from "@effect/data/Duration"
import { minutes } from "@effect/data/Duration"
import { pipe } from "@effect/data/Function"
import * as ConfigSecret from "@effect/io/Config/Secret"
import * as Effect from "@effect/io/Effect"
import * as Pool from "@effect/io/Pool"
import type { Scope } from "@effect/io/Scope"
import * as Client from "@sqlfx/sql/Client"
import type { Connection } from "@sqlfx/sql/Connection"
import { SqlError } from "@sqlfx/sql/Error"
import { defaultEscape, makeCompiler } from "@sqlfx/sql/Statement"
import type { PostgresError } from "postgres"
import postgres from "postgres"
import * as Config from "@effect/io/Config"
import * as Layer from "@effect/io/Layer"
import * as transform from "@sqlfx/sql/Transform"

export {
  /**
   * Column renaming helpers.
   *
   * @since 1.0.0
   */
  transform,
}

/**
 * @category model
 * @since 1.0.0
 */
export interface PgClient extends Client.Client {}

/**
 * @category tag
 * @since 1.0.0
 */
export const tag = Tag<PgClient>()

/**
 * @category constructor
 * @since 1.0.0
 */
export interface PgClientConfig {
  readonly host?: string
  readonly port?: number
  readonly path?: string
  readonly ssl?: boolean
  readonly database?: string
  readonly username?: string
  readonly password?: ConfigSecret.ConfigSecret

  readonly idleTimeout?: Duration
  readonly connectTimeout?: Duration

  readonly transformResultNames?: (str: string) => string
  readonly transformQueryNames?: (str: string) => string
}

/**
 * @category constructor
 * @since 1.0.0
 */
export const make = (
  options: PgClientConfig,
): Effect.Effect<Scope, never, PgClient> =>
  Effect.gen(function* (_) {
    const compiler = makeCompiler(
      "?",
      options.transformQueryNames
        ? _ => defaultEscape(options.transformQueryNames!(_))
        : defaultEscape,
      (placeholder, values) => [`(${placeholder})`, values],
      (columns, placeholder, values) => [
        `(${columns.join(",")}) VALUES ${values
          .map(() => `(${placeholder})`)
          .join(",")}`,
        values.flat(),
      ],
      (columns, placeholder, valueAlias, valueColumns, values) => [
        `${columns
          .map(([c, v]) => `${c} = ${v}`)
          .join(", ")} FROM (values ${values
          .map(() => `(${placeholder})`)
          .join(",")}) AS ${valueAlias}(${valueColumns.join(",")})`,
        values.flat(),
      ],
      () => ["", []],
    )

    const makeConnection = pipe(
      Effect.acquireRelease(
        Effect.sync(() =>
          postgres({
            max: 1,
            max_lifetime: 0,
            idle_timeout: options.idleTimeout
              ? Math.round(options.idleTimeout.millis / 1000)
              : undefined,
            connect_timeout: options.connectTimeout
              ? Math.round(options.connectTimeout.millis / 1000)
              : undefined,

            transform: {
              column: {
                to: options.transformResultNames,
              },
            },

            host: options.host,
            port: options.port,
            ssl: options.ssl,
            path: options.path,
            database: options.database,
            username: options.username,
            password: options.password
              ? ConfigSecret.value(options.password)
              : undefined,
          }),
        ),
        pg => Effect.promise(() => pg.end()),
      ),
      Effect.map(
        (pg): Connection => ({
          execute(statement) {
            const [sql, params] = compiler.compile(statement)
            return Effect.tryCatchPromiseInterrupt(
              () => pg.unsafe(sql, params as any),
              error => SqlError((error as PostgresError).message),
            )
          },
          executeValues(statement) {
            const [sql, params] = compiler.compile(statement)
            return Effect.tryCatchPromiseInterrupt(
              () => pg.unsafe(sql, params as any).values(),
              error => SqlError((error as PostgresError).message),
            )
          },
          executeRaw(sql, params) {
            return Effect.tryCatchPromiseInterrupt(
              () => pg.unsafe(sql, params as any),
              error => SqlError((error as PostgresError).message),
            )
          },
        }),
      ),
    )

    const pool = yield* _(Pool.makeWithTTL(makeConnection, 0, 10, minutes(60)))

    return Client.make(Effect.scoped(pool.get()), pool.get())
  })

/**
 * @category constructor
 * @since 1.0.0
 */
export const makeLayer = (config: Config.Config.Wrap<PgClientConfig>) =>
  Layer.scoped(tag, Effect.flatMap(Effect.config(Config.unwrap(config)), make))
