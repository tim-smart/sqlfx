/**
 * @since 1.0.0
 */
import type { Context, Tag } from "@effect/data/Context"
import type * as Option from "@effect/data/Option"
import type * as Config from "@effect/io/Config"
import type { ConfigError } from "@effect/io/Config/Error"
import type * as Effect from "@effect/io/Effect"
import type * as Layer from "@effect/io/Layer"
import type * as request from "@effect/io/Request"
import type * as RequestResolver from "@effect/io/RequestResolver"
import type { Scope } from "@effect/io/Scope"
import type * as Schema from "@effect/schema/Schema"
import type {
  PostgresError,
  RequestError,
  ResultLengthMismatch,
  SchemaError,
} from "pgfx/Error"
import * as internal from "pgfx/internal_effect_untraced/pgfx"
import type { ParameterOrFragment, ParameterOrJSON } from "postgres"
import postgres from "postgres"

type Rest<T> = T extends TemplateStringsArray
  ? never // force fallback to the tagged template function overload
  : T extends string
  ? ReadonlyArray<string>
  : T extends ReadonlyArray<Array<any>>
  ? readonly []
  : T extends ReadonlyArray<object & infer R>
  ? ReadonlyArray<string & keyof R>
  : T extends ReadonlyArray<any>
  ? readonly []
  : T extends object
  ? ReadonlyArray<string & keyof T>
  : any

type SerializableObject<
  T,
  K extends ReadonlyArray<any>,
  TT,
> = number extends K["length"]
  ? {}
  : Partial<
      Record<
        string & keyof T & (K["length"] extends 0 ? string : K[number]),
        postgres.ParameterOrJSON<TT> | undefined
      > &
        Record<string, any>
    >

type First<T, K extends ReadonlyArray<any>, TT> =
  // Tagged template string call
  T extends TemplateStringsArray
    ? TemplateStringsArray
    : // Identifiers helper
    T extends string
    ? string
    : // Dynamic values helper (depth 2)
    T extends ReadonlyArray<Array<any>>
    ? ReadonlyArray<postgres.EscapableArray>
    : // Insert/update helper (depth 2)
    T extends ReadonlyArray<object & infer R>
    ? R extends postgres.SerializableParameter<TT>
      ? ReadonlyArray<postgres.SerializableParameter<TT>>
      : ReadonlyArray<SerializableObject<R, K, TT>>
    : // Dynamic values/ANY helper (depth 1)
    T extends ReadonlyArray<any>
    ? ReadonlyArray<postgres.SerializableParameter<TT>>
    : // Insert/update helper (depth 1)
    T extends object
    ? SerializableObject<T, K, TT>
    : // Unexpected type
      never

type PgValuesResult<A extends Record<string, unknown>> =
  postgres.PendingValuesQuery<ReadonlyArray<A>> extends Promise<infer T>
    ? T
    : never

/**
 * @category models
 * @since 1.0.0
 */
export interface Request<T extends string, I, E, A>
  extends request.Request<RequestError | E, A> {
  readonly _tag: T
  readonly i0: I
}

/**
 * @category models
 * @since 1.0.0
 */
export interface Resolver<T extends string, II, IA, A, E> {
  readonly Request: request.Request.Constructor<Request<T, II, E, A>, "_tag">
  readonly Resolver: RequestResolver.RequestResolver<Request<T, II, E, A>>
  execute(_: IA): Effect.Effect<never, RequestError | E, A>
  populateCache(id: II, _: A): Effect.Effect<never, never, void>
  invalidateCache(id: II): Effect.Effect<never, never, void>
}

/**
 * @category models
 * @since 1.0.0
 */
export interface SqlFragment {
  readonly _: unique symbol
}

/**
 * @category models
 * @since 1.0.0
 */
export interface PgFx {
  /**
   * Create an Effect from an sql query
   */
  <T extends Record<string, any>>(
    template: TemplateStringsArray,
    ...parameters: ReadonlyArray<ParameterOrFragment<{}>>
  ): Effect.Effect<never, PostgresError, ReadonlyArray<T>>

  /**
   * Query helper
   */
  <T, K extends Rest<T>>(first: T & First<T, K, {}>, ...rest: K): SqlFragment

