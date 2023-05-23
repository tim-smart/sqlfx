/**
 * @since 1.0.0
 */
import { Tag } from "@effect/data/Context"
import * as Debug from "@effect/data/Debug"
import type { Duration } from "@effect/data/Duration"
import { minutes } from "@effect/data/Duration"
import { pipe } from "@effect/data/Function"
import * as Config from "@effect/io/Config"
import * as ConfigSecret from "@effect/io/Config/Secret"
import * as Effect from "@effect/io/Effect"
import * as Layer from "@effect/io/Layer"
import * as Pool from "@effect/io/Pool"
import type { Scope } from "@effect/io/Scope"
import * as Client from "@sqlfx/sql/Client"
import type { Connection } from "@sqlfx/sql/Connection"
import { SqlError } from "@sqlfx/sql/Error"
import type { Custom, Primitive as _Primitive } from "@sqlfx/sql/Statement"
import * as Statement from "@sqlfx/sql/Statement"
import * as transform from "@sqlfx/sql/Transform"
import * as Tedious from "tedious"

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
export interface TediousClient extends Client.Client {
  readonly config: TediusClientConfig
}

/**
 * @category tag
 * @since 1.0.0
 */
export const tag = Tag<TediousClient>()

/**
 * @category constructor
 * @since 1.0.0
 */
export interface TediusClientConfig {

  readonly domain?: string
  readonly server?: string
  readonly port?: number
  readonly database?: string
  readonly username?: string
  readonly password?: ConfigSecret.ConfigSecret
  readonly connectTimeout?: Duration

  readonly minConnections?: number
  readonly maxConnections?: number
  readonly connectionTTL?: Duration

  readonly transformResultNames?: (str: string) => string
  readonly transformQueryNames?: (str: string) => string
}

const escape = Statement.defaultEscape('')

/**
 * @category constructor
 * @since 1.0.0
 */
export const make = (
  options: TediusClientConfig,
): Effect.Effect<Scope, never, TediousClient> =>
  Effect.gen(function*(_) {
    const compiler = makeCompiler(options.transformQueryNames)

    const transformRows = Client.defaultRowTransform(
      options.transformResultNames!,
    )

    const makeConnection = pipe(
      Effect.acquireRelease(
        Effect.tap(Effect.sync(() =>
          new Tedious.Connection({
            options: {
              port: options.port,
              database: options.database,
              connectTimeout: options.connectTimeout?.millis
            },
            server: options.server,
            domain: options.domain,
            authentication: {
              options: {
                userName: options.username,
                password: options.password
                  ? ConfigSecret.value(options.password)
                  : undefined,
              }
            },
          }),
        ), _ => Effect.sync(() => _.connect())),
        _ =>
          Effect.async<never, never, void>(resume => {
            _.on("end", () => resume(Effect.unit()))
            _.close()
          },
          ),
      ),
      Effect.map((conn): Connection => {
        const run = (
          sql: string,
          _values?: ReadonlyArray<any>,
          transform = true,
          rowsAsArray = false,
        ) =>
          Effect.async<never, SqlError, any>(resume => {
            const req = new Tedious.Request(sql, (error, _rowCount, result) => {
              if (error) {
                resume(
                  Debug.untraced(() => Effect.fail(SqlError(error.message, error))
                  )
                )
              } else if (transform &&
                !rowsAsArray &&
                options.transformResultNames) {
                resume(
                  Debug.untraced(() => Effect.succeed(transformRows(result)))
                )
              } else {
                resume(Debug.untraced(() => Effect.succeed(result)))
              }
            })
            conn.execSql(req)
          })

        return {
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
          compile(statement) {
            return Effect.sync(() => compiler.compile(statement))
          },
        }
      }),
    )

    const pool = yield* _(
      Pool.makeWithTTL(
        makeConnection,
        options.minConnections ?? 1,
        options.maxConnections ?? 10,
        options.connectionTTL ?? minutes(45),
      ),
    )

    return Object.assign(Client.make(pool.get(), pool.get()), {
      config: options,
    })
  })

