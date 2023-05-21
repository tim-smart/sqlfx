/**
 * @since 1.0.0
 */
import type { Tag } from "@effect/data/Context"
import { identity } from "@effect/data/Function"
import * as Effect from "@effect/io/Effect"
import * as Layer from "@effect/io/Layer"
import * as Pool from "@effect/io/Pool"
import type { Scope } from "@effect/io/Scope"
import * as Client from "@sqlfx/sql/Client"
import type { Connection } from "@sqlfx/sql/Connection"
import { SqlError } from "@sqlfx/sql/Error"
import type * as Statement from "@sqlfx/sql/Statement"
import * as transform from "@sqlfx/sql/Transform"
import * as internal from "@sqlfx/sqlite/internal/client"
import type { DB, OpenMode, RowMode } from "@sqlite.org/sqlite-wasm"
import sqliteInit from "@sqlite.org/sqlite-wasm"
import type { SqliteClient } from "@sqlfx/sqlite"

export {
  /**
   * Column renaming helpers.
   *
   * @since 1.0.0
   */
  transform,
}

/**
 * @category tag
 * @since 1.0.0
 */
export const tag: Tag<SqliteClient, SqliteClient> = internal.tag

/**
 * @category constructor
 * @since 1.0.0
 */
export type SqliteWasmClientConfig =
  | {
      readonly mode?: "vfs"
      readonly dbName?: string
      readonly openMode?: OpenMode
      readonly transformResultNames?: (str: string) => string
      readonly transformQueryNames?: (str: string) => string
    }
  | {
      readonly mode: "opfs"
      readonly dbName: string
      readonly openMode?: OpenMode
      readonly transformResultNames?: (str: string) => string
      readonly transformQueryNames?: (str: string) => string
    }

const initEffect = Effect.runSync(
  Effect.cached(Effect.promise(() => sqliteInit())),
)

/**
 * @category constructor
 * @since 1.0.0
 */
export const make = (
  options: SqliteWasmClientConfig,
): Effect.Effect<Scope, never, SqliteClient> =>
  Effect.gen(function* (_) {
    const compiler = makeCompiler(options.transformQueryNames)
    const transformRows = Client.defaultRowTransform(
      options.transformResultNames!,
    )

    const handleError = (error: any) => SqlError(error.message, { ...error })

    const makeConnection = Effect.gen(function* (_) {
      const sqlite3 = yield* _(initEffect)
      let db: DB
      if (options.mode === "opfs") {
        if (!sqlite3.oo1.OpfsDb) {
          yield* _(Effect.dieMessage("opfs mode not available"))
        }
        db = new sqlite3.oo1.OpfsDb!(options.dbName, options.openMode ?? "c")
      } else {
        db = new sqlite3.oo1.DB(options.dbName, options.openMode)
      }

      yield* _(Effect.addFinalizer(() => Effect.sync(() => db.close())))

      const run = (
        sql: string,
        params: ReadonlyArray<Statement.Primitive> = [],
        rowMode: RowMode = "object",
      ) =>
        Effect.tryCatch(() => {
          const results: Array<any> = []
          db.exec({
            sql,
            bind: params.length ? params : undefined,
            rowMode,
            resultRows: results,
          })
          return results
        }, handleError)

      const runTransform = options.transformResultNames
        ? (sql: string, params?: ReadonlyArray<Statement.Primitive>) =>
            Effect.map(run(sql, params), transformRows)
        : run

      return identity<Connection>({
        execute(statement) {
          const [sql, params] = compiler.compile(statement)
          return runTransform(sql, params)
        },
        executeValues(statement) {
          const [sql, params] = compiler.compile(statement)
          return run(sql, params, "array")
        },
        executeWithoutTransform(statement) {
          const [sql, params] = compiler.compile(statement)
          return run(sql, params)
        },
        executeRaw(sql, params) {
          return runTransform(sql, params)
        },
        compile(statement) {
          return Effect.sync(() => compiler.compile(statement))
        },
      })
    })

    const pool = yield* _(Pool.make(makeConnection, 1))

    return Object.assign(Client.make(Effect.scoped(pool.get()), pool.get()), {
      config: options as any,
    })
  })

/**
 * @category constructor
 * @since 1.0.0
 */
export const makeLayer = (config: SqliteWasmClientConfig) =>
  Layer.scoped(tag, make(config))

/**
 * @category constructor
 * @since 1.0.0
 */
export const makeCompiler: (
  transform?: ((_: string) => string) | undefined,
) => Statement.Compiler = internal.makeCompiler
