/* eslint-disable @typescript-eslint/ban-types */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { Tag } from "@effect/data/Context"
import * as Data from "@effect/data/Data"
import { pipe } from "@effect/data/Function"
import * as Option from "@effect/data/Option"
import { NoSuchElementException } from "@effect/io/Cause"
import * as Config from "@effect/io/Config"
import type { ConfigError } from "@effect/io/Config/Error"
import * as Deferred from "@effect/io/Deferred"
import * as Effect from "@effect/io/Effect"
import * as Layer from "@effect/io/Layer"
import * as Request from "@effect/io/Request"
import * as RequestResolver from "@effect/io/RequestResolver"
import type { Scope } from "@effect/io/Scope"
import { ParseError } from "@effect/schema/ParseResult"
import * as Schema from "@effect/schema/Schema"
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

export interface EffectPgError extends Data.Case {
  readonly _tag: "EffectPgError"
  readonly error: unknown
}
export const EffectPgError = Data.tagged<EffectPgError>("EffectPgError")

export interface EffectPg {
  /**
   * Execute the SQL query passed as a template string. Can only be used as template string tag.
   * @param template The template generated from the template string
   * @param parameters Interpoled values of the template string
   * @returns A promise resolving to the result of your query
   */
  <T extends readonly (object | undefined)[] = Record<string, any>[]>(
    template: TemplateStringsArray,
    ...parameters: readonly ParameterOrFragment<{}>[]
  ): Effect.Effect<never, EffectPgError, T>

  /**
   * Query helper
   * @param first Define how the helper behave
   * @param rest Other optional arguments, depending on the helper type
   * @returns An helper object usable as tagged template parameter in sql queries
   */
  <T, K extends Rest<T>>(first: T & First<T, K, {}>, ...rest: K): Return<T, K>

  readonly safe: EffectPg

  withTransaction<R, E, A>(
    self: Effect.Effect<R, E, A>,
  ): Effect.Effect<R, E | EffectPgError, A>

  resolver<
    R,
    A extends Request.Request<EffectPgError | ParseError, any>,
    I extends Record<string, any>,
  >(
    run: (
      requests: A[],
    ) => Effect.Effect<R, Request.Request.Error<A>, ReadonlyArray<I>>,
    schema: Schema.Schema<I, Request.Request.Success<A>>,
  ): RequestResolver.RequestResolver<A, R>

  voidResolver<
    R,
    A extends Request.Request<EffectPgError | ParseError, void>,
    X,
  >(
    run: (requests: A[]) => Effect.Effect<R, Request.Request.Error<A>, X>,
  ): RequestResolver.RequestResolver<A, R>

  idResolver<
    R,
    A extends Request.Request<
      EffectPgError | ParseError | NoSuchElementException,
      any
    >,
    I extends Record<string, any>,
    Id extends string | number,
  >(
    run: (
      requests: A[],
    ) => Effect.Effect<R, Request.Request.Error<A>, ReadonlyArray<I>>,
    schema: Schema.Schema<I, Request.Request.Success<A>>,
    requestId: (_: A) => Id,
    resultId: (_: I) => Id,
  ): RequestResolver.RequestResolver<A, R>
}

const PgSql = Tag<postgres.Sql<{}>>()

