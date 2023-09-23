/**
 * @since 1.0.0
 */
import { identity } from "@effect/data/Function"
import * as Effect from "@effect/io/Effect"
import * as Layer from "@effect/io/Layer"
import * as Pool from "@effect/io/Pool"
import type { Scope } from "@effect/io/Scope"
import * as Client from "@sqlfx/sql/Client"
import type { Connection } from "@sqlfx/sql/Connection"
import { SqlError } from "@sqlfx/sql/Error"
import type * as Statement from "@sqlfx/sql/Statement"
import { tag, type SqliteClient } from "@sqlfx/sqlite/Client"
import * as internal from "@sqlfx/sqlite/internal/client"
import Sqlite from "react-native-sqlite-storage"

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
  /**
   * @category models
   * @since 1.0.0
   */
  SqliteClient,
} from "@sqlfx/sqlite/Client"

/**
 * @category models
 * @since 1.0.0
 */
export type SqliteRNClientConfig = Sqlite.DatabaseParams & {
  readonly transformResultNames?: (str: string) => string
  readonly transformQueryNames?: (str: string) => string
}

/**
 * @category constructor
 * @since 1.0.0
 */
export const make = (
  options: SqliteRNClientConfig,
): Effect.Effect<Scope, never, SqliteClient> =>
  Effect.gen(function* (_) {
    const compiler = makeCompiler(options.transformQueryNames)
    const transformRows = Client.defaultRowTransform(
      options.transformResultNames!,
    )

    const handleError = (error: Sqlite.SQLError) =>
      SqlError(error.message, error)

    const makeConnection = Effect.gen(function* (_) {
      const db = yield* _(
        Effect.async<never, SqlError, Sqlite.SQLiteDatabase>(resume => {
          const db: Sqlite.SQLiteDatabase = Sqlite.openDatabase(
            options,
            () => resume(Effect.succeed(db)),
            error => resume(Effect.fail(handleError(error))),
          )
        }),
      )

      const close = Effect.async<never, SqlError, void>(resume => {
        db.close(
          () => resume(Effect.unit),
          error => resume(Effect.fail(handleError(error))),
        )
      })
      yield* _(Effect.addFinalizer(() => Effect.orDie(close)))

      const run = (
        sql: string,
        params: ReadonlyArray<Statement.Primitive> = [],
      ) =>
        Effect.async<never, SqlError, Array<any>>(resume => {
          db.executeSql(
            sql,
            params as Array<any>,
            function (_tx, results) {
              resume(Effect.succeed(results.rows.raw()))
            },
            function (_tx, error) {
              resume(Effect.fail(handleError(error)))
            },
          )
        })

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
        compile(statement) {
          return Effect.sync(() => compiler.compile(statement))
        },
        export: Effect.dieMessage("export not implemented"),
      })
    })

    const pool = yield* _(Pool.make({ acquire: makeConnection, size: 1 }))

    return Object.assign(
      Client.make({
        acquirer: Effect.scoped(pool.get()),
        transactionAcquirer: pool.get(),
      }),
      {
        config: options as any,
        export: Effect.scoped(Effect.flatMap(pool.get(), _ => _.export)),
      },
    )
  })

/**
 * @category constructor
 * @since 1.0.0
 */
export const makeLayer = (config: SqliteRNClientConfig) =>
  Layer.scoped(tag, make(config))

/**
 * @category constructor
 * @since 1.0.0
 */
export const makeCompiler: (
  transform?: ((_: string) => string) | undefined,
) => Statement.Compiler = internal.makeCompiler
