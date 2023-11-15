/**
 * @since 1.0.0
 */
import { identity } from "effect/Function"
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
import { Database } from "bun:sqlite"

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
export interface SqliteBunConfig {
  readonly filename: string
  readonly readonly?: boolean
  readonly create?: boolean
  readonly readwrite?: boolean
  readonly transformResultNames?: (str: string) => string
  readonly transformQueryNames?: (str: string) => string
}

/**
 * @category constructor
 * @since 1.0.0
 */
export const make = (
  options: SqliteBunConfig,
): Effect.Effect<Scope, never, SqliteClient> =>
  Effect.gen(function* (_) {
    const compiler = makeCompiler(options.transformQueryNames)
    const transformRows = Client.defaultTransforms(
      options.transformResultNames!,
    ).array

    const handleError = (error: any) => SqlError(error.message, { ...error })

    const makeConnection = Effect.gen(function* (_) {
      const db = new Database(options.filename, {
        readonly: options.readonly,
        readwrite: options.readwrite ?? true,
        create: options.create ?? true,
      })
      yield* _(Effect.addFinalizer(() => Effect.sync(() => db.close())))

      db.run("PRAGMA journal_mode = WAL;")

      const run = (
        sql: string,
        params: ReadonlyArray<Statement.Primitive> = [],
      ) =>
        Effect.try({
          try: () => db.query(sql).all(...(params as any)) as Array<any>,
          catch: handleError,
        })

      const runTransform = options.transformResultNames
        ? (sql: string, params?: ReadonlyArray<Statement.Primitive>) =>
            Effect.map(run(sql, params), transformRows)
        : run

      const runValues = (
        sql: string,
        params: ReadonlyArray<Statement.Primitive> = [],
      ) =>
        Effect.try({
          try: () => db.query(sql).values(...(params as any)) as Array<any>,
          catch: handleError,
        })

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
  config: Config.Config.Wrap<SqliteBunConfig>,
) => Layer.Layer<never, ConfigError, SqliteClient> = (
  config: Config.Config.Wrap<SqliteBunConfig>,
) =>
  Layer.scoped(tag, Effect.flatMap(Effect.config(Config.unwrap(config)), make))
