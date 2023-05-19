/**
 * @since 1.0.0
 */
import { Tag } from "@effect/data/Context"
import * as Debug from "@effect/data/Debug"
import { pipe } from "@effect/data/Function"
import * as Config from "@effect/io/Config"
import * as Effect from "@effect/io/Effect"
import * as Layer from "@effect/io/Layer"
import * as Pool from "@effect/io/Pool"
import type { Scope } from "@effect/io/Scope"
import * as Client from "@sqlfx/sql/Client"
import type { Connection, Row } from "@sqlfx/sql/Connection"
import { SqlError } from "@sqlfx/sql/Error"
import * as Statement from "@sqlfx/sql/Statement"
import * as transform from "@sqlfx/sql/Transform"
import * as Sqlite from "sqlite3"

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
export interface SqliteClient extends Client.Client {
  readonly config: SqliteClientConfig
}

/**
 * @category tag
 * @since 1.0.0
 */
export const tag = Tag<SqliteClient>()

/**
 * @category constructor
 * @since 1.0.0
 */
export interface SqliteClientConfig {
  readonly filename: string
  readonly mode?: ReadonlyArray<SqliteOpenMode>
  readonly transformResultNames?: (str: string) => string
  readonly transformQueryNames?: (str: string) => string
}

/**
 * @category model
 * @since 1.0.0
 */
export type SqliteOpenMode =
  | "OPEN_READONLY"
  | "OPEN_READWRITE"
  | "OPEN_CREATE"
  | "OPEN_FULLMUTEX"
  | "OPEN_SHAREDCACHE"
  | "OPEN_PRIVATECACHE"

const escape = Statement.defaultEscape('"')

/**
 * @category constructor
 * @since 1.0.0
 */
export const make = (
  options: SqliteClientConfig,
): Effect.Effect<Scope, never, SqliteClient> =>
  Effect.gen(function* (_) {
    const compiler = makeCompiler(options.transformQueryNames)

    const transformRows = Client.defaultRowTransform(
      options.transformResultNames!,
    )

    const mode = options.mode?.reduce((acc, _) => acc | Sqlite[_], 0)

    const makeConnection = pipe(
      Effect.acquireRelease(
        Effect.sync(() => new Sqlite.Database(options.filename, mode)),
        _ =>
          Effect.async<never, never, void>(resume =>
            _.close(() => resume(Effect.unit())),
          ),
      ),
      Effect.map((db): Connection => {
        const run = (
          sql: string,
          params?: ReadonlyArray<any>,
          transform = true,
        ) =>
          Effect.async<never, SqlError, any>(resume =>
            db.all<Row>(sql, params, (error, result) => {
              if (error) {
                resume(
                  Debug.untraced(() =>
                    Effect.fail(SqlError(error.message, error)),
                  ),
                )
              } else if (transform && options.transformResultNames) {
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
          executeValues() {
            return Effect.dieMessage("unimplemented")
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

    const pool = yield* _(Pool.make(makeConnection, 1))

    return Object.assign(Client.make(Effect.scoped(pool.get()), pool.get()), {
      config: options,
    })
  })

/**
 * @category constructor
 * @since 1.0.0
 */
export const makeLayer = (config: Config.Config.Wrap<SqliteClientConfig>) =>
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
