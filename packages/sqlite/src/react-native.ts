/**
 * @since 1.0.0
 */
import { identity } from "effect/Function"
import { globalValue } from "effect/GlobalValue"
import * as Effect from "effect/Effect"
import * as FiberRef from "effect/FiberRef"
import * as Layer from "effect/Layer"
import * as Pool from "effect/Pool"
import type { Scope } from "effect/Scope"
import * as Client from "@sqlfx/sql/Client"
import type { Connection } from "@sqlfx/sql/Connection"
import { SqlError } from "@sqlfx/sql/Error"
import type * as Statement from "@sqlfx/sql/Statement"
import { makeCompiler, tag, type SqliteClient } from "./Client.js"
import * as Sqlite from "react-native-quick-sqlite"

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
export interface SqliteRNClientConfig {
  readonly filename: string
  readonly location?: string
  readonly transformResultNames?: (str: string) => string
  readonly transformQueryNames?: (str: string) => string
}

/**
 * @category fiber refs
 * @since 1.0.0
 */
export const asyncQuery: FiberRef.FiberRef<boolean> = globalValue(
  "@sqlfx/sqlite/react-native/asyncQuery",
  () => FiberRef.unsafeMake(false),
)

/**
 * @category fiber refs
 * @since 1.0.0
 */
export const withAsyncQuery = <R, E, A>(effect: Effect.Effect<R, E, A>) =>
  Effect.locally(effect, asyncQuery, true)

/**
 * @category constructor
 * @since 1.0.0
 */
export const make = (
  options: SqliteRNClientConfig,
): Effect.Effect<Scope, never, SqliteClient> =>
  Effect.gen(function* (_) {
    const compiler = makeCompiler(options.transformQueryNames)
    const transformRows = Client.defaultTransforms(
      options.transformResultNames!,
    ).array

    const handleError = (error: any) => SqlError(error.message, error)

    const makeConnection = Effect.gen(function* (_) {
      const db = Sqlite.open({
        name: options.filename,
        location: options.location,
      })
      yield* _(Effect.addFinalizer(() => Effect.sync(() => db.close())))

      const run = (
        sql: string,
        params: ReadonlyArray<Statement.Primitive> = [],
      ) =>
        Effect.map(
          FiberRef.getWith(asyncQuery, asyncQuery =>
            asyncQuery
              ? Effect.tryPromise({
                  try: () => db.executeAsync(sql, params as Array<any>),
                  catch: handleError,
                })
              : Effect.try({
                  try: () => db.execute(sql, params as Array<any>),
                  catch: handleError,
                }),
          ),
          result => result.rows?._array ?? [],
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
export const makeLayer = (config: SqliteRNClientConfig) =>
  Layer.scoped(tag, make(config))
