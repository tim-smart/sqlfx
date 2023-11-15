/**
 * @since 1.0.0
 */
import * as Duration from "effect/Duration"
import { identity } from "effect/Function"
import * as Cache from "effect/Cache"
import * as Config from "effect/Config"
import type { ConfigError } from "effect/ConfigError"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Pool from "effect/Pool"
import type { Scope } from "effect/Scope"
import * as Client from "@sqlfx/sql/Client"
import type { Connection } from "@sqlfx/sql/Connection"
import { SqlError } from "@sqlfx/sql/Error"
import type * as Statement from "@sqlfx/sql/Statement"
import { tag, type SqliteClient, makeCompiler } from "./Client.js"
import Sqlite from "better-sqlite3"

export {
  /**
   * @category constructor
   * @since 1.0.0
   */
  makeCompiler,
  /**
   * @category tags
   * @since 1.0.0
   */
  tag,
  /**
   * Column renaming helpers.
   *
   * @since 1.0.0
   */
  transform,
} from "./Client.js"

export type {
  /**
   * @category models
   * @since 1.0.0
   */
  SqliteClient,
} from "./Client.js"

/**
 * @category models
 * @since 1.0.0
 */
export interface SqliteNodeConfig {
  readonly filename: string
  readonly readonly?: boolean
  readonly prepareCacheSize?: number
  readonly prepareCacheTTL?: Duration.DurationInput
  readonly transformResultNames?: (str: string) => string
  readonly transformQueryNames?: (str: string) => string
}

/**
 * @category constructor
 * @since 1.0.0
 */
export const make = (
  options: SqliteNodeConfig,
): Effect.Effect<Scope, never, SqliteClient> =>
  Effect.gen(function* (_) {
    const compiler = makeCompiler(options.transformQueryNames)
    const transformRows = Client.defaultTransforms(
      options.transformResultNames!,
    ).array

    const handleError = (error: any) => SqlError(error.message, { ...error })

    const makeConnection = Effect.gen(function* (_) {
      const db = new Sqlite(options.filename, {
        readonly: options.readonly ?? false,
      })
      yield* _(Effect.addFinalizer(() => Effect.sync(() => db.close())))

      db.pragma("journal_mode = WAL")

      const prepareCache = yield* _(
        Cache.make({
          capacity: options.prepareCacheSize ?? 200,
          timeToLive: options.prepareCacheTTL ?? Duration.minutes(10),
          lookup: (sql: string) =>
            Effect.try({
              try: () => db.prepare(sql),
              catch: handleError,
            }),
        }),
      )

      const run = (
        sql: string,
        params: ReadonlyArray<Statement.Primitive> = [],
      ) =>
        Effect.flatMap(prepareCache.get(sql), _ =>
          Effect.try({
            try: () => {
              if (_.reader) {
                return _.all(...params) as ReadonlyArray<any>
              }
              _.run(...params)
              return []
            },
            catch: handleError,
          }),
        )

      const runTransform = options.transformResultNames
        ? (sql: string, params?: ReadonlyArray<Statement.Primitive>) =>
            Effect.map(run(sql, params), transformRows)
        : run

      const runValues = (
        sql: string,
        params: ReadonlyArray<Statement.Primitive>,
      ) =>
        Effect.acquireUseRelease(
          prepareCache.get(sql).pipe(Effect.map(_ => _.raw(true))),
          statement =>
            Effect.try({
              try: () => {
                if (statement.reader) {
                  return statement.all(...params) as ReadonlyArray<
                    ReadonlyArray<Statement.Primitive>
                  >
                }
                statement.run(...params)
                return []
              },
              catch: handleError,
            }),
          statement => Effect.sync(() => statement.raw(false)),
        )

      return identity<
        Connection & {
          readonly export: Effect.Effect<never, SqlError, Uint8Array>
        }
      >({
        execute(statement) {
          const [sql, params] = compiler.compile(statement)
          return runTransform(sql, params)
        },
        executeValues(statement) {
          const [sql, params] = compiler.compile(statement)
          return runValues(sql, params)
        },
        executeWithoutTransform(statement) {
          const [sql, params] = compiler.compile(statement)
          return run(sql, params)
        },
        executeRaw(sql, params) {
          return runTransform(sql, params)
        },
        executeStream(_statement) {
          return Effect.dieMessage("executeStream not implemented")
        },
        export: Effect.try({
          try: () => db.serialize(),
          catch: handleError,
        }),
      })
    })

    const pool = yield* _(Pool.make({ acquire: makeConnection, size: 1 }))

    return Object.assign(
      Client.make({
        acquirer: Effect.scoped(pool.get),
        compiler,
        transactionAcquirer: pool.get,
      }),
      {
        config: options,
        export: Effect.scoped(Effect.flatMap(pool.get, _ => _.export)),
      },
    )
  })

/**
 * @category constructor
 * @since 1.0.0
 */
export const makeLayer: (
  config: Config.Config.Wrap<SqliteNodeConfig>,
) => Layer.Layer<never, ConfigError, SqliteClient> = (
  config: Config.Config.Wrap<SqliteNodeConfig>,
) =>
  Layer.scoped(tag, Effect.flatMap(Effect.config(Config.unwrap(config)), make))
