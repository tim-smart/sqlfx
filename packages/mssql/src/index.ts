/**
 * @since 1.0.0
 */
import { Tag } from "@effect/data/Context"
import * as Debug from "@effect/data/Debug"
import type { Duration } from "@effect/data/Duration"
import { minutes } from "@effect/data/Duration"
import { identity } from "@effect/data/Function"
import * as Config from "@effect/io/Config"
import * as ConfigSecret from "@effect/io/Config/Secret"
import * as Effect from "@effect/io/Effect"
import * as Layer from "@effect/io/Layer"
import * as Pool from "@effect/io/Pool"
import type { Scope } from "@effect/io/Scope"
import type { Parameter } from "@sqlfx/mssql/Parameter"
import type { Procedure, ProcedureWithValues } from "@sqlfx/mssql/Procedure"
import * as Client from "@sqlfx/sql/Client"
import type { Connection } from "@sqlfx/sql/Connection"
import { SqlError } from "@sqlfx/sql/Error"
import type { Primitive as _Primitive } from "@sqlfx/sql/Statement"
import * as Statement from "@sqlfx/sql/Statement"
import * as transform from "@sqlfx/sql/Transform"
import * as Tedious from "tedious"
import type { ConfigError } from "@effect/io/Config/Error"

const TYPES = Tedious.TYPES

export {
  /**
   * Column renaming helpers.
   *
   * @since 1.0.0
   */
  transform,

  /**
   * Parameter types
   *
   * @since 1.0.0
   */
  TYPES,
}

/**
 * @category model
 * @since 1.0.0
 */
export interface MssqlClient extends Client.Client {
  readonly config: MssqlClientConfig

  readonly param: (
    type: Tedious.TediousType,
    value: Statement.Primitive,
    options?: Tedious.ParameterOptions,
  ) => Statement.Fragment

  readonly call: <
    I extends Record<string, Parameter<any>>,
    O extends Record<string, Parameter<any>>,
    A extends object,
  >(
    procedure: ProcedureWithValues<I, O, A>,
  ) => Effect.Effect<never, SqlError, Procedure.Result<O, A>>
}

/**
 * @category tag
 * @since 1.0.0
 */
export const tag = Tag<MssqlClient>()

/**
 * @category constructor
 * @since 1.0.0
 */
export interface MssqlClientConfig {
  readonly domain?: string
  readonly server?: string
  readonly trustServer?: boolean
  readonly port?: number
  readonly authType?: string
  readonly database?: string
  readonly username?: string
  readonly password?: ConfigSecret.ConfigSecret
  readonly connectTimeout?: Duration

  readonly minConnections?: number
  readonly maxConnections?: number
  readonly connectionTTL?: Duration

  readonly parameterTypes?: Record<Statement.PrimitiveKind, Tedious.TediousType>

  readonly transformResultNames?: (str: string) => string
  readonly transformQueryNames?: (str: string) => string
}

interface MssqlConnection extends Connection {
  readonly call: (
    procedure: ProcedureWithValues<any, any, any>,
  ) => Effect.Effect<never, SqlError, any>
}

/**
 * @category constructor
 * @since 1.0.0
 */
