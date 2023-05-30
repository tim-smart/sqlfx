/**
 * @since 1.0.0
 */
import { Tag } from "@effect/data/Context"
import * as Debug from "@effect/data/Debug"
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
import * as Statement from "@sqlfx/sql/Statement"
import * as transform from "@sqlfx/sql/Transform"
import * as Mysql from "mysql2"

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
  /**
   * Connection URI. Setting this will override the other connection options
   */
  readonly url?: ConfigSecret.ConfigSecret

  readonly host?: string
  readonly port?: number
  readonly database?: string
  readonly username?: string
  readonly password?: ConfigSecret.ConfigSecret

  readonly connectTimeout?: Duration

  readonly minConnections?: number
  readonly maxConnections?: number
  readonly connectionTTL?: Duration

  readonly transformResultNames?: (str: string) => string
  readonly transformQueryNames?: (str: string) => string
}

const escape = Statement.defaultEscape("`")

/**
 * @category constructor
 * @since 1.0.0
 */
export const make = (
  options: MysqlClientConfig,
): Effect.Effect<Scope, never, MysqlClient> =>
  Effect.gen(function* (_) {
    const compiler = makeCompiler(options.transformQueryNames)

    const transformRows = Client.defaultRowTransform(
      options.transformResultNames!,
    )

    const makeConnection = pipe(
      Effect.acquireRelease(
        Effect.sync(() =>
          options.url
            ? Mysql.createConnection(ConfigSecret.value(options.url))
            : Mysql.createConnection({
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
        const run = (
          sql: string,
          values?: ReadonlyArray<any>,
          transform = true,
          rowsAsArray = false,
        ) =>
          Effect.async<never, SqlError, any>(resume =>
            conn.execute({ sql, values, rowsAsArray }, (error, result: any) => {
              if (error) {
                resume(
                  Debug.untraced(() =>
                    Effect.fail(SqlError(error.message, error)),
                  ),
                )
              } else if (
                transform &&
                !rowsAsArray &&
                options.transformResultNames
              ) {
                resume(
                  Debug.untraced(() => Effect.succeed(transformRows(result))),
                )
              } else {
                resume(Debug.untraced(() => Effect.succeed(result)))
              }
            }),
          )

        return {
          execute(statement) {
            const [sql, params] = compiler.compile(statement)
            return run(sql, params)
          },
          executeWithoutTransform(statement) {
            const [sql, params] = compiler.compile(statement)
            return run(sql, params, false)
          },
          executeValues(statement) {
            const [sql, params] = compiler.compile(statement)
            return run(sql, params, true, true)
          },
          executeRaw(sql, params) {
            return run(sql, params)
          },
          compile(statement) {
            return Effect.sync(() => compiler.compile(statement))
          },
        }
      }),
    )

    const pool = yield* _(
      Pool.makeWithTTL(
        makeConnection,
        options.minConnections ?? 1,
        options.maxConnections ?? 10,
        options.connectionTTL ?? minutes(45),
      ),
    )

    return Object.assign(
      Client.make({ acquirer: pool.get(), transactionAcquirer: pool.get() }),
      { config: options },
    )
  })

/**
 * @category constructor
 * @since 1.0.0
 */
export const makeLayer = (config: Config.Config.Wrap<MysqlClientConfig>) =>
  Layer.scoped(tag, Effect.flatMap(Effect.config(Config.unwrap(config)), make))

/**
 * @category constructor
 * @since 1.0.0
 */
export const makeCompiler = (transform?: (_: string) => string) =>
  Statement.makeCompiler(
    _ => `?`,
    transform ? _ => escape(transform(_)) : escape,
    () => ["", []],
    () => ["", []],
  )
