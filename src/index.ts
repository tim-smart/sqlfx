/* eslint-disable @typescript-eslint/ban-types */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { Tag } from "@effect/data/Context"
import * as Data from "@effect/data/Data"
import { pipe } from "@effect/data/Function"
import * as Option from "@effect/data/Option"
import * as Config from "@effect/io/Config"
import type { ConfigError } from "@effect/io/Config/Error"
import * as Deferred from "@effect/io/Deferred"
import * as Effect from "@effect/io/Effect"
import * as Layer from "@effect/io/Layer"
import * as request from "@effect/io/Request"
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

export interface PostgresError extends Data.Case {
  readonly _tag: "PostgresError"
  readonly error: postgres.Error
}
export const PostgresError = Data.tagged<PostgresError>("PostgresError")

export type RequestError = ParseError | PostgresError

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

  describe(
    template: TemplateStringsArray,
    ...parameters: readonly ParameterOrFragment<{}>[]
  ): Effect.Effect<never, PostgresError, postgres.Statement>

  withTransaction<R, E, A>(
    self: Effect.Effect<R, E, A>,
  ): Effect.Effect<R, E | PostgresError, A>

  resolver<T extends string, II, IA, AI, A, E>(
    tag: T,
    requestSchema: Schema.Schema<II, IA>,
    resultSchema: Schema.Schema<AI, A>,
    run: (
      requests: ReadonlyArray<IA>,
    ) => Effect.Effect<never, RequestError | E, ReadonlyArray<AI>>,
  ): Resolver<T, IA, A, E>

  singleResolver<T extends string, II, IA, AI, A, E>(
    tag: T,
    requestSchema: Schema.Schema<II, IA>,
    resultSchema: Schema.Schema<AI, A>,
    run: (
      request: IA,
    ) => Effect.Effect<never, RequestError | E, ReadonlyArray<AI>>,
  ): Resolver<T, IA, A, E>

  voidResolver<T extends string, II, IA, E, X>(
    tag: T,
    requestSchema: Schema.Schema<II, IA>,
    run: (
      requests: ReadonlyArray<IA>,
    ) => Effect.Effect<never, RequestError | E, ReadonlyArray<X>>,
  ): Resolver<T, IA, void, E>

  idResolver<T extends string, II, Id, AI, A, E>(
    tag: T,
    requestSchema: Schema.Schema<II, Id>,
    resultSchema: Schema.Schema<AI, A>,
    resultId: (_: AI) => Id,
    run: (
      requests: ReadonlyArray<Id>,
    ) => Effect.Effect<never, RequestError | E, ReadonlyArray<AI>>,
  ): Resolver<T, Id, Option.Option<A>, E>
}

const PgSql = Tag<postgres.Sql<{}>>()