export const make = (
  options: MssqlClientConfig,
): Effect.Effect<Scope, never, MssqlClient> =>
  Effect.gen(function* (_) {
    const parameterTypes = options.parameterTypes ?? defaultParameterTypes
    const compiler = makeCompiler(options.transformQueryNames)

    const transformRows = Client.defaultRowTransform(
      options.transformResultNames!,
    )

    const makeConnection = Effect.gen(function* (_) {
      const conn = new Tedious.Connection({
        options: {
          port: options.port,
          database: options.database,
          trustServerCertificate: options.trustServer ?? true,
          connectTimeout: options.connectTimeout?.millis,
          rowCollectionOnRequestCompletion: true,
          useColumnNames: false,
        },
        server: options.server,
        domain: options.domain,
        authentication: {
          type: options.authType ?? "default",
          options: {
            userName: options.username,
            password: options.password
              ? ConfigSecret.value(options.password)
              : undefined,
          },
        },
      })

      yield* _(
        Effect.addFinalizer(() =>
          Effect.async<never, never, void>(resume => {
            conn.once("end", () => resume(Effect.unit()))
            conn.close()
          }),
        ),
      )

      yield* _(
        Effect.async<never, SqlError, void>(resume => {
          conn.connect(err => {
            if (err) {
              resume(
                Debug.untraced(() => Effect.fail(SqlError(err.message, err))),
              )
            } else {
              resume(Debug.untraced(() => Effect.unit()))
            }
          })
        }),
      )

      const run = (
        sql: string,
        values?: ReadonlyArray<any>,
        transform = true,
        rowsAsArray = false,
      ) =>
        Effect.async<never, SqlError, any>(resume => {
          const req = new Tedious.Request(sql, (error, _rowCount, result) => {
            if (error) {
              resume(
                Debug.untraced(() =>
                  Effect.fail(SqlError(error.message, error)),
                ),
              )
              return
            }

            if (rowsAsArray) {
              result = result.map(row => row.map((_: any) => _.value))
            } else {
              result = rowsToObjects(result)

              if (transform && options.transformResultNames) {
                result = transformRows(result) as any
              }
            }

            resume(Debug.untraced(() => Effect.succeed(result)))
          })

          if (values) {
            for (let i = 0, len = values.length; i < len; i++) {
              const value = values[i]
              const name = numberToAlpha(i)

              if (isMssqlParam(value)) {
                req.addParameter(name, value.i0, value.i1, value.i2)
              } else {
                const kind = Statement.primitiveKind(value)
                const type = parameterTypes[kind]
                req.addParameter(name, type, value)
              }
            }
          }

          conn.execSql(req)
        })

      const runProcedure = (procedure: ProcedureWithValues<any, any, any>) =>
        Effect.async<never, SqlError, any>(resume => {
          const result: Record<string, any> = {}

          const req = new Tedious.Request(
            escape(procedure.name),
            (error, _, rows) => {
              if (error) {
                resume(
                  Debug.untraced(() =>
                    Effect.fail(SqlError(error.message, error)),
                  ),
                )
              } else {
                rows = rowsToObjects(rows)
                if (transform && options.transformResultNames) {
                  rows = transformRows(rows) as any
                }
                resume(
                  Debug.untraced(() =>
                    Effect.succeed({
                      params: result,
                      rows,
                    }),
                  ),
                )
              }
            },
          )

          for (const name in procedure.params) {
            const param = procedure.params[name]
            const value = procedure.values[name]
            req.addParameter(name, param.type, value, param.options)
          }

          for (const name in procedure.outputParams) {
            const param = procedure.outputParams[name]
            req.addOutputParameter(name, param.type, undefined, param.options)
          }

          req.on("returnValue", (name, value) => {
            result[name] = value
          })

          conn.callProcedure(req)
        })

      return identity<MssqlConnection>({
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
        call: procedure => {
          return runProcedure(procedure)
        },
        compile(statement) {
          return Effect.sync(() => compiler.compile(statement))
        },
      })
    })

    const pool = yield* _(
      Pool.makeWithTTL(
        makeConnection,
        options.minConnections ?? 1,
        options.maxConnections ?? 10,
        options.connectionTTL ?? minutes(45),
      ),
    )

    return Object.assign(
      Client.make({
        acquirer: pool.get(),
        transactionAcquirer: pool.get(),
        beginTransaction: "BEGIN TRANSACTION",
        savepoint: name => `SAVE TRANSACTION ${name}`,
        rollbackSavepoint: name => `ROLLBACK TRANSACTION ${name}`,
      }),
      {
        config: options,

        param: (
          type: Tedious.TediousType,
          value: Statement.Primitive,
          options: Tedious.ParameterOptions = {},
        ) => mssqlParam(type, value, options),

        call: <
          I extends Record<string, Parameter<any>>,
          O extends Record<string, Parameter<any>>,
          A,
        >(
          procedure: ProcedureWithValues<I, O, A>,
        ) => Effect.scoped(Effect.flatMap(pool.get(), _ => _.call(procedure))),
      },
    )
  })

/**
 * @category constructor
 * @since 1.0.0
 */
export const makeLayer: (
  config: Config.Config.Wrap<MssqlClientConfig>,
) => Layer.Layer<never, ConfigError, MssqlClient> = (
  config: Config.Config.Wrap<MssqlClientConfig>,
) =>
  Layer.scoped(tag, Effect.flatMap(Effect.config(Config.unwrap(config)), make))

/**
 * @category constructor
 * @since 1.0.0
 */
export const makeCompiler = (transform?: (_: string) => string) => {
  return Statement.makeCompiler<MssqlCustom>(
    _ => `@${numberToAlpha(_ - 1)}`,
    transform ? _ => escape(transform(_)) : escape,
    (placeholders, valueAlias, valueColumns, values) => [
      `(values ${placeholders}) AS ${valueAlias}${valueColumns}`,
      values.flat(),
    ],
    (type, placeholder) => {
      switch (type.kind) {
        case "MssqlParam": {
          return [placeholder(), [type] as any]
        }
      }
    },
    (columns, placeholders, values) => [
      `(${columns.join(",")}) OUTPUT INSERTED.* VALUES ${placeholders}`,
      values.flat(),
    ],
  )
}

/**
 * @since 1.0.0
 */
export const defaultParameterTypes: Record<
  Statement.PrimitiveKind,
  Tedious.TediousType
> = {
  string: TYPES.VarChar,
  number: TYPES.Int,
  bigint: TYPES.BigInt,
  boolean: TYPES.Bit,
  Date: TYPES.DateTime,
  Uint8Array: TYPES.VarBinary,
  Int8Array: TYPES.VarBinary,
  null: TYPES.Null,
}

// compiler helpers

const escape = (str: string) =>
  "[" + str.replace(/\]/g, "]]").replace(/\./g, "].[") + "]"

const charCodeA = "a".charCodeAt(0)
function numberToAlpha(n: number) {
  let s = ""
  while (n >= 0) {
    s = String.fromCharCode((n % 26) + charCodeA) + s
    n = Math.floor(n / 26) - 1
  }
  return s
}

function rowsToObjects(rows: ReadonlyArray<any>) {
  const newRows = new Array(rows.length)

  for (let i = 0, len = rows.length; i < len; i++) {
    const row = rows[i]
    const newRow: any = {}
    for (let j = 0, columnLen = row.length; j < columnLen; j++) {
      const column = row[j]
      newRow[column.metadata.colName] = column.value
    }
    newRows[i] = newRow
  }

  return newRows
}

// custom types

type MssqlCustom = MssqlParam

interface MssqlParam
  extends Statement.Custom<
    "MssqlParam",
    Tedious.TediousType,
    Statement.Primitive,
    Tedious.ParameterOptions
  > {}

const mssqlParam = Statement.custom<MssqlParam>("MssqlParam")
const isMssqlParam = Statement.isCustom<MssqlParam>("MssqlParam")
