/* eslint-disable @typescript-eslint/no-extra-semi */
import { Tag } from "effect/Context"
import * as Duration from "effect/Duration"
import { identity, pipe } from "effect/Function"
import * as Option from "effect/Option"
import * as Config from "effect/Config"
import type { ConfigError } from "effect/ConfigError"
import * as ConfigSecret from "effect/ConfigSecret"
import * as Effect from "effect/Effect"
import * as Exit from "effect/Exit"
import * as Layer from "effect/Layer"
import * as Pool from "effect/Pool"
import type { Scope } from "effect/Scope"
import type { MssqlClient, MssqlClientConfig } from "../index.js"
import type { Parameter } from "../Parameter.js"
import type { ProcedureWithValues } from "../Procedure.js"
import * as Client from "@sqlfx/sql/Client"
import type { Connection } from "@sqlfx/sql/Connection"
import { SqlError } from "@sqlfx/sql/Error"
import type { Primitive as _Primitive } from "@sqlfx/sql/Statement"
import * as Statement from "@sqlfx/sql/Statement"
import * as transform from "@sqlfx/sql/Transform"
import * as Tedious from "tedious"

/** @internal */
export const tag = Tag<MssqlClient>()

interface MssqlConnection extends Connection {
  readonly call: (
    procedure: ProcedureWithValues<any, any, any>,
  ) => Effect.Effect<never, SqlError, any>

  readonly begin: Effect.Effect<never, SqlError, void>
  readonly commit: Effect.Effect<never, SqlError, void>
  readonly savepoint: (name: string) => Effect.Effect<never, SqlError, void>
  readonly rollback: (name?: string) => Effect.Effect<never, SqlError, void>
}

const TransactionConn = Client.TransactionConnection as unknown as Tag<
  readonly [conn: MssqlConnection, counter: number],
  readonly [conn: MssqlConnection, counter: number]
>

/** @internal */
export const make = (
  options: MssqlClientConfig,
): Effect.Effect<Scope, never, MssqlClient> =>
  Effect.gen(function* (_) {
    const parameterTypes = options.parameterTypes ?? defaultParameterTypes
    const compiler = makeCompiler(options.transformQueryNames)

    const transformRows = Client.defaultTransforms(
      options.transformResultNames!,
    ).array

    // eslint-disable-next-line prefer-const
    let pool: Pool.Pool<SqlError, MssqlConnection>

    const makeConnection = Effect.gen(function* (_) {
      const conn = new Tedious.Connection({
        options: {
          port: options.port,
          database: options.database,
          trustServerCertificate: options.trustServer ?? true,
          connectTimeout: options.connectTimeout
            ? Duration.toMillis(Duration.decode(options.connectTimeout))
            : undefined,
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
            conn.on("end", () => resume(Effect.unit))
            conn.close()
          }),
        ),
      )

      yield* _(
        Effect.async<never, SqlError, void>(resume => {
          conn.connect(err => {
            if (err) {
              resume(Effect.fail(SqlError(err.message, err)))
            } else {
              resume(Effect.unit)
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
              resume(Effect.fail(SqlError(error.message, error)))
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

            resume(Effect.succeed(result))
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
                resume(Effect.fail(SqlError(error.message, error)))
              } else {
                rows = rowsToObjects(rows)
                if (transform && options.transformResultNames) {
                  rows = transformRows(rows) as any
                }
                resume(
                  Effect.succeed({
                    params: result,
                    rows,
                  }),
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

      const connection = identity<MssqlConnection>({
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
        executeStream(_statement) {
          return Effect.dieMessage("executeStream not implemented")
        },
        call: procedure => {
          return runProcedure(procedure)
        },
        begin: Effect.async<never, SqlError, void>(resume => {
          conn.beginTransaction(err => {
            if (err) {
              resume(Effect.fail(SqlError(err.message, err)))
            } else {
              resume(Effect.unit)
            }
          })
        }),
        commit: Effect.async<never, SqlError, void>(resume => {
          conn.commitTransaction(err => {
            if (err) {
              resume(Effect.fail(SqlError(err.message, err)))
            } else {
              resume(Effect.unit)
            }
          })
        }),
        savepoint: (name: string) =>
          Effect.async<never, SqlError, void>(resume => {
            // eslint-disable-next-line no-extra-semi
            ;(conn.saveTransaction as any)((err: Error) => {
              if (err) {
                resume(Effect.fail(SqlError(err.message, err)))
              } else {
                resume(Effect.unit)
              }
            }, name)
          }),
        rollback: (name?: string) =>
          Effect.async<never, SqlError, void>(resume => {
            ;(conn.rollbackTransaction as any)((err: Error) => {
              if (err) {
                resume(Effect.fail(SqlError(err.message, err)))
              } else {
                resume(Effect.unit)
              }
            }, name)
          }),
      })

      yield* _(
        Effect.async<never, unknown, never>(resume => {
          conn.on("error", _ => resume(Effect.fail(_)))
        }),
        Effect.catchAll(() => Pool.invalidate(pool, connection)),
        Effect.interruptible,
        Effect.forkScoped,
      )

      return connection
    })

    pool = yield* _(
      Pool.makeWithTTL({
        acquire: makeConnection,
        min: options.minConnections ?? 1,
        max: options.maxConnections ?? 10,
        timeToLive: options.connectionTTL ?? Duration.minutes(45),
      }),
    )

    const withTransaction = <R, E, A>(
      effect: Effect.Effect<R, E, A>,
    ): Effect.Effect<R, E | SqlError, A> =>
      Effect.scoped(
        Effect.acquireUseRelease(
          pipe(
            Effect.serviceOption(TransactionConn),
            Effect.flatMap(
              Option.match({
                onNone: () =>
                  Effect.map(Pool.get(pool), conn => [conn, 0] as const),
                onSome: Effect.succeed,
              }),
            ),
            Effect.tap(([conn, id]) =>
              id > 0 ? conn.savepoint(`sqlfx${id}`) : conn.begin,
            ),
          ),
          ([conn, id]) =>
            Effect.provideService(effect, TransactionConn, [conn, id + 1]),
          ([conn, id], exit) =>
            Exit.isSuccess(exit)
              ? id > 0
                ? Effect.unit
                : Effect.orDie(conn.commit)
              : Effect.orDie(conn.rollback(id > 0 ? `sqlfx${id}` : undefined)),
        ),
      )

    return Object.assign(
      Client.make({
        acquirer: pool.get,
        compiler,
        transactionAcquirer: pool.get,
      }),
      {
        config: options,

        withTransaction,

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
        ) => Effect.scoped(Effect.flatMap(pool.get, _ => _.call(procedure))),
      },
    )
  })

/** @internal */
export const makeLayer: (
  config: Config.Config.Wrap<MssqlClientConfig>,
) => Layer.Layer<never, ConfigError, MssqlClient> = (
  config: Config.Config.Wrap<MssqlClientConfig>,
) =>
  Layer.scoped(tag, Effect.flatMap(Effect.config(Config.unwrap(config)), make))

/** @internal */
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

/** @internal */
export const defaultParameterTypes: Record<
  Statement.PrimitiveKind,
  Tedious.TediousType
> = {
  string: Tedious.TYPES.VarChar,
  number: Tedious.TYPES.Int,
  bigint: Tedious.TYPES.BigInt,
  boolean: Tedious.TYPES.Bit,
  Date: Tedious.TYPES.DateTime,
  Uint8Array: Tedious.TYPES.VarBinary,
  Int8Array: Tedious.TYPES.VarBinary,
  null: Tedious.TYPES.Null,
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