/**
 * @category constructor
 * @since 1.0.0
 */
export const makeLayer = (config: Config.Config.Wrap<TediusClientConfig>) =>
  Layer.scoped(tag, Effect.flatMap(Effect.config(Config.unwrap(config)), make))
// UPDATE e
// SET hire_date = t.hire_date
// FROM dbo.employee e
// JOIN (
//     VALUES
//         ('PMA42628M', '1979-03-15'),
//         ('PSA89086M', '1988-12-22')
// ) t (emp_id, hire_date) ON t.emp_id = e.emp_id
export const makeCompiler = (transform?: (_: string) => string) => {
  return Statement.makeCompiler<TediousCustom>(
    (_,v) => `@${v}`,
    transform ? _ => escape(transform(_)) : escape,
    (placeholders, valueAlias, valueColumns, values) => [
      `(values ${placeholders}) AS ${valueAlias}${valueColumns}`,
      values.flat(),
    ],
    (type, placeholder) => {
      switch (type.kind) {
        case "TediusType": {
          return [placeholder(), [type.i0 as any, type.i1] as any]
        }
      }
    },
  )
}

// custom types

type TediousCustom =
  | TediousType
// | TediousBigInt
// | TediousBinary
// | TediousBit
// | TediousChar
// | TediousDate
// | TediousDateTime2
// | TediousDateTime
// | TediousDateTimeOffset
// | TediousDecimal
// | TediousFloat
// | TediousImage
// | TediousInt
// | TediousMoney
// | TediousNChar
// | TediousNText
// | TediousNVarChar
// | TediousNull
// | TediousNumeric
// | TediousReal
// | TediousSmallDateTime
// | TediousSmallInt
// | TediousSmallMoney
// | TediousTVP
// | TediousText
// | TediousTime
// | TediousTinyInt
// | TediousUDT
// | TediousUniqueIdentifier
// | TediousVarBinary
// | TediousVarChar
// | TediousXml


/** @internal */
interface TediousType extends Custom<"TediusType", Tedious.TediousType, unknown> { }
/** @internal */
const TediousType = Statement.custom<TediousType>("TediusType")

/** @internal */
interface TediousTime extends Custom<"TediusTime", unknown> { }
/** @internal */
const TediousTime = Statement.custom<TediousTime>("TediusTime")

/** @internal */
interface TediousDate extends Custom<"TediusDate", unknown> { }
/** @internal */
const TediousDate = Statement.custom<TediousDate>("TediusDate")

/** @internal */
interface TediousBigInt extends Custom<"TediusBigInt", BigInt> { }
/** @internal */
const TediousBigInt = Statement.custom<TediousBigInt>("TediusBigInt")

/** @internal */
interface TediousBinary extends Custom<"TediusBinary", boolean> { }
/** @internal */
const TediousBinary = Statement.custom<TediousBinary>("TediusBinary")

/** @internal */
interface TediousBit extends Custom<"TediusBit", 0 | 1> { }
/** @internal */
const TediousBit = Statement.custom<TediousBit>("TediusBit")

/** @internal */
interface TediousChar extends Custom<"TediusChar", string> { }
/** @internal */
const TediousChar = Statement.custom<TediousChar>("TediusChar")

/** @internal */
interface TediousDateTime2 extends Custom<"TediusDateTime2", Date> { }
/** @internal */
const TediousDateTime2 = Statement.custom<TediousDateTime2>("TediusDateTime2")

/** @internal */
interface TediousDateTime extends Custom<"TediusDateTime", Date> { }
/** @internal */
const TediousDateTime = Statement.custom<TediousDateTime>("TediusDateTime")

/** @internal */
interface TediousDateTimeOffset extends Custom<"TediusDateTimeOffset", string> { }
/** @internal */
const TediousDateTimeOffset = Statement.custom<TediousDateTimeOffset>("TediusDateTimeOffset")

/** @internal */
interface TediousFloat extends Custom<"TediusFloat", number> { }
/** @internal */
const TediousFloat = Statement.custom<TediousFloat>("TediusFloat")

