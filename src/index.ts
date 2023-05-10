/* eslint-disable @typescript-eslint/ban-types */
/* eslint-disable @typescript-eslint/no-explicit-any */
import * as Chunk from "@effect/data/Chunk"
import { Tag } from "@effect/data/Context"
import * as Option from "@effect/data/Option"
import { NoSuchElementException } from "@effect/io/Cause"
import * as Config from "@effect/io/Config"
import type { ConfigError } from "@effect/io/Config/Error"
import * as Effect from "@effect/io/Effect"
import * as Layer from "@effect/io/Layer"
import * as request from "@effect/io/Request"
import * as RequestResolver from "@effect/io/RequestResolver"
import type { Scope } from "@effect/io/Scope"
import * as Schema from "@effect/schema/Schema"
import {
  PostgresError,
  RequestError,
  ResultLengthMismatch,
  SchemaError,
} from "pgfx/Error"
import * as internal from "pgfx/internal/pgfx"
import postgres, { ParameterOrFragment } from "postgres"

type Rest<T> = T extends TemplateStringsArray
  ? never // force fallback to the tagged template function overload
  : T extends string
  ? readonly string[]
  : T extends readonly any[][]
  ? readonly []
  : T extends readonly (object & infer R)[]
  ? readonly (string & keyof R)[]
  : T extends readonly any[]
  ? readonly []
  : T extends object
  ? readonly (string & keyof T)[]
  : any

type SerializableObject<
  T,
  K extends readonly any[],
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

type First<T, K extends readonly any[], TT> =
  // Tagged template string call
  T extends TemplateStringsArray
    ? TemplateStringsArray
    : // Identifiers helper
    T extends string
    ? string
    : // Dynamic values helper (depth 2)
    T extends readonly any[][]
    ? readonly postgres.EscapableArray[]
    : // Insert/update helper (depth 2)
    T extends readonly (object & infer R)[]
    ? R extends postgres.SerializableParameter<TT>
      ? readonly postgres.SerializableParameter<TT>[]
      : readonly SerializableObject<R, K, TT>[]
    : // Dynamic values/ANY helper (depth 1)
    T extends readonly any[]
    ? readonly postgres.SerializableParameter<TT>[]
    : // Insert/update helper (depth 1)
    T extends object
    ? SerializableObject<T, K, TT>
    : // Unexpected type
      never

type Return<T, K extends readonly any[]> = [T] extends [TemplateStringsArray]
  ? [unknown] extends [T]
    ? postgres.Helper<T, K> // ensure no `PendingQuery` with `any` types
    : [TemplateStringsArray] extends [T]
    ? postgres.PendingQuery<postgres.Row[]>
    : postgres.Helper<T, K>
  : postgres.Helper<T, K>

export interface Request<T extends string, I, E, A>
  extends request.Request<RequestError | E, A> {
  readonly _tag: T
  readonly i0: I
}

export interface Resolver<T extends string, I, A, E> {
  readonly Request: request.Request.Constructor<Request<T, I, E, A>>
  readonly Resolver: RequestResolver.RequestResolver<Request<T, I, E, A>>
  execute(_: I): Effect.Effect<never, RequestError | E, A>
}

export interface PgFx {
  /**
   * Execute the SQL query passed as a template string. Can only be used as template string tag.
   * @param template The template generated from the template string
   * @param parameters Interpoled values of the template string
   * @returns A promise resolving to the result of your query
   */
  <T extends readonly (object | undefined)[] = Record<string, any>[]>(
    template: TemplateStringsArray,
    ...parameters: readonly ParameterOrFragment<{}>[]
  ): Effect.Effect<never, PostgresError, T>

  /**
   * Query helper
   * @param first Define how the helper behave
   * @param rest Other optional arguments, depending on the helper type
   * @returns An helper object usable as tagged template parameter in sql queries
   */
  <T, K extends Rest<T>>(first: T & First<T, K, {}>, ...rest: K): Return<T, K>