export const make = (
  options: postgres.Options<{}>,
): Effect.Effect<Scope, never, EffectPg> =>
  Effect.gen(function* (_) {
    const pgSql = postgres(options)
    const getSql = Effect.map(
      Effect.serviceOption(PgSql),
      Option.getOrElse(() => pgSql),
    )

    yield* _(Effect.addFinalizer(() => Effect.promise(() => pgSql.end())))

    const sql: EffectPg = ((
      template: TemplateStringsArray,
      ...params: readonly ParameterOrFragment<{}>[]
    ) => {
      if (!("raw" in template && Array.isArray(template.raw))) {
        return pgSql(template, ...(params as any))
      }

      return Effect.flatMap(getSql, pgSql =>
        Effect.asyncInterrupt<never, EffectPgError, unknown>(resume => {
          const query = pgSql(template, ...(params as any)).execute()

          query
            .then(_ => resume(Effect.succeed(_ as any)))
            .catch(error => resume(Effect.fail(EffectPgError({ error }))))

          return Effect.sync(() => query.cancel())
        }),
      )
    }) as any

    ;(sql as any).safe = sql

    sql.withTransaction = function withTransaction<R, E, A>(
      self: Effect.Effect<R, E, A>,
    ): Effect.Effect<R, E | EffectPgError, A> {
      return Effect.acquireUseRelease(
        pipe(
          Effect.all(getSql, Deferred.make<E, A>()),
          Effect.flatMap(([sql, deferred]) =>
            Effect.async<
              never,
              EffectPgError,
              readonly [postgres.Sql<{}>, Deferred.Deferred<E, A>]
            >(resume => {
              let done = false
              sql
                .begin(tSql => {
                  if (done) return
                  done = true
                  resume(Effect.succeed([tSql, deferred]))
                  return Effect.runPromise(Deferred.await(deferred))
                })
                .catch(error => {
                  if (done) return
                  done = true
                  resume(Effect.fail(EffectPgError({ error })))
                })
            }),
          ),
        ),
        ([sql]) => Effect.provideService(self, PgSql, sql),
        ([, deferred], exit) => Deferred.complete(deferred, exit),
      )
    }

    sql.resolver = function makePgResolver<
      R,
      A extends Request.Request<EffectPgError | ParseError, any>,
      I extends Record<string, any>,
    >(
      run: (
        requests: Array<A>,
      ) => Effect.Effect<R, Request.Request.Error<A>, ReadonlyArray<I>>,
      schema: Schema.Schema<I, Request.Request.Success<A>>,
    ): RequestResolver.RequestResolver<A, R> {
      const decode = Schema.decodeEffect(schema)
      return RequestResolver.makeBatched(requests =>
        pipe(
          run(requests),
          Effect.filterOrDie(
            results => results.length === requests.length,
            () => "sql.resolver requests to results length mismatch",
          ),
          Effect.flatMap(results =>
            Effect.forEachWithIndex(results, (result, i) =>
              pipe(
                decode(result),
                Effect.flatMap(result => Request.succeed(requests[i], result)),
                Effect.catchAll(error =>
                  Request.fail(requests[i], error as any),
                ),
              ),
            ),
          ),
          Effect.catchAll(error =>
            Effect.forEachDiscard(requests, request =>
              Request.fail(request, error),
            ),
          ),
        ),
      )
    }

    sql.voidResolver = function makePgVoidResolver<
      R,
      A extends Request.Request<EffectPgError | ParseError, void>,
    >(
      run: (
        requests: Array<A>,
      ) => Effect.Effect<R, Request.Request.Error<A>, void>,
    ): RequestResolver.RequestResolver<A, R> {
      return RequestResolver.makeBatched(requests =>
        pipe(
          run(requests),
          Effect.zipRight(
            Effect.forEachDiscard(requests, request =>
              Request.succeed(request, void 0 as any),
            ),
          ),
          Effect.catchAll(error =>
            Effect.forEachDiscard(requests, request =>
              Request.fail(request, error),
            ),
          ),
        ),
      )
    }

    sql.idResolver = function makePgIdResolver<
      R,
      A extends Request.Request<
        EffectPgError | ParseError | NoSuchElementException,
        any
      >,
      I extends Record<string, any>,
      Id extends string | number,
    >(
      run: (
        requests: Array<A>,
      ) => Effect.Effect<R, Request.Request.Error<A>, ReadonlyArray<I>>,
      schema: Schema.Schema<I, Request.Request.Success<A>>,
      requestId: (_: A) => Id,
      resultId: (_: I) => Id,
    ): RequestResolver.RequestResolver<A, R> {
      const decode = Schema.decodeEffect(schema)

      return RequestResolver.makeBatched(requests =>
        pipe(
          Effect.all({
            results: run(requests),
            requestsMap: Effect.sync(() =>
              requests.reduce(
                (acc, request) => acc.set(requestId(request), request),
                new Map<Id, A>(),
              ),
            ),
          }),
          Effect.tap(({ results, requestsMap }) =>
            Effect.forEachDiscard(results, result => {
              const id = resultId(result)
              const request = requestsMap.get(id)

              if (!request) {
                return Effect.unit()
              }

              requestsMap.delete(id)

              return pipe(
                decode(result),
                Effect.flatMap(result => Request.succeed(request, result)),
                Effect.catchAll(error => Request.fail(request, error as any)),
              )
            }),
          ),
          Effect.tap(({ requestsMap }) =>
            Effect.forEachDiscard(requestsMap.values(), request =>
              Request.fail(request, NoSuchElementException() as any),
            ),
          ),
          Effect.catchAll(error =>
            Effect.forEachDiscard(requests, request =>
              Request.fail(request, error as any),
            ),
          ),
        ),
      )
    }

    return sql
  })

export const tag: Tag<EffectPg, EffectPg> = Tag<EffectPg>()

export const makeLayer = (
  config: Config.Config.Wrap<postgres.Options<{}>>,
): Layer.Layer<never, ConfigError, EffectPg> =>
  Layer.scoped(tag, Effect.flatMap(Effect.config(Config.unwrap(config)), make))
