/**
 * @since 1.0.0
 */
import { Tag } from "effect/Context"
import * as Duration from "effect/Duration"
import { pipe } from "effect/Function"
import * as Config from "effect/Config"
import type { ConfigError } from "effect/ConfigError"
import * as ConfigSecret from "effect/ConfigSecret"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import type { Scope } from "effect/Scope"
import * as Stream from "effect/Stream"
import * as Client from "@sqlfx/sql/Client"
import type { Connection } from "@sqlfx/sql/Connection"
import { SqlError } from "@sqlfx/sql/Error"
import type { Custom, Fragment, Primitive } from "@sqlfx/sql/Statement"
import * as Statement from "@sqlfx/sql/Statement"
import * as transform from "@sqlfx/sql/Transform"
import type { PendingQuery, PendingValuesQuery } from "postgres"
import postgres from "postgres"

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
export interface PgClient extends Client.Client {
  readonly config: PgClientConfig

  readonly json: (_: unknown) => Fragment
  readonly array: (_: ReadonlyArray<Primitive>) => Fragment
}

/**
 * @category tag
 * @since 1.0.0
 */
export const tag = Tag<PgClient>()

/**
 * @category constructor
 * @since 1.0.0
 */
export interface PgClientConfig {
  readonly url?: ConfigSecret.ConfigSecret

  readonly host?: string
  readonly port?: number
  readonly path?: string
  readonly ssl?: boolean
  readonly database?: string
  readonly username?: string
  readonly password?: ConfigSecret.ConfigSecret

  readonly idleTimeout?: Duration.DurationInput
  readonly connectTimeout?: Duration.DurationInput

  readonly maxConnections?: number
  readonly connectionTTL?: Duration.DurationInput

  readonly transformResultNames?: (str: string) => string
  readonly transformQueryNames?: (str: string) => string
  readonly transformJson?: boolean
  readonly fetchTypes?: boolean
}

const escape = Statement.defaultEscape('"')

/**
 * @category constructor
 * @since 1.0.0
 */