  readonly safe: PgFx
  readonly array: postgres.Sql["array"]
  readonly json: postgres.Sql["json"]

  describe(
    template: TemplateStringsArray,
    ...parameters: readonly ParameterOrFragment<{}>[]
  ): Effect.Effect<never, PostgresError, postgres.Statement>

  withTransaction<R, E, A>(
    self: Effect.Effect<R, E, A>,
  ): Effect.Effect<R, E | PostgresError, A>

  schema<II, IA, AI, A, R, E>(
    requestSchema: Schema.Schema<II, IA>,
    resultSchema: Schema.Schema<AI, A>,
    run: (_: IA) => Effect.Effect<R, E, ReadonlyArray<AI>>,
  ): (_: IA) => Effect.Effect<R, E | SchemaError, Chunk.Chunk<A>>

  singleSchema<II, IA, AI, A, R, E>(
    requestSchema: Schema.Schema<II, IA>,
    resultSchema: Schema.Schema<AI, A>,
    run: (_: IA) => Effect.Effect<R, E, ReadonlyArray<AI>>,
  ): (_: IA) => Effect.Effect<R, E | SchemaError | NoSuchElementException, A>

  singleSchemaOption<II, IA, AI, A, R, E>(
    requestSchema: Schema.Schema<II, IA>,
    resultSchema: Schema.Schema<AI, A>,
    run: (_: IA) => Effect.Effect<R, E, ReadonlyArray<AI>>,
  ): (_: IA) => Effect.Effect<R, E | SchemaError, Option.Option<A>>

  resolver<T extends string, II, IA, AI, A, E>(
    tag: T,
    requestSchema: Schema.Schema<II, IA>,
    resultSchema: Schema.Schema<AI, A>,
    run: (
      requests: ReadonlyArray<IA>,
    ) => Effect.Effect<never, PostgresError | E, ReadonlyArray<AI>>,
  ): Resolver<T, IA, A, E | ResultLengthMismatch>

  singleResolverOption<T extends string, II, IA, AI, A, E>(
    tag: T,
    requestSchema: Schema.Schema<II, IA>,
    resultSchema: Schema.Schema<AI, A>,
    run: (
      request: IA,
    ) => Effect.Effect<never, PostgresError | E, ReadonlyArray<AI>>,
  ): Resolver<T, IA, Option.Option<A>, E>

  singleResolver<T extends string, II, IA, AI, A, E>(
    tag: T,
    requestSchema: Schema.Schema<II, IA>,
    resultSchema: Schema.Schema<AI, A>,
    run: (
      request: IA,
    ) => Effect.Effect<never, PostgresError | E, ReadonlyArray<AI>>,
  ): Resolver<T, IA, A, E | NoSuchElementException>

  voidResolver<T extends string, II, IA, E, X>(
    tag: T,
    requestSchema: Schema.Schema<II, IA>,
    run: (
      requests: ReadonlyArray<IA>,
    ) => Effect.Effect<never, PostgresError | E, ReadonlyArray<X>>,
  ): Resolver<T, IA, void, E>

  idResolver<T extends string, II, Id, AI, A, E>(
    tag: T,
    requestSchema: Schema.Schema<II, Id>,
    resultSchema: Schema.Schema<AI, A>,
    resultId: (_: AI) => Id,
    run: (
      requests: ReadonlyArray<Id>,
    ) => Effect.Effect<never, PostgresError | E, ReadonlyArray<AI>>,
  ): Resolver<T, Id, Option.Option<A>, E>
}

export const make: (
  options: postgres.Options<{}>,
) => Effect.Effect<Scope, never, PgFx> = internal.make

export const tag: Tag<PgFx, PgFx> = internal.tag

export const makeLayer: (
  config: Config.Config.Wrap<postgres.Options<{}>>,
) => Layer.Layer<never, ConfigError, PgFx> = internal.makeLayer

// === export postgres helpers
export const { fromKebab, fromCamel, fromPascal, toCamel, toKebab, toPascal } =
  postgres