export const make = (
  options: postgres.Options<{}>,
): Effect.Effect<Scope, never, PgFx> =>
  Effect.gen(function* (_) {
    const pgSql = postgres(options)
    const getSql = Effect.map(
      Effect.serviceOption(PgSql),
      Option.getOrElse(() => pgSql),
    )

    yield* _(Effect.addFinalizer(() => Effect.promise(() => pgSql.end())))

    const sql: PgFx = ((
      template: TemplateStringsArray,
      ...params: readonly ParameterOrFragment<{}>[]
    ) => {
      if (!("raw" in template && Array.isArray(template.raw))) {
        return pgSql(template, ...(params as any))
      }

      return Effect.flatMap(getSql, pgSql =>
        Effect.asyncInterrupt<never, PostgresError, unknown>(resume => {
          const query = pgSql(template, ...(params as any)).execute()

          query
            .then(_ => resume(Effect.succeed(_ as any)))
            .catch(error => resume(Effect.fail(PostgresError({ error }))))

          return Effect.sync(() => query.cancel())
        }),
      )
    }) as any

    ;(sql as any).safe = sql

    sql.describe = function describe(
      template: TemplateStringsArray,
      ...params: readonly ParameterOrFragment<{}>[]
    ) {
      return Effect.flatMap(getSql, pgSql =>
        Effect.async<never, PostgresError, postgres.Statement>(resume => {
          const query = pgSql(template, ...(params as any)).describe()

          query
            .then(_ => resume(Effect.succeed(_)))
            .catch(error => resume(Effect.fail(PostgresError({ error }))))
        }),
      )
    }

    sql.withTransaction = function withTransaction<R, E, A>(
      self: Effect.Effect<R, E, A>,
    ): Effect.Effect<R, E | PostgresError, A> {
      return Effect.acquireUseRelease(
        pipe(
          Effect.all(getSql, Deferred.make<E, A>()),
          Effect.flatMap(([sql, deferred]) =>
            Effect.async<
              never,
              PostgresError,
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
                  resume(Effect.fail(PostgresError({ error })))
                })
            }),
          ),
        ),
        ([sql]) => Effect.provideService(self, PgSql, sql),
        ([, deferred], exit) => Deferred.complete(deferred, exit),
      )
    }

    sql.resolver = function makeResolver<T extends string, II, IA, AI, A, E>(
      tag: T,
      requestSchema: Schema.Schema<II, IA>,
      resultSchema: Schema.Schema<AI, A>,
      run: (
        requests: ReadonlyArray<IA>,
      ) => Effect.Effect<never, RequestError | E, ReadonlyArray<AI>>,
    ): Resolver<T, IA, A, E> {
      const Request = request.tagged<Request<T, IA, E, A>>(tag)
      const decode = Schema.decodeEffect(resultSchema)
      const Resolver = RequestResolver.makeBatched(
        (requests: Request<T, IA, E, A>[]) =>
          pipe(
            run(requests.map(_ => _.i0)),
            Effect.filterOrDie(
              results => results.length === requests.length,
              () => "sql.resolver requests to results length mismatch",
            ),
            Effect.flatMap(results =>
              Effect.forEachWithIndex(results, (result, i) =>
                pipe(
                  decode(result),
                  Effect.flatMap(result =>
                    request.succeed(requests[i], result),
                  ),
                  Effect.catchAll(error =>
                    request.fail(requests[i], error as any),
                  ),
                ),
              ),
            ),
            Effect.catchAll(error =>
              Effect.forEachDiscard(requests, req => request.fail(req, error)),
            ),
          ),
      )
      const validate = Schema.validateEffect(requestSchema)
      const execute = (_: IA) =>
        Effect.flatMap(validate(_), i0 =>
          Effect.request(Request({ i0 }), Resolver),
        )

      return { Request, Resolver, execute }
    }

    sql.singleResolver = function makeSingleResolver<
      T extends string,
      II,
      IA,
      AI,
      A,
      E,
    >(
      tag: T,
      requestSchema: Schema.Schema<II, IA>,
      resultSchema: Schema.Schema<AI, A>,
      run: (
        request: IA,
      ) => Effect.Effect<never, RequestError | E, ReadonlyArray<AI>>,
    ): Resolver<T, IA, A, E> {
      const Request = request.tagged<Request<T, IA, E, A>>(tag)
      const decode = Schema.decodeEffect(resultSchema)
      const Resolver = RequestResolver.fromFunctionEffect(
        (req: Request<T, IA, E, A>) =>
          pipe(
            run(req.i0),
            Effect.filterOrDieMessage(
              _ => _.length === 1,
              "resolverSingle did not get one result",
            ),
            Effect.flatMap(result => decode(result[0])),
          ),
      )
      const validate = Schema.validateEffect(requestSchema)
      const execute = (_: IA) =>
        Effect.flatMap(validate(_), i0 =>
          Effect.request(Request({ i0 }), Resolver),
        )

      return { Request, Resolver, execute }
    }

    sql.voidResolver = function makeVoidResolver<
      T extends string,
      II,
      IA,
      E,
      X,
    >(
      tag: T,
      requestSchema: Schema.Schema<II, IA>,
      run: (
        requests: ReadonlyArray<IA>,
      ) => Effect.Effect<never, RequestError | E, ReadonlyArray<X>>,
    ): Resolver<T, IA, void, E> {
      const Request = request.tagged<Request<T, IA, E, void>>(tag)
      const Resolver = RequestResolver.makeBatched(
        (requests: Request<T, IA, E, void>[]) =>
          pipe(
            run(requests.map(_ => _.i0)),
            Effect.zipRight(
              Effect.forEachDiscard(requests, req =>
                request.succeed(req, void 0 as any),
              ),
            ),
            Effect.catchAll(error =>
              Effect.forEachDiscard(requests, req => request.fail(req, error)),
            ),
          ),
      )
      const validate = Schema.validateEffect(requestSchema)
      const execute = (_: IA) =>
        Effect.flatMap(validate(_), i0 =>
          Effect.request(Request({ i0 }), Resolver),
        )

      return { Request, Resolver, execute }
    }

    sql.idResolver = function makeIdResolver<
      T extends string,
      II,
      Id,
      AI,
      A,
      E,
    >(
      tag: T,
      requestSchema: Schema.Schema<II, Id>,
      resultSchema: Schema.Schema<AI, A>,
      resultId: (_: AI) => Id,
      run: (
        requests: ReadonlyArray<Id>,
      ) => Effect.Effect<never, RequestError | E, ReadonlyArray<AI>>,
    ): Resolver<T, Id, Option.Option<A>, E> {
      const Request = request.tagged<Request<T, Id, E, Option.Option<A>>>(tag)
      const decode = Schema.decodeEffect(resultSchema)
      const Resolver = RequestResolver.makeBatched(
        (requests: Request<T, Id, E, Option.Option<A>>[]) =>
          pipe(
            Effect.all({
              results: run(requests.map(_ => _.i0)),
              requestsMap: Effect.sync(() =>
                requests.reduce(
                  (acc, request) => acc.set(request.i0, request),
                  new Map<Id, Request<T, Id, E, Option.Option<A>>>(),
                ),
              ),
            }),
            Effect.tap(({ results, requestsMap }) =>
              Effect.forEachDiscard(results, result => {
                const id = resultId(result)
                const req = requestsMap.get(id)

                if (!req) {
                  return Effect.unit()
                }

                requestsMap.delete(id)

                return pipe(
                  decode(result),
                  Effect.flatMap(result =>
                    request.succeed(req, Option.some(result)),
                  ),
                  Effect.catchAll(error => request.fail(req, error as any)),
                )
              }),
            ),
            Effect.tap(({ requestsMap }) =>
              Effect.forEachDiscard(requestsMap.values(), req =>
                request.succeed(req, Option.none()),
              ),
            ),
            Effect.catchAll(error =>
              Effect.forEachDiscard(requests, req =>
                request.fail(req, error as any),
              ),
            ),
          ),
      )
      const validate = Schema.validateEffect(requestSchema)
      const execute = (_: Id) =>
        Effect.flatMap(validate(_), i0 =>
          Effect.request(Request({ i0 }), Resolver),
        )

      return { Request, Resolver, execute }
    }

    return sql
  })

export const tag: Tag<PgFx, PgFx> = Tag<PgFx>()

export const makeLayer = (
  config: Config.Config.Wrap<postgres.Options<{}>>,
): Layer.Layer<never, ConfigError, PgFx> =>
  Layer.scoped(tag, Effect.flatMap(Effect.config(Config.unwrap(config)), make))

// === export postgres helpers
export const { fromKebab, fromCamel, fromPascal, toCamel, toKebab, toPascal } =
  postgres
