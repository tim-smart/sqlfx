/**
 * @since 1.0.0
 */
import { Tag } from "@effect/data/Context"
import * as Duration from "@effect/data/Duration"
import { identity } from "@effect/data/Function"
import * as Cache from "@effect/io/Cache"
import * as Config from "@effect/io/Config"
import * as Effect from "@effect/io/Effect"
import * as Layer from "@effect/io/Layer"
import * as Pool from "@effect/io/Pool"
import type { Scope } from "@effect/io/Scope"
import * as Client from "@sqlfx/sql/Client"
import type { Connection } from "@sqlfx/sql/Connection"
import * as Statement from "@sqlfx/sql/Statement"
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
  readonly readonly?: boolean
  readonly prepareCacheSize?: number
  readonly transformResultNames?: (str: string) => string
  readonly transformQueryNames?: (str: string) => string
}

const escape = Statement.defaultEscape('"')

/**
 * @category constructor
 * @since 1.0.0
 */
export const make = (
  options: SqliteClientConfig,
): Effect.Effect<Scope, never, SqliteClient> =>
  Effect.gen(function* (_) {
    const Sqlite = yield* _(Effect.promise(() => import("better-sqlite3")))

    const compiler = makeCompiler(options.transformQueryNames)
    const transformRows = Client.defaultRowTransform(
      options.transformResultNames!,
    )

    // const prepareCache = yield* _()
    const makeConnection = Effect.gen(function* (_) {
      const db = new Sqlite.default(options.filename, {
        readonly: options.readonly ?? false,
      })
      yield* _(Effect.addFinalizer(() => Effect.sync(() => db.close())))

      const prepareCache = yield* _(
        Cache.make(
          options.prepareCacheSize ?? 200,
          Duration.minutes(45),
          (sql: string) => Effect.sync(() => db.prepare(sql)),
        ),
      )

      const run = (sql: string, params?: ReadonlyArray<Statement.Primitive>) =>
        Effect.map(prepareCache.get(sql), _ => {
          if (_.reader) {
            return _.all(params) as ReadonlyArray<any>
          }
          _.run(params)
          return []
        })

      const runTransform = options.transformResultNames
        ? (sql: string, params?: ReadonlyArray<Statement.Primitive>) =>
            Effect.map(run(sql, params), transformRows)
        : run

      const runValues = (
        sql: string,
        params: ReadonlyArray<Statement.Primitive>,
      ) =>
        Effect.acquireUseRelease(
          Effect.map(prepareCache.get(sql), _ => _.raw(true)),
          statement =>
            Effect.sync(() => {
              if (statement.reader) {
                return statement.all(params) as ReadonlyArray<
                  ReadonlyArray<Statement.Primitive>
                >
              }
              statement.run(params)
              return []
            }),
          statement => Effect.sync(() => statement.raw(false)),
        )

      return identity<Connection>({
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
        compile(statement) {
          return Effect.sync(() => compiler.compile(statement))
        },
      })
    })

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
