/**
 * @since 1.0.0
 */
import { Tag } from "@effect/data/Context"
import type { Duration } from "@effect/data/Duration"
import { minutes } from "@effect/data/Duration"
import { pipe } from "@effect/data/Function"
import * as Config from "@effect/io/Config"
import * as ConfigSecret from "@effect/io/Config/Secret"
import * as Effect from "@effect/io/Effect"
import * as Layer from "@effect/io/Layer"
import * as Pool from "@effect/io/Pool"
import type { Scope } from "@effect/io/Scope"
import * as Client from "@sqlfx/sql/Client"
import type { Connection } from "@sqlfx/sql/Connection"
import { SqlError } from "@sqlfx/sql/Error"
import { makeCompiler } from "@sqlfx/sql/Statement"
import * as transform from "@sqlfx/sql/Transform"
import * as Mysql from "mysql2"

export { transform }

/**
 * @category model
 * @since 1.0.0
 */
export interface MysqlClient extends Client.Client {
  readonly config: MysqlClientConfig
}

/**
 * @category tag
 * @since 1.0.0
 */
export const tag = Tag<MysqlClient>()

/**
 * @category constructor
 * @since 1.0.0
 */
export interface MysqlClientConfig {
  readonly host?: string
  readonly port?: number
  readonly database?: string
  readonly username?: string
  readonly password?: ConfigSecret.ConfigSecret

  readonly connectTimeout?: Duration

  readonly minConnections?: number
  readonly maxConnections?: number

  readonly transformResultNames?: (str: string) => string
  readonly transformQueryNames?: (str: string) => string
}

const escape = function escape(str: string) {
  return "`" + str.replace(/`/g, "``").replace(/\./g, "`.`") + "`"
}

/**
 * @category constructor
 * @since 1.0.0
 */
export const make = (
  options: MysqlClientConfig,
): Effect.Effect<Scope, never, MysqlClient> =>
  Effect.gen(function* (_) {
    const compiler = makeCompiler(
      _ => `?`,
      options.transformQueryNames
        ? _ => escape(options.transformQueryNames!(_))
        : escape,
      (placeholders, values) => [`(${placeholders.join(",")})`, values],
      (columns, placeholders, values) => [
        `(${columns.join(",")}) VALUES ${placeholders
          .map(_ => `(${_})`)
          .join(",")}`,
        values.flat(),
      ],
      () => ["", []],
      () => ["", []],
    )

    const makeConnection = pipe(
      Effect.acquireRelease(
        Effect.sync(() =>
          Mysql.createConnection({
            host: options.host,
            port: options.port,
            database: options.database,
            user: options.username,
            password: options.password
              ? ConfigSecret.value(options.password)
              : undefined,
            connectTimeout: options.connectTimeout?.millis,
          }),
        ),
        _ =>
          Effect.async<never, never, void>(resume =>
            _.end(() => resume(Effect.unit())),
          ),
      ),
      Effect.map((conn): Connection => {
        const run = (sql: string, params?: ReadonlyArray<any>) => {
          return Effect.async<never, SqlError, any>(resume =>
            conn.query(sql, params, (error, result) => {
              if (error) {
                resume(Effect.fail(SqlError(error.message, error)))
              } else {
                resume(Effect.succeed(result))
              }
            }),
          )
        }
        return {
          execute(statement) {
            const [sql, params] = compiler.compile(statement)
            return run(sql, params)
          },
          executeValues(statement) {
            const [sql, params] = compiler.compile(statement)
            return Effect.async<never, SqlError, any>(resume =>
              conn.query(
                {
                  sql,
                  values: params,
                  rowsAsArray: true,
                },
                (error, result) => {
                  if (error) {
                    resume(Effect.fail(SqlError(error.message, error)))
                  } else {
                    resume(Effect.succeed(result))
                  }
                },
              ),
            )
          },
          executeRaw(sql, params) {
            return run(sql, params)
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

    return Object.assign(Client.make(pool.get(), pool.get()), {
      config: options,
    })
  })

/**
 * @category constructor
 * @since 1.0.0
 */
export const makeLayer = (config: Config.Config.Wrap<MysqlClientConfig>) =>
  Layer.scoped(tag, Effect.flatMap(Effect.config(Config.unwrap(config)), make))
