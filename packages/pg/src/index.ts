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

  readonly minConnections?: number
  readonly maxConnections?: number

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
      _ => `$${_}`,
      options.transformQueryNames
        ? _ => defaultEscape(options.transformQueryNames!(_))
        : defaultEscape,
      (placeholders, values) => [`(${placeholders.join(",")})`, values],
      (columns, placeholders, values) => [
        `(${columns.join(",")}) VALUES ${placeholders
          .map(_ => `(${_})`)
          .join(",")}`,
        values.flat(),
      ],
      (placeholders, valueAlias, valueColumns, values) => [
        `(values ${placeholders
          .map(_ => `(${_})`)
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
                from: options.transformResultNames,
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
      Effect.map((pg): Connection => {
        const run = (sql: string, params?: ReadonlyArray<any>) => {
          const query = pg.unsafe<any>(sql, params as any)
          ;(query as any).options.prepare = true
          return query
        }
        return {
          execute(statement) {
            const [sql, params] = compiler.compile(statement)
            return Effect.tryCatchPromiseInterrupt(
              () => run(sql, params),
              error =>
                SqlError((error as PostgresError).message, {
                  ...(error as any).__proto__,
                }),
            )
          },
          executeValues(statement) {
            const [sql, params] = compiler.compile(statement)
            return Effect.tryCatchPromiseInterrupt(
              () => run(sql, params).values(),
              error =>
                SqlError((error as PostgresError).message, {
                  ...(error as any).__proto__,
                }),
            )
          },
          executeRaw(sql, params) {
            return Effect.tryCatchPromiseInterrupt(
              () => run(sql, params),
              error =>
                SqlError((error as PostgresError).message, {
                  ...(error as any).__proto__,
                }),
            )
          },
        }
      }),
    )

    const pool = yield* _(
      Pool.makeWithTTL(
        makeConnection,
        options.minConnections ?? 0,
        options.maxConnections ?? 10,
        minutes(60),
      ),
    )

    return Client.make(Effect.scoped(pool.get()), pool.get())
  })

/**
 * @category constructor
 * @since 1.0.0
 */
export const makeLayer = (config: Config.Config.Wrap<PgClientConfig>) =>
  Layer.scoped(tag, Effect.flatMap(Effect.config(Config.unwrap(config)), make))