/** @internal */
interface TediousDecimal extends Custom<"TediusDecimal", number> { }
/** @internal */
const TediousDecimal = Statement.custom<TediousDecimal>("TediusDecimal")

/** @internal */
interface TediousImage extends Custom<"TediusImage", number> { }
/** @internal */
const TediousImage = Statement.custom<TediousImage>("TediusImage")

/** @internal */
interface TediousInt extends Custom<"TediusInt", number> { }
/** @internal */
const TediousInt = Statement.custom<TediousInt>("TediusInt")

/** @internal */
interface TediousMoney extends Custom<"TediusMoney", number> { }
/** @internal */
const TediousMoney = Statement.custom<TediousMoney>("TediusMoney")

/** @internal */
interface TediousNChar extends Custom<"TediusNChar", number> { }
/** @internal */
const TediousNChar = Statement.custom<TediousNChar>("TediusNChar")

/** @internal */
interface TediousNText extends Custom<"TediusNText", number> { }
/** @internal */
const TediousNText = Statement.custom<TediousNText>("TediusNText")

/** @internal */
interface TediousNVarChar extends Custom<"TediusNVarChar", number> { }
/** @internal */
const TediousNVarChar = Statement.custom<TediousNVarChar>("TediusNVarChar")

/** @internal */
interface TediousNull extends Custom<"TediusNull", number> { }
/** @internal */
const TediousNull = Statement.custom<TediousNull>("TediusNull")

/** @internal */
interface TediousNumeric extends Custom<"TediusNumeric", number> { }
/** @internal */
const TediousNumeric = Statement.custom<TediousNumeric>("TediusNumeric")

/** @internal */
interface TediousReal extends Custom<"TediusReal", number> { }
/** @internal */
const TediousReal = Statement.custom<TediousReal>("TediusReal")

/** @internal */
interface TediousSmallDateTime extends Custom<"TediusSmallDateTime", number> { }
/** @internal */
const TediousSmallDateTime = Statement.custom<TediousSmallDateTime>("TediusSmallDateTime")

/** @internal */
interface TediousSmallInt extends Custom<"TediusSmallInt", number> { }
/** @internal */
const TediousSmallInt = Statement.custom<TediousSmallInt>("TediusSmallInt")

/** @internal */
interface TediousSmallMoney extends Custom<"TediusSmallMoney", number> { }
/** @internal */
const TediousSmallMoney = Statement.custom<TediousSmallMoney>("TediusSmallMoney")

/** @internal */
interface TediousTVP extends Custom<"TediusTVP", number> { }
/** @internal */
const TediousTVP = Statement.custom<TediousTVP>("TediusTVP")

/** @internal */
interface TediousText extends Custom<"TediusText", number> { }
/** @internal */
const TediousText = Statement.custom<TediousText>("TediusText")

/** @internal */
interface TediousTinyInt extends Custom<"TediusTinyInt", number> { }
/** @internal */
const TediousTinyInt = Statement.custom<TediousTinyInt>("TediusTinyInt")

/** @internal */
interface TediousUDT extends Custom<"TediusUDT", number> { }
/** @internal */
const TediousUDT = Statement.custom<TediousUDT>("TediusUDT")

/** @internal */
interface TediousUniqueIdentifier extends Custom<"TediusUniqueIdentifier", number> { }
/** @internal */
const TediousUniqueIdentifier = Statement.custom<TediousUniqueIdentifier>("TediusUniqueIdentifier")

/** @internal */
interface TediousVarBinary extends Custom<"TediusVarBinary", number> { }
/** @internal */
const TediousVarBinary = Statement.custom<TediousVarBinary>("TediusVarBinary")

/** @internal */
interface TediousVarChar extends Custom<"TediusVarChar", number> { }
/** @internal */
const TediousVarChar = Statement.custom<TediousVarChar>("TediusVarChar")

/** @internal */
interface TediousXml extends Custom<"TediusXml", number> { }
/** @internal */
const TediousXml = Statement.custom<TediousXml>("TediusXml")