export const make = (
  options: PgClientConfig,
): Effect.Effect<Scope, never, PgClient> =>
  Effect.gen(function* (_) {
    const compiler = makeCompiler(
      options.transformQueryNames,
      options.transformJson,
    )

    const transformRows = Client.defaultTransforms(
      options.transformResultNames!,
      options.transformJson,
    ).array

    const opts: postgres.Options<{}> = {
      max: options.maxConnections ?? 10,
      max_lifetime: options.connectionTTL
        ? Math.round(
            Duration.toMillis(Duration.decode(options.connectionTTL)) / 1000,
          )
        : undefined,
      idle_timeout: options.idleTimeout
        ? Math.round(
            Duration.toMillis(Duration.decode(options.idleTimeout)) / 1000,
          )
        : undefined,
      connect_timeout: options.connectTimeout
        ? Math.round(
            Duration.toMillis(Duration.decode(options.connectTimeout)) / 1000,
          )
        : undefined,

      host: options.host,
      port: options.port,
      ssl: options.ssl,
      path: options.path,
      database: options.database,
      username: options.username,
      password: options.password
        ? ConfigSecret.value(options.password)
        : undefined,
      fetch_types: options.fetchTypes,
    }

    const client = options.url
      ? postgres(ConfigSecret.value(options.url), opts)
      : postgres(opts)

    yield* _(Effect.addFinalizer(() => Effect.sync(() => client.end())))

    const handleError = (u: unknown) => {
      const error = u as any
      return SqlError(error.message, { ...error.__proto__ })
    }

    class ConnectionImpl implements Connection {
      constructor(
        private readonly pg: postgres.Sql<{}>,
        private readonly options: PgClientConfig,
      ) {}

      private run(query: PendingQuery<any> | PendingValuesQuery<any>) {
        return Effect.async<never, SqlError, ReadonlyArray<any>>(resume => {
          query
            .then(_ => resume(Effect.succeed(_)))
            .catch(error => resume(Effect.fail(handleError(error))))
          return Effect.sync(() => query.cancel())
        })
      }

      private runTransform(query: PendingQuery<any>) {
        return this.options.transformResultNames
          ? Effect.map(this.run(query), transformRows)
          : this.run(query)
      }

      execute(statement: Statement.Statement<unknown>) {
        const [sql, params] = compiler.compile(statement)
        return this.runTransform(this.pg.unsafe(sql, params as any))
      }
      executeWithoutTransform(statement: Statement.Statement<unknown>) {
        const [sql, params] = compiler.compile(statement)
        return this.run(this.pg.unsafe(sql, params as any))
      }
      executeValues(statement: Statement.Statement<unknown>) {
        const [sql, params] = compiler.compile(statement)
        return this.run(this.pg.unsafe(sql, params as any).values())
      }
      executeRaw(sql: string, params?: ReadonlyArray<Primitive>) {
        return this.runTransform(this.pg.unsafe(sql, params as any))
      }
      executeStream(statement: Statement.Statement<unknown>) {
        const [sql, params] = compiler.compile(statement)
        return pipe(
          Effect.sync(
            () =>
              this.pg.unsafe(sql, params as any).cursor(16) as AsyncIterable<
                Array<any>
              >,
          ),
          Effect.map(_ =>
            Stream.fromAsyncIterable(_, e =>
              SqlError((e as Error).message, { ...(e as any).__proto__ }),
            ),
          ),
          Stream.unwrap,
          Stream.flatMap(_ =>
            Stream.fromIterable(
              options.transformResultNames ? transformRows(_) : _,
            ),
          ),
        )
      }
    }

    return Object.assign(
      Client.make({
        acquirer: Effect.succeed(new ConnectionImpl(client, options)),
        transactionAcquirer: Effect.map(
          Effect.acquireRelease(
            Effect.tryPromise({
              try: () => client.reserve(),
              catch: error => handleError(error),
            }),
            pg => Effect.sync(() => pg.release()),
          ),
          _ => new ConnectionImpl(_, options),
        ),
        compiler,
      }),
      {
        config: options,
        json: (_: unknown) => PgJson(_),
        array: (_: ReadonlyArray<Primitive>) => PgArray(_),
      },
    )
  })

/**
 * @category constructor
 * @since 1.0.0
 */
export const makeLayer: (
  config: Config.Config.Wrap<PgClientConfig>,
) => Layer.Layer<never, ConfigError, PgClient> = (
  config: Config.Config.Wrap<PgClientConfig>,
) =>
  Layer.scoped(tag, Effect.flatMap(Effect.config(Config.unwrap(config)), make))

/**
 * @category constructor
 * @since 1.0.0
 */
export const makeCompiler = (
  transform?: (_: string) => string,
  transformJson = true,
): Statement.Compiler => {
  const pg = postgres({ max: 0 })

  const transformValue =
    transformJson && transform
      ? Client.defaultTransforms(transform).value
      : undefined

  return Statement.makeCompiler<PgCustom>(
    _ => `$${_}`,
    transform ? _ => escape(transform(_)) : escape,
    (placeholders, valueAlias, valueColumns, values) => [
      `(values ${placeholders}) AS ${valueAlias}${valueColumns}`,
      values.flat(),
    ],
    (type, placeholder) => {
      switch (type.kind) {
        case "PgJson": {
          return [
            placeholder(),
            [
              pg.json(
                transformValue !== undefined
                  ? transformValue(type.i0)
                  : type.i0,
              ) as any,
            ],
          ]
        }
        case "PgArray": {
          return [`ARRAY [${type.i0.map(placeholder).join(",")}]`, type.i0]
        }
      }
    },
  )
}

// custom types

type PgCustom = PgJson | PgArray

/** @internal */
interface PgJson extends Custom<"PgJson", unknown> {}
/** @internal */
const PgJson = Statement.custom<PgJson>("PgJson")

/** @internal */
interface PgArray extends Custom<"PgArray", ReadonlyArray<Primitive>> {}
/** @internal */
const PgArray = Statement.custom<PgArray>("PgArray")
