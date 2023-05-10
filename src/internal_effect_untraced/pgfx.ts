/* eslint-disable @typescript-eslint/ban-types */
/* eslint-disable @typescript-eslint/no-explicit-any */
import * as Chunk from "@effect/data/Chunk"
import { Tag } from "@effect/data/Context"
import { pipe } from "@effect/data/Function"
import * as Option from "@effect/data/Option"
import * as ROA from "@effect/data/ReadonlyArray"
import * as Config from "@effect/io/Config"
import type { ConfigError } from "@effect/io/Config/Error"
import * as Deferred from "@effect/io/Deferred"
import * as Effect from "@effect/io/Effect"
import * as Layer from "@effect/io/Layer"
import * as request from "@effect/io/Request"
import * as RequestResolver from "@effect/io/RequestResolver"
import type { Scope } from "@effect/io/Scope"
import * as Schema from "@effect/schema/Schema"
import type { PgFx, Request, Resolver } from "pgfx"
import { PostgresError, ResultLengthMismatch, SchemaError } from "pgfx/Error"
import * as PgSchema from "pgfx/Schema"
import postgres, { ParameterOrFragment } from "postgres"

export const PgSql = Tag<postgres.TransactionSql<{}>>()

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
            .catch(error => resume(Effect.fail(PostgresError(error))))

          return Effect.sync(() => query.cancel())
        }),
      )
    }) as any

    ;(sql as any).safe = sql
    ;(sql as any).array = pgSql.array
    ;(sql as any).json = pgSql.json

    sql.describe = function describe(
      template: TemplateStringsArray,
      ...params: readonly ParameterOrFragment<{}>[]
    ) {
      return Effect.flatMap(getSql, pgSql =>
        Effect.async<never, PostgresError, postgres.Statement>(resume => {
          const query = pgSql(template, ...(params as any)).describe()

          query
            .then(_ => resume(Effect.succeed(_)))
            .catch(error => resume(Effect.fail(PostgresError(error))))
        }),
      )
    }

    sql.withTransaction = function withTransaction<R, E, A>(
      self: Effect.Effect<R, E, A>,
    ): Effect.Effect<R, E | PostgresError, A> {
      return Effect.acquireUseRelease(
        pipe(
          Effect.all(Effect.serviceOption(PgSql), Deferred.make<E, A>()),
          Effect.flatMap(([sql, deferred]) =>
            Effect.async<
              never,
              PostgresError,
              readonly [postgres.TransactionSql<{}>, Deferred.Deferred<E, A>]
            >(resume => {
              let done = false

              const begin = Option.match(
                sql,
                () => pgSql.begin.bind(pgSql),
                pgSql => pgSql.savepoint.bind(pgSql),
              )

              begin(tSql => {
                if (done) return
                done = true
                resume(Effect.succeed([tSql, deferred]))
                return Effect.runPromise(Deferred.await(deferred))
              }).catch(error => {
                if (done) return
                done = true
                resume(Effect.fail(PostgresError(error)))
              })
            }),
          ),
        ),
        ([sql]) => Effect.provideService(self, PgSql, sql),
        ([, deferred], exit) => Deferred.complete(deferred, exit),
      )
    }

    sql.schema = function makeSchema<II, IA, AI, A, R, E>(
      requestSchema: Schema.Schema<II, IA>,
      resultSchema: Schema.Schema<AI, A>,
      run: (_: IA) => Effect.Effect<R, E, ReadonlyArray<AI>>,
    ) {
      const decodeResult = PgSchema.decode(Schema.chunk(resultSchema), "result")
      const decodeRequest = PgSchema.decode(requestSchema, "request")

      return (_: II): Effect.Effect<R, SchemaError | E, Chunk.Chunk<A>> =>
        pipe(
          decodeRequest(_),
          Effect.flatMap(run),
          Effect.flatMap(decodeResult),
        )
    }

    sql.singleSchema = function makeSingleSchema<II, IA, AI, A, R, E>(
      requestSchema: Schema.Schema<II, IA>,
      resultSchema: Schema.Schema<AI, A>,
      run: (_: IA) => Effect.Effect<R, E, ReadonlyArray<AI>>,
    ) {
      const decodeResult = PgSchema.decode(resultSchema, "result")
      const decodeRequest = PgSchema.decode(requestSchema, "request")

      return (_: II): Effect.Effect<R, SchemaError | E, A> =>
        pipe(
          decodeRequest(_),
          Effect.flatMap(run),
          Effect.flatMap(_ => Effect.orDie(ROA.head(_))),
          Effect.flatMap(decodeResult),
        )
    }

    sql.singleSchemaOption = function makeSingleSchemaOption<
      II,
      IA,
      AI,
      A,
      R,
      E,
    >(
      requestSchema: Schema.Schema<II, IA>,
      resultSchema: Schema.Schema<AI, A>,
      run: (_: IA) => Effect.Effect<R, E, ReadonlyArray<AI>>,
    ) {
      const decodeResult = PgSchema.decode(resultSchema, "result")
      const decodeRequest = PgSchema.decode(requestSchema, "request")

      return (_: II): Effect.Effect<R, SchemaError | E, Option.Option<A>> =>
        pipe(
          decodeRequest(_),
          Effect.flatMap(run),
          Effect.map(ROA.head),
          Effect.flatMap(
            Option.match(
              () => Effect.succeedNone(),
              result => Effect.asSome(decodeResult(result)),
            ),
          ),
        )
    }

    sql.resolver = function makeResolver<T extends string, II, IA, AI, A, E>(
      tag: T,
      requestSchema: Schema.Schema<II, IA>,
      resultSchema: Schema.Schema<AI, A>,
      run: (
        requests: ReadonlyArray<IA>,
      ) => Effect.Effect<never, PostgresError | E, ReadonlyArray<AI>>,
    ): Resolver<T, II, IA, A, E | ResultLengthMismatch> {
      const Request =
        request.tagged<Request<T, IA, E | ResultLengthMismatch, A>>(tag)
      const decodeResult = PgSchema.decode(resultSchema, "result")
      const Resolver = RequestResolver.makeBatched(
        (requests: Request<T, IA, E | ResultLengthMismatch, A>[]) =>
          pipe(
            run(requests.map(_ => _.i0)),
            Effect.filterOrElseWith(
              results => results.length === requests.length,
              _ => Effect.fail(ResultLengthMismatch(requests.length, _.length)),
            ),
            Effect.flatMap(results =>
              Effect.forEachWithIndex(results, (result, i) =>
                pipe(
                  decodeResult(result),
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
      const decodeRequest = PgSchema.decode(requestSchema, "request")
      const execute = (_: II) =>
        Effect.flatMap(decodeRequest(_), i0 =>
          Effect.request(Request({ i0 }), Resolver),
        )

      return { Request, Resolver, execute }
    }

    sql.singleResolverOption = function makeSingleResolver<
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
      ) => Effect.Effect<never, PostgresError | E, ReadonlyArray<AI>>,
    ): Resolver<T, II, IA, Option.Option<A>, E> {
      const Request = request.tagged<Request<T, IA, E, Option.Option<A>>>(tag)
      const decodeResult = PgSchema.decode(resultSchema, "result")
      const Resolver = RequestResolver.fromFunctionEffect(
        (req: Request<T, IA, E, Option.Option<A>>) =>
          pipe(
            run(req.i0),
            Effect.map(ROA.head),
            Effect.flatMap(
              Option.match(
                () => Effect.succeedNone(),
                result => Effect.asSome(decodeResult(result)),
              ),
            ),
          ),
      )
      const decodeRequest = PgSchema.decode(requestSchema, "request")
      const execute = (_: II) =>
        Effect.flatMap(decodeRequest(_), i0 =>
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
      ) => Effect.Effect<never, PostgresError | E, ReadonlyArray<AI>>,
    ): Resolver<T, II, IA, A, E> {
      const Request = request.tagged<Request<T, IA, E, A>>(tag)
      const decodeResult = PgSchema.decode(resultSchema, "result")
      const Resolver = RequestResolver.fromFunctionEffect(
        (req: Request<T, IA, E, A>) =>
          pipe(
            run(req.i0),
            Effect.flatMap(_ => Effect.orDie(ROA.head(_))),
            Effect.flatMap(decodeResult),
          ),
      )
      const decodeRequest = PgSchema.decode(requestSchema, "request")
      const execute = (_: II) =>
        Effect.flatMap(decodeRequest(_), i0 =>
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
      ) => Effect.Effect<never, PostgresError | E, ReadonlyArray<X>>,
    ): Resolver<T, II, IA, void, E> {
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
      const decodeRequest = PgSchema.decode(requestSchema, "request")
      const execute = (_: II) =>
        Effect.flatMap(decodeRequest(_), i0 =>
          Effect.request(Request({ i0 }), Resolver),
        )

      return { Request, Resolver, execute }
    }

    sql.idResolver = function makeIdResolver<
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
      resultId: (_: AI) => IA,
      run: (
        requests: ReadonlyArray<IA>,
      ) => Effect.Effect<never, PostgresError | E, ReadonlyArray<AI>>,
    ): Resolver<T, II, IA, Option.Option<A>, E> {
      const Request = request.tagged<Request<T, IA, E, Option.Option<A>>>(tag)
      const decodeResult = PgSchema.decode(resultSchema, "result")
      const Resolver = RequestResolver.makeBatched(
        (requests: Request<T, IA, E, Option.Option<A>>[]) =>
          pipe(
            Effect.all({
              results: run(requests.map(_ => _.i0)),
              requestsMap: Effect.sync(() =>
                requests.reduce(
                  (acc, request) => acc.set(request.i0, request),
                  new Map<IA, Request<T, IA, E, Option.Option<A>>>(),
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
                  decodeResult(result),
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
      const decodeRequest = PgSchema.decode(requestSchema, "request")
      const execute = (_: II) =>
        Effect.flatMap(decodeRequest(_), i0 =>
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
