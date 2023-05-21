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
  const withTransaction = Debug.methodWithTrace(
    trace =>
      <R, E, A>(
        effect: Effect.Effect<R, E, A>,
      ): Effect.Effect<R, E | SqlError, A> =>
        Effect.scoped(
          Effect.acquireUseRelease(
            pipe(
              Effect.serviceOption(TransactionConn),
              Effect.flatMap(
                Option.match(
                  () =>
                    Effect.map(transactionAcquirer, conn => [conn, 0] as const),
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
                ? Effect.orDie(
                    conn.executeRaw(`ROLLBACK TO SAVEPOINT sqlfx${id}`),
                  )
                : Effect.orDie(conn.executeRaw("ROLLBACK")),
          ),
        ).traced(trace),
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

  const makeExecuteRequest =
    <E, A, RA>(
      Request: request.Request.Constructor<
        request.Request<SchemaError | E, A> & { i0: RA }
      >,
    ) =>
    (
      Resolver: RequestResolver.RequestResolver<any>,
      context = Context.empty() as Context.Context<any>,
    ) => {
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
        trace => (i0: RA) =>
          Effect.flatMap(resolverWithSql, resolver =>
            Effect.request(Request({ i0 }), resolver),
          ).traced(trace),
      )
    }

  const makePopulateCache = <E, A, RA>(
    Request: request.Request.Constructor<
      request.Request<SchemaError | E, A> & { i0: RA }
    >,
  ) =>
    Debug.methodWithTrace(
      trace => (id: RA, _: A) =>
        Effect.cacheRequestResult(Request({ i0: id }), Exit.succeed(_)).traced(
          trace,
        ),
    )

  const makeInvalidateCache = <E, A, RA>(
    Request: request.Request.Constructor<
      request.Request<SchemaError | E, A> & { i0: RA }
    >,
  ) =>
    Debug.methodWithTrace(
      trace => (id: RA) =>
        Effect.flatMap(FiberRef.get(FiberRef.currentRequestCache), cache =>
          cache.invalidate(Request({ i0: id })),
        ).traced(trace),
    )

  const resolver = function makeResolver<
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
    run: (
      requests: ReadonlyArray<II>,
    ) => Effect.Effect<never, E, ReadonlyArray<Row>>,
  ): Resolver<T, IA, A, E | ResultLengthMismatch> {
    const Request =
      request.tagged<Request<T, IA, E | ResultLengthMismatch, A>>(tag)
    const encodeRequests = SqlSchema.encode(
      Schema.array(requestSchema),
      "request",
    )
    const decodeResult = SqlSchema.parse(resultSchema, "result")
    const Resolver = RequestResolver.makeBatched(
      (requests: Array<Request<T, IA, E | ResultLengthMismatch, A>>) =>
        pipe(
          encodeRequests(requests.map(_ => _.i0)),
          Effect.flatMap(run),
          Effect.filterOrElseWith(
            results => results.length === requests.length,
            _ => Effect.fail(ResultLengthMismatch(requests.length, _.length)),
          ),
          Effect.flatMap(results =>
            Effect.forEachWithIndex(results, (result, i) =>
              pipe(
                decodeResult(result),
                Effect.flatMap(result => request.succeed(requests[i], result)),
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

    const makeExecute = makeExecuteRequest(Request)
    const execute = makeExecute(Resolver)

    const populateCache = makePopulateCache(Request)
    const invalidateCache = makeInvalidateCache(Request)

    return {
      Request,
      Resolver,
      execute,
      makeExecute,
      populateCache,
      invalidateCache,
    }
  }

  const singleResolverOption = function makeSingleResolver<
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
  ): Resolver<T, IA, Option.Option<A>, E> {
    const Request = request.tagged<Request<T, IA, E, Option.Option<A>>>(tag)
    const encodeRequest = SqlSchema.encode(requestSchema, "request")
    const decodeResult = SqlSchema.parse(resultSchema, "result")
    const Resolver = RequestResolver.fromFunctionEffect(
      (req: Request<T, IA, E, Option.Option<A>>) =>
        pipe(
          encodeRequest(req.i0),
          Effect.flatMap(run),
          Effect.map(ROA.head),
          Effect.flatMap(
            Option.match(
              () => Effect.succeedNone(),
              result => Effect.asSome(decodeResult(result)),
            ),
          ),
        ),
    )

    const makeExecute = makeExecuteRequest(Request)
    const execute = makeExecute(Resolver)
    const populateCache = makePopulateCache(Request)
    const invalidateCache = makeInvalidateCache(Request)

    return {
      Request,
      Resolver,
      execute,
      makeExecute,
      populateCache,
      invalidateCache,
    }
  }

  const singleResolver = function makeSingleResolver<
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
  ): Resolver<T, IA, A, E> {
    const Request = request.tagged<Request<T, IA, E, A>>(tag)
    const encodeRequest = SqlSchema.encode(requestSchema, "request")
    const decodeResult = SqlSchema.parse(resultSchema, "result")
    const Resolver = RequestResolver.fromFunctionEffect(
      (req: Request<T, IA, E, A>) =>
        pipe(
          encodeRequest(req.i0),
          Effect.flatMap(run),
          Effect.flatMap(_ => Effect.orDie(ROA.head(_))),
          Effect.flatMap(decodeResult),
        ),
    )

    const makeExecute = makeExecuteRequest(Request)
    const execute = makeExecute(Resolver)
    const populateCache = makePopulateCache(Request)
    const invalidateCache = makeInvalidateCache(Request)

    return {
      Request,
      Resolver,
      execute,
      makeExecute,
      populateCache,
      invalidateCache,
    }
  }

  const voidResolver = function makeVoidResolver<T extends string, II, IA, E>(
    tag: T,
    requestSchema: Schema.Schema<II, IA>,
    run: (
      requests: ReadonlyArray<II>,
    ) => Effect.Effect<never, E, ReadonlyArray<Row>>,
  ): Resolver<T, IA, void, E> {
    const Request = request.tagged<Request<T, IA, E, void>>(tag)
    const encodeRequests = SqlSchema.encode(
      Schema.array(requestSchema),
      "request",
    )
    const Resolver = RequestResolver.makeBatched(
      (requests: Array<Request<T, IA, E, void>>) =>
        pipe(
          encodeRequests(requests.map(_ => _.i0)),
          Effect.flatMap(run),
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

    const makeExecute = makeExecuteRequest(Request)
    const execute = makeExecute(Resolver)
    const populateCache = makePopulateCache(Request)
    const invalidateCache = makeInvalidateCache(Request)

    return {
      Request,
      Resolver,
      execute,
      makeExecute,
      populateCache,
      invalidateCache,
    }
  }

  const idResolver = function makeIdResolver<
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
    resultId: (_: AI) => IA,
    run: (
      requests: ReadonlyArray<II>,
    ) => Effect.Effect<never, E, ReadonlyArray<AI>>,
  ): Resolver<T, IA, Option.Option<A>, E> {
    const Request = request.tagged<Request<T, IA, E, Option.Option<A>>>(tag)
    const encodeRequests = SqlSchema.encode(
      Schema.array(requestSchema),
      "request",
    )
    const decodeResult = SqlSchema.parse(resultSchema, "result")
    const Resolver = RequestResolver.makeBatched(
      (requests: Array<Request<T, IA, E, Option.Option<A>>>) =>
        pipe(
          Effect.all({
            results: Effect.flatMap(
              encodeRequests(requests.map(_ => _.i0)),
              run,
            ),
            requestsMap: Effect.sync(() =>
              requests.reduce(
                (acc, request) => acc.set(request.i0, request),
                new Map<IA, Request<T, IA, E, Option.Option<A>>>(),
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

    const makeExecute = makeExecuteRequest(Request)
    const execute = makeExecute(Resolver)
    const populateCache = makePopulateCache(Request)
    const invalidateCache = makeInvalidateCache(Request)

    return {
      Request,
      Resolver,
      execute,
      makeExecute,
      populateCache,
      invalidateCache,
    }
  }

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

/** @internal */
export function defaultRowTransform(transformer: (str: string) => string) {
  return <A extends object>(rows: ReadonlyArray<A>): ReadonlyArray<A> => {
    const newRows: Array<A> = []
    for (let i = 0, len = rows.length; i < len; i++) {
      const row = rows[i]
      const obj: any = {}
      for (const key in row) {
        obj[transformer(key)] = row[key]
      }
      newRows.push(obj)
    }
    return newRows
  }
}
