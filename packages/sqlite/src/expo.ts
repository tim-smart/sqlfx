/**
 * @since 1.0.0
 */
import { identity } from "effect/Function"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Pool from "effect/Pool"
import type { Scope } from "effect/Scope"
import * as Client from "@sqlfx/sql/Client"
import type { Connection } from "@sqlfx/sql/Connection"
import { SqlError } from "@sqlfx/sql/Error"
import type * as Statement from "@sqlfx/sql/Statement"
import type { SqliteClient } from "./Client.js"
import { tag } from "./Client.js"
import * as internal from "./internal/client.js"
import * as Sqlite from "expo-sqlite"

export {
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
export interface SqliteExpoClientConfig {
  readonly database: string
  readonly version?: string
  readonly transformResultNames?: (str: string) => string
  readonly transformQueryNames?: (str: string) => string
}

/**
 * @category constructor
 * @since 1.0.0
 */
export const make = (
  options: SqliteExpoClientConfig,
): Effect.Effect<Scope, never, SqliteClient> =>
  Effect.gen(function* (_) {
    const compiler = makeCompiler(options.transformQueryNames)
    const transformRows = Client.defaultTransforms(
      options.transformResultNames!,
    ).array

    const handleError = (error: any) => SqlError(error.message, error)

    const makeConnection = Effect.gen(function* (_) {
      const db = Sqlite.openDatabase(options.database, options.version)
      yield* _(Effect.addFinalizer(() => Effect.promise(() => db.closeAsync())))

      const run = (
        sql: string,
        params: ReadonlyArray<Statement.Primitive> = [],
      ) =>
        Effect.flatMap(
          Effect.tryPromise({
            try: () =>
              db.execAsync([{ sql, args: params as Array<any> }], false),
            catch: handleError,
          }),
          function (results) {
            const result = results[0]
            if ("error" in result) {
              return Effect.fail(handleError(result.error))
            }
            return Effect.succeed(result.rows as Array<any>)
          },
        )

      const runTransform = options.transformResultNames
        ? (sql: string, params?: ReadonlyArray<Statement.Primitive>) =>
            Effect.map(run(sql, params), transformRows)
        : run

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
          return Effect.map(run(sql, params), results => {
            if (results.length === 0) {
              return []
            }
            const columns = Object.keys(results[0])
            return results.map(row => columns.map(column => row[column]))
          })
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
        export: Effect.dieMessage("export not implemented"),
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
        config: options as any,
        export: Effect.scoped(Effect.flatMap(pool.get, _ => _.export)),
      },
    )
  })

/**
 * @category constructor
 * @since 1.0.0
 */
export const makeLayer = (config: SqliteExpoClientConfig) =>
  Layer.scoped(tag, make(config))

/**
 * @category constructor
 * @since 1.0.0
 */
export const makeCompiler: (
  transform?: ((_: string) => string) | undefined,
) => Statement.Compiler = internal.makeCompiler
