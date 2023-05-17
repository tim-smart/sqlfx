/** @internal */

import * as Context from "@effect/data/Context"
import { Tag } from "@effect/data/Context"
import * as Debug from "@effect/data/Debug"
import { pipe } from "@effect/data/Function"
import * as Option from "@effect/data/Option"
import * as ROA from "@effect/data/ReadonlyArray"
import * as Effect from "@effect/io/Effect"
import * as Exit from "@effect/io/Exit"
import * as FiberRef from "@effect/io/FiberRef"
import * as request from "@effect/io/Request"
import * as RequestResolver from "@effect/io/RequestResolver"
import * as Schema from "@effect/schema/Schema"
import type { Client, Request, Resolver } from "@sqlfx/sql/Client"
import type { Connection, Row } from "@sqlfx/sql/Connection"
import type { SchemaError, SqlError } from "@sqlfx/sql/Error"
import { ResultLengthMismatch } from "@sqlfx/sql/Error"
import * as SqlSchema from "@sqlfx/sql/Schema"
import * as Statement from "@sqlfx/sql/Statement"

const TransactionConn = Tag<readonly [conn: Connection, counter: number]>()

/** @internal */
export function make(
  acquirer: Connection.Acquirer,
  transactionAcquirer: Connection.Acquirer,
): Client {
  const getConnection = Effect.flatMap(
    Effect.serviceOption(TransactionConn),
    Option.match(
      () => acquirer,
      ([conn]) => Effect.succeed(conn),
    ),
  )
  const withTransaction = <R, E, A>(
    effect: Effect.Effect<R, E, A>,
  ): Effect.Effect<R, E | SqlError, A> =>
    Effect.scoped(
      Effect.acquireUseRelease(
        pipe(
          Effect.serviceOption(TransactionConn),
          Effect.flatMap(
            Option.match(
              () => Effect.map(transactionAcquirer, conn => [conn, 0] as const),
              ([conn, count]) => Effect.succeed([conn, count + 1] as const),
            ),
          ),
          Effect.tap(([conn, id]) =>
            id > 0
              ? conn.executeRaw(`SAVEPOINT sqlfx${id}`)
              : conn.executeRaw("BEGIN"),
          ),
        ),
        ([conn, id]) =>
          Effect.provideService(effect, TransactionConn, [conn, id]),
        ([conn, id], exit) =>
          Exit.isSuccess(exit)
            ? id > 0
              ? Effect.unit()
              : Effect.orDie(conn.executeRaw("COMMIT"))
            : id > 0
            ? Effect.orDie(conn.executeRaw(`ROLLBACK TO SAVEPOINT sqlfx${id}`))
            : Effect.orDie(conn.executeRaw("ROLLBACK")),
      ),
    )

  const schema = Debug.methodWithTrace(
    parentTrace =>
      function schema<II, IA, AI extends Row, A, R, E>(
        requestSchema: Schema.Schema<II, IA>,
        resultSchema: Schema.Schema<AI, A>,
        run: (_: II) => Effect.Effect<R, E, ReadonlyArray<Row>>,
      ) {
        const decodeResult = SqlSchema.parse(
          Schema.array(resultSchema),
          "result",
        )
        const encodeRequest = SqlSchema.encode(requestSchema, "request")

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

  const singleSchema = Debug.methodWithTrace(
    parentTrace =>
      function makeSingleSchema<II, IA, AI extends Row, A, R, E>(
        requestSchema: Schema.Schema<II, IA>,
        resultSchema: Schema.Schema<AI, A>,
        run: (_: II) => Effect.Effect<R, E, ReadonlyArray<Row>>,
      ) {
        const decodeResult = SqlSchema.parse(resultSchema, "result")
        const encodeRequest = SqlSchema.encode(requestSchema, "request")

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

  const singleSchemaOption = Debug.methodWithTrace(
    parentTrace =>
      function makeSingleSchemaOption<II, IA, AI extends Row, A, R, E>(
        requestSchema: Schema.Schema<II, IA>,
        resultSchema: Schema.Schema<AI, A>,
        run: (_: II) => Effect.Effect<R, E, ReadonlyArray<Row>>,
      ) {
        const decodeResult = SqlSchema.parse(resultSchema, "result")
        const encodeRequest = SqlSchema.encode(requestSchema, "request")

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
      request.Request<SchemaError | E, A> & { i0: RI }
    >,
    Resolver: RequestResolver.RequestResolver<any>,
    schema: Schema.Schema<RI, RA>,
    context = Context.empty() as Context.Context<any>,
  ) => {
    const encodeRequest = SqlSchema.encode(schema, "request")
    const resolverWithSql = Effect.map(
      Effect.serviceOption(TransactionConn),
      _ =>
        RequestResolver.provideContext(
          Resolver,
          Option.match(
            _,
            () => context,
            tconn => Context.add(context, TransactionConn, tconn),
          ),
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

  const makePopulateCache = <E, A, RI>(
    parentTrace: Debug.Trace,
    Request: request.Request.Constructor<
      request.Request<SchemaError | E, A> & { i0: RI }
    >,
  ) =>
    Debug.methodWithTrace(
      trace => (id: RI, _: A) =>
        Effect.cacheRequestResult(Request({ i0: id }), Exit.succeed(_))
          .traced(trace)
          .traced(parentTrace),
    )

  const makeInvalidateCache = <E, A, RI>(
    parentTrace: Debug.Trace,
    Request: request.Request.Constructor<
      request.Request<SchemaError | E, A> & { i0: RI }
    >,
  ) =>
    Debug.methodWithTrace(
      trace => (id: RI) =>
        Effect.flatMap(FiberRef.get(FiberRef.currentRequestCache), cache =>
          cache.invalidate(Request({ i0: id })),
        )
          .traced(trace)
          .traced(parentTrace),
    )

  const resolver = Debug.methodWithTrace(
    parentTrace =>
      function makeResolver<T extends string, II, IA, AI extends Row, A, E>(
        tag: T,
        requestSchema: Schema.Schema<II, IA>,
        resultSchema: Schema.Schema<AI, A>,
        run: (
          requests: ReadonlyArray<II>,
        ) => Effect.Effect<never, E, ReadonlyArray<Row>>,
        context?: Context.Context<any>,
      ): Resolver<T, II, IA, A, E | ResultLengthMismatch> {
        const Request =
          request.tagged<Request<T, II, E | ResultLengthMismatch, A>>(tag)
        const decodeResult = SqlSchema.parse(resultSchema, "result")
        const Resolver = RequestResolver.makeBatched(
          (requests: Array<Request<T, II, E | ResultLengthMismatch, A>>) =>
            pipe(
              run(requests.map(_ => _.i0)),
              Effect.filterOrElseWith(
                results => results.length === requests.length,
                _ =>
                  Effect.fail(ResultLengthMismatch(requests.length, _.length)),
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
          context,
        )

        const populateCache = makePopulateCache(parentTrace, Request)
        const invalidateCache = makeInvalidateCache(parentTrace, Request)

        return { Request, Resolver, execute, populateCache, invalidateCache }
      },
  )

  const singleResolverOption = Debug.methodWithTrace(
    parentTrace =>
      function makeSingleResolver<
        T extends string,
        II,
        IA,
        AI extends Row,
        A,
        E,
      >(
        tag: T,
        requestSchema: Schema.Schema<II, IA>,
        resultSchema: Schema.Schema<AI, A>,
        run: (request: II) => Effect.Effect<never, E, ReadonlyArray<Row>>,
        context?: Context.Context<any>,
      ): Resolver<T, II, IA, Option.Option<A>, E> {
        const Request = request.tagged<Request<T, II, E, Option.Option<A>>>(tag)
        const decodeResult = SqlSchema.parse(resultSchema, "result")
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
          context,
        )

        const populateCache = makePopulateCache(parentTrace, Request)
        const invalidateCache = makeInvalidateCache(parentTrace, Request)

        return { Request, Resolver, execute, populateCache, invalidateCache }
      },
  )
  const singleResolver = Debug.methodWithTrace(
    parentTrace =>
      function makeSingleResolver<
        T extends string,
        II,
        IA,
        AI extends Row,
        A,
        E,
      >(
        tag: T,
        requestSchema: Schema.Schema<II, IA>,
        resultSchema: Schema.Schema<AI, A>,
        run: (request: II) => Effect.Effect<never, E, ReadonlyArray<Row>>,
        context?: Context.Context<any>,
      ): Resolver<T, II, IA, A, E> {
        const Request = request.tagged<Request<T, II, E, A>>(tag)
        const decodeResult = SqlSchema.parse(resultSchema, "result")
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
          context,
        )

        const populateCache = makePopulateCache(parentTrace, Request)
        const invalidateCache = makeInvalidateCache(parentTrace, Request)

        return { Request, Resolver, execute, populateCache, invalidateCache }
      },
  )
  const voidResolver = Debug.methodWithTrace(
    parentTrace =>
      function makeVoidResolver<T extends string, II, IA, E>(
        tag: T,
        requestSchema: Schema.Schema<II, IA>,
        run: (
          requests: ReadonlyArray<II>,
        ) => Effect.Effect<never, E, ReadonlyArray<Row>>,
        context?: Context.Context<any>,
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
          context,
        )

        const populateCache = makePopulateCache(parentTrace, Request)
        const invalidateCache = makeInvalidateCache(parentTrace, Request)

        return { Request, Resolver, execute, populateCache, invalidateCache }
      },
  )

  const idResolver = Debug.methodWithTrace(
    parentTrace =>
      function makeIdResolver<T extends string, II, IA, AI extends Row, A, E>(
        tag: T,
        requestSchema: Schema.Schema<II, IA>,
        resultSchema: Schema.Schema<AI, A>,
        resultId: (_: AI) => II,
        run: (
          requests: ReadonlyArray<II>,
        ) => Effect.Effect<never, E, ReadonlyArray<AI>>,
        context?: Context.Context<any>,
      ): Resolver<T, II, IA, Option.Option<A>, E> {
        const Request = request.tagged<Request<T, II, E, Option.Option<A>>>(tag)
        const decodeResult = SqlSchema.parse(resultSchema, "result")
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
          context,
        )

        const populateCache = makePopulateCache(parentTrace, Request)
        const invalidateCache = makeInvalidateCache(parentTrace, Request)

        return { Request, Resolver, execute, populateCache, invalidateCache }
      },
  )

  const client: Client = Object.assign(Statement.make(getConnection), {
    safe: undefined as any,
    unsafe: Statement.unsafe(getConnection),
    and: Statement.and,
    or: Statement.or,
    join: Statement.join,
    csv: Statement.csv,
    withTransaction,
    schema,
    singleSchema,
    singleSchemaOption,
    resolver,
    singleResolverOption,
    singleResolver,
    voidResolver,
    idResolver,
  })

  ;(client as any).safe = client

  return client
}
