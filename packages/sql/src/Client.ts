/**
 * @since 1.0.0
 */
import type { Context } from "@effect/data/Context"
import type { Option } from "@effect/data/Option"
import type * as Effect from "@effect/io/Effect"
import type * as request from "@effect/io/Request"
import type * as RequestResolver from "@effect/io/RequestResolver"
import type * as Schema from "@effect/schema/Schema"
import type { Connection, Row } from "@sqlfx/sql/Connection"
import type {
  ResultLengthMismatch,
  SchemaError,
  SqlError,
} from "@sqlfx/sql/Error"
import type {
  Constructor,
  Fragment,
  Primitive,
  Statement,
} from "@sqlfx/sql/Statement"
import * as internal from "@sqlfx/sql/internal_effect_untraced/client"

/**
 * @category model
 * @since 1.0.0
 */
export interface Client extends Constructor {
  /**
   * Copy of the client for safeql etc.
   */
  readonly safe: this

  /**
   * Create unsafe SQL query
   */
  readonly unsafe: <A extends Row>(
    sql: string,
    params?: ReadonlyArray<Primitive> | undefined,
  ) => Statement<A>

  /**
   * Create an `AND` chain for a where clause
   */
  readonly and: (clauses: ReadonlyArray<string | Fragment>) => Fragment

  /**
   * Create an `OR` chain for a where clause
   */
  readonly or: (clauses: ReadonlyArray<string | Fragment>) => Fragment

  /**
   * Create comma seperated values, with an optional prefix
   *
   * Useful for `ORDER BY` and `GROUP BY` clauses
   */
  readonly csv: {
    (values: ReadonlyArray<string | Fragment>): Fragment
    (prefix: string, values: ReadonlyArray<string | Fragment>): Fragment
  }

  readonly join: (
    literal: string,
    addParens?: boolean,
    fallback?: string,
  ) => (clauses: ReadonlyArray<string | Fragment>) => Fragment

  /**
   * With the given effect, ensure all sql queries are run in a transaction.
   *
   * Note: This will not include query run inside request resolvers.
   */
  withTransaction<R, E, A>(
    self: Effect.Effect<R, E, A>,
  ): Effect.Effect<R, E | SqlError, A>

  /**
   * Run a sql query with a request schema and a result schema.
   *
   * The request schema is used to validate the input of the query.
   * The result schema is used to validate the output of the query.
   */
  schema<II, IA, AI extends Row, A, R, E>(
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
  singleSchema<II, IA, AI extends Row, A, R, E>(
    requestSchema: Schema.Schema<II, IA>,
    resultSchema: Schema.Schema<AI, A>,
    run: (_: II) => Effect.Effect<R, E, ReadonlyArray<Row>>,
  ): (_: IA) => Effect.Effect<R, E | SchemaError, A>

  /**
   * Run a sql query with a request schema and a result schema.
   *
   * The request schema is used to validate the input of the query.
   * The result schema is used to validate the output of the query.
   *
   * Returns an Option of the first result of the query.
   */
  singleSchemaOption<II, IA, AI extends Row, A, R, E>(
    requestSchema: Schema.Schema<II, IA>,
    resultSchema: Schema.Schema<AI, A>,
    run: (_: II) => Effect.Effect<R, E, ReadonlyArray<Row>>,
  ): (_: IA) => Effect.Effect<R, E | SchemaError, Option<A>>

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
  resolver<T extends string, II, IA, AI extends Row, A, E>(
    tag: T,
    requestSchema: Schema.Schema<II, IA>,
    resultSchema: Schema.Schema<AI, A>,
    run: (
      requests: ReadonlyArray<II>,
    ) => Effect.Effect<never, E, ReadonlyArray<Row>>,
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
  singleResolverOption<T extends string, II, IA, AI extends Row, A, E>(
    tag: T,
    requestSchema: Schema.Schema<II, IA>,
    resultSchema: Schema.Schema<AI, A>,
    run: (request: II) => Effect.Effect<never, E, ReadonlyArray<Row>>,
    context?: Context<any>,
  ): Resolver<T, II, IA, Option<A>, E>

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
  singleResolver<T extends string, II, IA, AI extends Row, A, E>(
    tag: T,
    requestSchema: Schema.Schema<II, IA>,
    resultSchema: Schema.Schema<AI, A>,
    run: (request: II) => Effect.Effect<never, E, ReadonlyArray<Row>>,
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
  voidResolver<T extends string, II, IA, E>(
    tag: T,
    requestSchema: Schema.Schema<II, IA>,
    run: (
      requests: ReadonlyArray<II>,
    ) => Effect.Effect<never, E, ReadonlyArray<Row>>,
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
  idResolver<T extends string, II, IA, AI extends Row, A, E>(
    tag: T,
    requestSchema: Schema.Schema<II, IA>,
    resultSchema: Schema.Schema<AI, A>,
    resultId: (_: AI) => II,
    run: (
      requests: ReadonlyArray<II>,
    ) => Effect.Effect<never, E, ReadonlyArray<AI>>,
    context?: Context<any>,
  ): Resolver<T, II, IA, Option<A>, E>
}

/**
 * @category constructor
 * @since 1.0.0
 */
export const make: (
  acquirer: Connection.Acquirer,
  transactionAcquirer: Connection.Acquirer,
) => Client = internal.make

/**
 * @category models
 * @since 1.0.0
 */
export interface Request<T extends string, I, E, A>
  extends request.Request<SchemaError | E, A> {
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
  readonly execute: (_: IA) => Effect.Effect<never, SchemaError | E, A>
  readonly populateCache: (id: II, _: A) => Effect.Effect<never, never, void>
  readonly invalidateCache: (id: II) => Effect.Effect<never, never, void>
}