  /**
   * Create an Effect from an sql query, returning rows as arrays
   */
  readonly values: <T extends Record<string, any>>(
    template: TemplateStringsArray,
    ...parameters: ReadonlyArray<ParameterOrFragment<{}>>
  ) => Effect.Effect<never, PostgresError, PgValuesResult<T>>

  /**
   * Copy of `sql` for use as a safeql target
   */
  readonly safe: PgFx

  /**
   * Create unsafe SQL query
   */
  readonly unsafe: (
    query: string,
    parameters?: Array<ParameterOrJSON<{}>> | undefined,
    queryOptions?: postgres.UnsafeQueryOptions | undefined,
  ) => SqlFragment

  /**
   * Create a SQL fragment
   */
  readonly $: (
    template: TemplateStringsArray,
    ...parameters: ReadonlyArray<ParameterOrFragment<{}>>
  ) => SqlFragment

  /**
   * Create an array parameter
   */
  readonly array: postgres.Sql["array"]

  /**
   * Create a JSON value
   */
  readonly json: postgres.Sql["json"]

  /**
   * Create an `AND` chain for a where clause
   */
  readonly and: (clauses: ReadonlyArray<SqlFragment | string>) => SqlFragment

  /**
   * Create an `OR` chain for a where clause
   */
  readonly or: (clauses: ReadonlyArray<SqlFragment | string>) => SqlFragment

  /**
   * Create comma seperated values, with an optional prefix
   */
  readonly csv: {
    (clauses: ReadonlyArray<SqlFragment | string>): SqlFragment
    (prefix: string, clauses: ReadonlyArray<SqlFragment | string>): SqlFragment
  }

  /**
   * Describe the given sql
   */
  describe(
    template: TemplateStringsArray,
    ...parameters: ReadonlyArray<ParameterOrFragment<{}>>
  ): Effect.Effect<never, PostgresError, postgres.Statement>

  /**
   * With the given effect, ensure all sql queries are run in a transaction.
   *
   * Note: This will not include query run inside request resolvers.
   */
  withTransaction<R, E, A>(
    self: Effect.Effect<R, E, A>,
  ): Effect.Effect<R, E | PostgresError, A>

  /**
   * Run a sql query with a request schema and a result schema.
   *
   * The request schema is used to validate the input of the query.
   * The result schema is used to validate the output of the query.
   */
  schema<II, IA, AI, A, R, E>(
    requestSchema: Schema.Schema<II, IA>,
    resultSchema: Schema.Schema<AI, A>,
    run: (_: II) => Effect.Effect<R, E, ReadonlyArray<AI>>,
  ): (_: IA) => Effect.Effect<R, E | SchemaError, ReadonlyArray<A>>

  /**
   * Run a sql query with a request schema and a result schema.
   *
   * The request schema is used to validate the input of the query.
   * The result schema is used to validate the output of the query.
   *
   * Takes the first result of the query.
   */
  singleSchema<II, IA, AI, A, R, E>(
    requestSchema: Schema.Schema<II, IA>,
    resultSchema: Schema.Schema<AI, A>,
    run: (_: II) => Effect.Effect<R, E, ReadonlyArray<AI>>,
  ): (_: IA) => Effect.Effect<R, E | SchemaError, A>

  /**
   * Run a sql query with a request schema and a result schema.
   *
   * The request schema is used to validate the input of the query.
   * The result schema is used to validate the output of the query.
   *
   * Returns an Option of the first result of the query.
   */
  singleSchemaOption<II, IA, AI, A, R, E>(
    requestSchema: Schema.Schema<II, IA>,
    resultSchema: Schema.Schema<AI, A>,
    run: (_: II) => Effect.Effect<R, E, ReadonlyArray<AI>>,
  ): (_: IA) => Effect.Effect<R, E | SchemaError, Option.Option<A>>

  /**
   * Create a resolver for a sql query with a request schema and a result schema.
   *
   * Takes a tag parameter to identify the requests.
   *
   * The request schema is used to validate the input of the query.
   * The result schema is used to validate the output of the query.
   *
   * Returns a resolver, request and a execute function.
   */
  resolver<T extends string, II, IA, AI, A, E>(
    tag: T,
    requestSchema: Schema.Schema<II, IA>,
    resultSchema: Schema.Schema<AI, A>,
    run: (
      requests: ReadonlyArray<II>,
    ) => Effect.Effect<never, PostgresError | E, ReadonlyArray<AI>>,
    context?: Context<any>,
  ): Resolver<T, II, IA, A, E | ResultLengthMismatch>

