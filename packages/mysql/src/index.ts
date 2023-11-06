/**
 * @since 1.0.0
 */
import * as Chunk from "effect/Chunk"
import { Tag } from "effect/Context"
import * as Duration from "effect/Duration"
import * as Config from "effect/Config"
import type { ConfigError } from "effect/ConfigError"
import * as ConfigSecret from "effect/ConfigSecret"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import type { Scope } from "effect/Scope"
import { pipe } from "effect/Function"
import * as Stream from "effect/Stream"
import * as Client from "@sqlfx/sql/Client"
import type { Connection } from "@sqlfx/sql/Connection"
import { SqlError } from "@sqlfx/sql/Error"
import { asyncPauseResume } from "@sqlfx/sql/Stream"
import * as Statement from "@sqlfx/sql/Statement"
import * as transform from "@sqlfx/sql/Transform"
import * as Mysql from "mariadb"

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

  readonly maxConnections?: number
  readonly connectionTTL?: Duration.DurationInput

  readonly poolConfig?: Mysql.PoolConfig

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

    const transformRows = Client.defaultTransforms(
      options.transformResultNames!,
    ).array

    class ConnectionImpl implements Connection {
      constructor(private readonly conn: Mysql.PoolConnection | Mysql.Pool) {}

      private run(
        sql: string,
        values?: ReadonlyArray<any>,
        transform = true,
        rowsAsArray = false,
        method: "execute" | "query" = "execute",
      ) {
        const result = Effect.tryPromise({
          try: () => this.conn[method]({ sql, rowsAsArray }, values),
          catch: error => SqlError((error as any).message, error),
        })

        if (transform && !rowsAsArray && options.transformResultNames) {
          return Effect.map(result, transformRows)
        }

        return result
      }

      execute(statement: Statement.Statement<unknown>) {
        const [sql, params] = compiler.compile(statement)
        return this.run(sql, params)
      }
      executeWithoutTransform(statement: Statement.Statement<unknown>) {
        const [sql, params] = compiler.compile(statement)
        return this.run(sql, params, false)
      }
      executeValues(statement: Statement.Statement<unknown>) {
        const [sql, params] = compiler.compile(statement)
        return this.run(sql, params, true, true)
      }
      executeRaw(sql: string, params?: ReadonlyArray<Statement.Primitive>) {
        return this.run(sql, params, true, false, "query")
      }
      executeStream(statement: Statement.Statement<unknown>) {
        const [sql, params] = compiler.compile(statement)

        const stream =
          "queryStream" in this.conn
            ? queryStream(this.conn, sql, params)
            : pipe(
                acquireConn,
                Effect.map(conn => queryStream(conn, sql, params)),
                Stream.unwrapScoped,
              )

        return options.transformResultNames
          ? Stream.mapChunks(stream, _ =>
              Chunk.unsafeFromArray(
                transformRows(Chunk.toReadonlyArray(_) as Array<object>),
              ),
            )
          : stream
      }
    }

    const pool = options.url
      ? Mysql.createPool(ConfigSecret.value(options.url))
      : Mysql.createPool({
          ...(options.poolConfig ?? {}),
          host: options.host,
          port: options.port,
          database: options.database,
          user: options.username,
          password: options.password
            ? ConfigSecret.value(options.password)
            : undefined,
          connectionLimit: options.maxConnections,
          idleTimeout: options.connectionTTL
            ? Duration.toMillis(options.connectionTTL)
            : undefined,
        })

    yield* _(Effect.addFinalizer(() => Effect.promise(() => pool.end())))

    const poolConnection = new ConnectionImpl(pool)

    const acquireConn = Effect.acquireRelease(
      Effect.tryPromise({
        try: () => pool.getConnection(),
        catch: error => SqlError((error as any).message, error),
      }),
      conn => Effect.promise(() => conn.release()),
    )

    const transactionAcquirer = Effect.map(
      acquireConn,
      conn => new ConnectionImpl(conn),
    )

    return Object.assign(
      Client.make({
        acquirer: Effect.succeed(poolConnection),
        transactionAcquirer,
        compiler,
      }),
      { config: options },
    )
  })

/**
 * @category constructor
 * @since 1.0.0
 */
export const makeLayer: (
  config: Config.Config.Wrap<MysqlClientConfig>,
) => Layer.Layer<never, ConfigError, MysqlClient> = (
  config: Config.Config.Wrap<MysqlClientConfig>,
) =>
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

function queryStream(
  conn: Mysql.PoolConnection,
  sql: string,
  params?: ReadonlyArray<any>,
) {
  return asyncPauseResume<never, SqlError, any>(emit => {
    const query = conn.queryStream(sql, params)
    query.on("error", error => emit.fail(SqlError(error.message, error)))
    query.on("data", emit.single)
    query.on("end", () => emit.end())
    return {
      onInterrupt: Effect.sync(() => query.destroy()),
      onPause: Effect.sync(() => query.pause()),
      onResume: Effect.sync(() => query.resume()),
    }
  })
}
