/** @internal */
import * as Context from "@effect/data/Context"
import { Tag } from "@effect/data/Context"
import * as Debug from "@effect/data/Debug"
import { pipe } from "@effect/data/Function"
import * as Option from "@effect/data/Option"
import * as ROA from "@effect/data/ReadonlyArray"
import * as Cause from "@effect/io/Cause"
import * as Config from "@effect/io/Config"
import type { ConfigError } from "@effect/io/Config/Error"
import * as Effect from "@effect/io/Effect"
import * as Exit from "@effect/io/Exit"
import * as Layer from "@effect/io/Layer"
import * as request from "@effect/io/Request"
import * as RequestResolver from "@effect/io/RequestResolver"
import * as Runtime from "@effect/io/Runtime"
import type { Scope } from "@effect/io/Scope"
import * as Schema from "@effect/schema/Schema"
import type { PgFx, Request, Resolver, SqlFragment } from "pgfx"
import type { RequestError, SchemaError } from "pgfx/Error"
import { PostgresError, ResultLengthMismatch } from "pgfx/Error"
import * as PgSchema from "pgfx/Schema"
import type { ParameterOrFragment } from "postgres"
import postgres from "postgres"

/** @internal */
export const PgSql = Tag<postgres.TransactionSql<{}>>()

/** @internal */
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

    const execute = (
      f: (
        query: postgres.PendingQuery<Array<Record<string, unknown>>>,
      ) =>
        | postgres.PendingQuery<Array<Record<string, unknown>>>
        | postgres.PendingValuesQuery<Array<Record<string, unknown>>>,
    ) =>
      Debug.methodWithTrace(
        trace =>
          ((
            template: TemplateStringsArray,
            ...params: ReadonlyArray<ParameterOrFragment<{}>>
          ) => {
            if (!(template && Array.isArray(template.raw))) {
              return pgSql(template, ...(params as any))
            }

            return Effect.flatMap(getSql, pgSql =>
              Effect.asyncInterrupt<never, PostgresError, unknown>(resume => {
                const query = f(pgSql(template, ...(params as any)))

                query
                  .then(_ => resume(Effect.succeed(_ as any)))
                  .catch(error => resume(Effect.fail(PostgresError(error))))

                return Effect.sync(() => query.cancel())
              }),
            ).traced(trace)
          }) as any,
      )

    const sql: PgFx = execute(_ => _.execute())

    ;(sql as any).safe = sql
    ;(sql as any).$ = pgSql
    ;(sql as any).array = pgSql.array
    ;(sql as any).json = pgSql.json
    ;(sql as any).values = execute(_ => _.values().execute())
    ;(sql as any).and = (clauses: ReadonlyArray<SqlFragment>): SqlFragment => {
      if (clauses.length === 0) {
        return sql.$`(1 = 1)`
      }

      return sql.$`(${clauses.reduce(
        (acc, frag) => sql.$`${acc} AND ${frag}`,
      )})`
    }
    ;(sql as any).or = (clauses: ReadonlyArray<SqlFragment>): SqlFragment => {
      if (clauses.length === 0) {
        return sql.$`1 = 1`
      }

      return sql.$`(${clauses.reduce((acc, frag) => sql.$`${acc} OR ${frag}`)})`
    }

    sql.describe = Debug.methodWithTrace(
      trace =>
        function describe(
          template: TemplateStringsArray,
          ...params: ReadonlyArray<ParameterOrFragment<{}>>
        ) {
          return Effect.flatMap(getSql, pgSql =>
            Effect.async<never, PostgresError, postgres.Statement>(resume => {
              const query = pgSql(template, ...(params as any)).describe()

              query
                .then(_ => resume(Effect.succeed(_)))
                .catch(error => resume(Effect.fail(PostgresError(error))))
            }),
          ).traced(trace)
        },
    )

    sql.withTransaction = Debug.methodWithTrace(
      trace =>
        function withTransaction<R, E, A>(
          self: Effect.Effect<R, E, A>,
        ): Effect.Effect<R, E | PostgresError, A> {
          return pipe(
            Effect.all(
              Effect.runtime<R>(),
              Effect.fiberId(),
              Effect.serviceOption(PgSql),
            ),
            Effect.flatMap(([runtime, fiberId, sql]) =>
              Effect.asyncInterrupt<never, E | PostgresError, A>(resume => {
                let cancelled = false
                let cancel: Runtime.Cancel<E, A>

                const begin = Option.match(
                  sql,
                  () => pgSql.begin.bind(pgSql),
                  pgSql => pgSql.savepoint.bind(pgSql),
                )

                begin(
                  tSql =>
                    new Promise<A>((resolve, reject) => {
                      cancel = Runtime.runCallback(runtime)(
                        Effect.provideService(self, PgSql, tSql),
                        exit =>
                          Exit.isSuccess(exit)
                            ? resolve(exit.value)
                            : reject(exit.cause),
                      )
                    }),
                )
                  .then(_ => resume(Effect.succeed(_ as A)))
                  .catch(error => {
                    if (cancelled) {
                      return
                    } else if (Cause.isCause(error)) {
                      resume(Effect.failCause(error))
                    } else {
                      resume(Effect.fail(PostgresError(error)))
                    }
                  })

                return Effect.sync(() => {
                  cancelled = true
                  cancel(fiberId)
                })
              }),
            ),
          ).traced(trace)
        },
    )

    sql.schema = Debug.methodWithTrace(
      parentTrace =>
        function makeSchema<II, IA, AI, A, R, E>(
          requestSchema: Schema.Schema<II, IA>,
          resultSchema: Schema.Schema<AI, A>,
          run: (_: II) => Effect.Effect<R, E, ReadonlyArray<AI>>,
        ) {
          const decodeResult = PgSchema.decode(
            Schema.array(resultSchema),
            "result",
          )
          const encodeRequest = PgSchema.encode(requestSchema, "request")

          return Debug.methodWithTrace(
            trace =>
              (_: IA): Effect.Effect<R, SchemaError | E, ReadonlyArray<A>> =>
                pipe(
                  encodeRequest(_),
                  Effect.flatMap(run),
                  Effect.flatMap(decodeResult),
                )
                  .traced(trace)
                  .traced(parentTrace),
          )
        },
    )

    sql.singleSchema = Debug.methodWithTrace(
      parentTrace =>
        function makeSingleSchema<II, IA, AI, A, R, E>(
          requestSchema: Schema.Schema<II, IA>,
          resultSchema: Schema.Schema<AI, A>,
          run: (_: II) => Effect.Effect<R, E, ReadonlyArray<AI>>,
        ) {
          const decodeResult = PgSchema.decode(resultSchema, "result")
          const encodeRequest = PgSchema.encode(requestSchema, "request")

          return Debug.methodWithTrace(
            trace =>
              (_: IA): Effect.Effect<R, SchemaError | E, A> =>
                pipe(
                  encodeRequest(_),
                  Effect.flatMap(run),
                  Effect.flatMap(_ => Effect.orDie(ROA.head(_))),
                  Effect.flatMap(decodeResult),
                )
                  .traced(trace)
                  .traced(parentTrace),
          )
        },
    )

    sql.singleSchemaOption = Debug.methodWithTrace(
      parentTrace =>
        function makeSingleSchemaOption<II, IA, AI, A, R, E>(
          requestSchema: Schema.Schema<II, IA>,
          resultSchema: Schema.Schema<AI, A>,
          run: (_: II) => Effect.Effect<R, E, ReadonlyArray<AI>>,
        ) {
          const decodeResult = PgSchema.decode(resultSchema, "result")
          const encodeRequest = PgSchema.encode(requestSchema, "request")

          return Debug.methodWithTrace(
            trace =>
              (_: IA): Effect.Effect<R, SchemaError | E, Option.Option<A>> =>
                pipe(
                  encodeRequest(_),
                  Effect.flatMap(run),
                  Effect.map(ROA.head),
                  Effect.flatMap(
                    Option.match(
                      () => Effect.succeedNone(),
                      result => Effect.asSome(decodeResult(result)),
                    ),
                  ),
                )
                  .traced(trace)
                  .traced(parentTrace),
          )
        },
    )

    const makeExecuteRequest = <E, A, RI, RA>(
      parentTrace: Debug.Trace,
      Request: request.Request.Constructor<
        request.Request<RequestError | E, A> & { i0: RI }
      >,
      Resolver: RequestResolver.RequestResolver<any>,
      schema: Schema.Schema<RI, RA>,
    ) => {
      const encodeRequest = PgSchema.encode(schema, "request")
      const resolverWithSql = Effect.map(
        Effect.serviceOption(PgSql),
        Option.match(
          () => Resolver,
          sql =>
            RequestResolver.provideContext(Resolver, Context.make(PgSql, sql)),
        ),
      )
      return Debug.methodWithTrace(
        trace => (_: RA) =>
          Effect.flatMap(
            Effect.zip(encodeRequest(_), resolverWithSql),
            ([i0, resolver]) => Effect.request(Request({ i0 }), resolver),
          )
            .traced(trace)
            .traced(parentTrace),
      )
    }

    sql.resolver = Debug.methodWithTrace(
      parentTrace =>
        function makeResolver<T extends string, II, IA, AI, A, E>(
          tag: T,
          requestSchema: Schema.Schema<II, IA>,
          resultSchema: Schema.Schema<AI, A>,
          run: (
            requests: ReadonlyArray<II>,
          ) => Effect.Effect<never, PostgresError | E, ReadonlyArray<AI>>,
        ): Resolver<T, II, IA, A, E | ResultLengthMismatch> {
          const Request =
            request.tagged<Request<T, II, E | ResultLengthMismatch, A>>(tag)
          const decodeResult = PgSchema.decode(resultSchema, "result")
          const Resolver = RequestResolver.makeBatched(
            (requests: Array<Request<T, II, E | ResultLengthMismatch, A>>) =>
              pipe(
                run(requests.map(_ => _.i0)),
                Effect.filterOrElseWith(
                  results => results.length === requests.length,
                  _ =>
                    Effect.fail(
                      ResultLengthMismatch(requests.length, _.length),
                    ),
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
                  Effect.forEachDiscard(requests, req =>
                    request.fail(req, error),
                  ),
                ),
              ),
          )

          const execute = makeExecuteRequest(
            parentTrace,
            Request,
            Resolver,
            requestSchema,
          )

          return { Request, Resolver, execute }
        },
    )

    sql.singleResolverOption = Debug.methodWithTrace(
      parentTrace =>
        function makeSingleResolver<T extends string, II, IA, AI, A, E>(
          tag: T,
          requestSchema: Schema.Schema<II, IA>,
          resultSchema: Schema.Schema<AI, A>,
          run: (
            request: II,
          ) => Effect.Effect<never, PostgresError | E, ReadonlyArray<AI>>,
        ): Resolver<T, II, IA, Option.Option<A>, E> {
          const Request =
            request.tagged<Request<T, II, E, Option.Option<A>>>(tag)
          const decodeResult = PgSchema.decode(resultSchema, "result")
          const Resolver = RequestResolver.fromFunctionEffect(
            (req: Request<T, II, E, Option.Option<A>>) =>
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

          const execute = makeExecuteRequest(
            parentTrace,
            Request,
            Resolver,
            requestSchema,
          )

          return { Request, Resolver, execute }
        },
    )

    sql.singleResolver = Debug.methodWithTrace(
      parentTrace =>
        function makeSingleResolver<T extends string, II, IA, AI, A, E>(
          tag: T,
          requestSchema: Schema.Schema<II, IA>,
          resultSchema: Schema.Schema<AI, A>,
          run: (
            request: II,
          ) => Effect.Effect<never, PostgresError | E, ReadonlyArray<AI>>,
        ): Resolver<T, II, IA, A, E> {
          const Request = request.tagged<Request<T, II, E, A>>(tag)
          const decodeResult = PgSchema.decode(resultSchema, "result")
          const Resolver = RequestResolver.fromFunctionEffect(
            (req: Request<T, II, E, A>) =>
              pipe(
                run(req.i0),
                Effect.flatMap(_ => Effect.orDie(ROA.head(_))),
                Effect.flatMap(decodeResult),
              ),
          )

          const execute = makeExecuteRequest(
            parentTrace,
            Request,
            Resolver,
            requestSchema,
          )

          return { Request, Resolver, execute }
        },
    )

    sql.voidResolver = Debug.methodWithTrace(
      parentTrace =>
        function makeVoidResolver<T extends string, II, IA, E, X>(
          tag: T,
          requestSchema: Schema.Schema<II, IA>,
          run: (
            requests: ReadonlyArray<II>,
          ) => Effect.Effect<never, PostgresError | E, ReadonlyArray<X>>,
        ): Resolver<T, II, IA, void, E> {
          const Request = request.tagged<Request<T, II, E, void>>(tag)
          const Resolver = RequestResolver.makeBatched(
            (requests: Array<Request<T, II, E, void>>) =>
              pipe(
                run(requests.map(_ => _.i0)),
                Effect.zipRight(
                  Effect.forEachDiscard(requests, req =>
                    request.succeed(req, void 0 as any),
                  ),
                ),
                Effect.catchAll(error =>
                  Effect.forEachDiscard(requests, req =>
                    request.fail(req, error),
                  ),
                ),
              ),
          )

          const execute = makeExecuteRequest(
            parentTrace,
            Request,
            Resolver,
            requestSchema,
          )

          return { Request, Resolver, execute }
        },
    )

    sql.idResolver = Debug.methodWithTrace(
      parentTrace =>
        function makeIdResolver<T extends string, II, IA, AI, A, E>(
          tag: T,
          requestSchema: Schema.Schema<II, IA>,
          resultSchema: Schema.Schema<AI, A>,
          resultId: (_: AI) => II,
          run: (
            requests: ReadonlyArray<II>,
          ) => Effect.Effect<never, PostgresError | E, ReadonlyArray<AI>>,
        ): Resolver<T, II, IA, Option.Option<A>, E> {
          const Request =
            request.tagged<Request<T, II, E, Option.Option<A>>>(tag)
          const decodeResult = PgSchema.decode(resultSchema, "result")
          const Resolver = RequestResolver.makeBatched(
            (requests: Array<Request<T, II, E, Option.Option<A>>>) =>
              pipe(
                Effect.all({
                  results: run(requests.map(_ => _.i0)),
                  requestsMap: Effect.sync(() =>
                    requests.reduce(
                      (acc, request) => acc.set(request.i0, request),
                      new Map<II, Request<T, II, E, Option.Option<A>>>(),
                    ),
                  ),
                }),
                Effect.tap(({ requestsMap, results }) =>
                  Effect.forEachParDiscard(results, result => {
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

          const execute = makeExecuteRequest(
            parentTrace,
            Request,
            Resolver,
            requestSchema,
          )

          return { Request, Resolver, execute }
        },
    )

    return sql
  })

/** @internal */
export const tag: Tag<PgFx, PgFx> = Tag<PgFx>()

/** @internal */
export const makeLayer = (
  config: Config.Config.Wrap<postgres.Options<{}>>,
): Layer.Layer<never, ConfigError, PgFx> =>
  Layer.scoped(tag, Effect.flatMap(Effect.config(Config.unwrap(config)), make))