  /**
   * Create a resolver for a sql query with a request schema and a result schema.
   * Returns an Option of the first result of the query.
   *
   * Takes a tag parameter to identify the requests.
   *
   * The request schema is used to validate the input of the query.
   * The result schema is used to validate the output of the query.
   *
   * Returns a resolver, request and a execute function.
   */
  singleResolverOption<T extends string, II, IA, AI, A, E>(
    tag: T,
    requestSchema: Schema.Schema<II, IA>,
    resultSchema: Schema.Schema<AI, A>,
    run: (
      request: II,
    ) => Effect.Effect<never, PostgresError | E, ReadonlyArray<AI>>,
    context?: Context<any>,
  ): Resolver<T, II, IA, Option.Option<A>, E>

  /**
   * Create a resolver for a sql query with a request schema and a result schema.
   * Returns the first result of the query.
   *
   * Takes a tag parameter to identify the requests.
   *
   * The request schema is used to validate the input of the query.
   * The result schema is used to validate the output of the query.
   *
   * Returns a resolver, request and a execute function.
   */
  singleResolver<T extends string, II, IA, AI, A, E>(
    tag: T,
    requestSchema: Schema.Schema<II, IA>,
    resultSchema: Schema.Schema<AI, A>,
    run: (
      request: II,
    ) => Effect.Effect<never, PostgresError | E, ReadonlyArray<AI>>,
    context?: Context<any>,
  ): Resolver<T, II, IA, A, E>

  /**
   * Create a resolver for a sql query with a request schema.
   * Returns no result.
   *
   * Takes a tag parameter to identify the requests.
   *
   * The request schema is used to validate the input of the query.
   *
   * Returns a resolver, request and a execute function.
   */
  voidResolver<T extends string, II, IA, E, X>(
    tag: T,
    requestSchema: Schema.Schema<II, IA>,
    run: (
      requests: ReadonlyArray<II>,
    ) => Effect.Effect<never, PostgresError | E, ReadonlyArray<X>>,
    context?: Context<any>,
  ): Resolver<T, II, IA, void, E>

  /**
   * Create a resolver for a sql query with a request schema and a result schema.
   * Returns an Option of the potentially matching result.
   *
   * Takes a tag parameter to identify the requests.
   * Takes a function to extract the id from the result.
   *
   * Returns a resolver, request and an execute function.
   */
  idResolver<T extends string, II, IA, AI, A, E>(
    tag: T,
    requestSchema: Schema.Schema<II, IA>,
    resultSchema: Schema.Schema<AI, A>,
    resultId: (_: AI) => II,
    run: (
      requests: ReadonlyArray<II>,
    ) => Effect.Effect<never, PostgresError | E, ReadonlyArray<AI>>,
    context?: Context<any>,
  ): Resolver<T, II, IA, Option.Option<A>, E>
}

/**
 * @category constructor
 * @since 1.0.0
 */
export const make: (
  options: postgres.Options<{}>,
) => Effect.Effect<Scope, never, PgFx> = internal.make

/**
 * @category tag
 * @since 1.0.0
 */
export const tag: Tag<PgFx, PgFx> = internal.tag

/**
 * @category constructor
 * @since 1.0.0
 */
export const makeLayer: (
  config: Config.Config.Wrap<postgres.Options<{}>>,
) => Layer.Layer<never, ConfigError, PgFx> = internal.makeLayer

// === export postgres helpers
const { fromCamel, fromKebab, fromPascal, toCamel, toKebab, toPascal } =
  postgres

export {
  /**
   * @category transform
   * @since 1.0.0
   */
  fromCamel,
  /**
   * @category transform
   * @since 1.0.0
   */
  fromKebab,
  /**
   * @category transform
   * @since 1.0.0
   */
  fromPascal,
  /**
   * @category transform
   * @since 1.0.0
   */
  toCamel,
  /**
   * @category transform
   * @since 1.0.0
   */
  toKebab,
  /**
   * @category transform
   * @since 1.0.0
   */
  toPascal,
}
