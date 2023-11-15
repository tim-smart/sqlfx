import * as Context from "effect/Context"
import { Tag } from "effect/Context"
import { pipe } from "effect/Function"
import * as MutableMap from "effect/MutableHashMap"
import * as Option from "effect/Option"
import * as ROA from "effect/ReadonlyArray"
import * as Effect from "effect/Effect"
import * as Exit from "effect/Exit"
import * as FiberRef from "effect/FiberRef"
import * as request from "effect/Request"
import * as RequestResolver from "effect/RequestResolver"
import * as Schema from "@effect/schema/Schema"
import type { Client, Request, Resolver } from "../Client.js"
import type { Connection } from "../Connection.js"
import { ResultLengthMismatch } from "../Error.js"
import type { SchemaError, SqlError } from "../Error.js"
import * as SqlSchema from "../Schema.js"
import * as Statement from "../Statement.js"

/** @internal */
export const TransactionConn =
  Tag<readonly [conn: Connection, counter: number]>()

/** @internal */
export function make({
  acquirer,
  beginTransaction = "BEGIN",
  commit = "COMMIT",
  compiler,
  rollback = "ROLLBACK",
  rollbackSavepoint = _ => `ROLLBACK TO SAVEPOINT ${_}`,
  savepoint = _ => `SAVEPOINT ${_}`,
  transactionAcquirer,
}: Client.MakeOptions): Client {
  const getConnection = Effect.flatMap(
    Effect.serviceOption(TransactionConn),
    Option.match({
      onNone: () => acquirer,
      onSome: ([conn]) => Effect.succeed(conn),
    }),
  )
  const withTransaction = <R, E, A>(
    effect: Effect.Effect<R, E, A>,
  ): Effect.Effect<R, E | SqlError, A> =>
    Effect.scoped(
      Effect.acquireUseRelease(
        pipe(
          Effect.serviceOption(TransactionConn),
          Effect.flatMap(
            Option.match({
              onNone: () =>
                Effect.map(transactionAcquirer, conn => [conn, 0] as const),
              onSome: ([conn, count]) =>
                Effect.succeed([conn, count + 1] as const),
            }),
          ),
          Effect.tap(([conn, id]) =>
            id > 0
              ? conn.executeRaw(savepoint(`sqlfx${id}`))
              : conn.executeRaw(beginTransaction),
          ),
        ),
        ([conn, id]) =>
          Effect.provideService(effect, TransactionConn, [conn, id]),
        ([conn, id], exit) =>
          Exit.isSuccess(exit)
            ? id > 0
              ? Effect.unit
              : Effect.orDie(conn.executeRaw(commit))
            : id > 0
              ? Effect.orDie(conn.executeRaw(rollbackSavepoint(`sqlfx${id}`)))
              : Effect.orDie(conn.executeRaw(rollback)),
      ),
    )

  function schema<II, IA, AI, A, R, E>(
    requestSchema: Schema.Schema<II, IA>,
    resultSchema: Schema.Schema<AI, A>,
    run: (_: II) => Effect.Effect<R, E, ReadonlyArray<AI>>,
  ) {
    const decodeResult = SqlSchema.parse(Schema.array(resultSchema), "result")
    const encodeRequest = SqlSchema.encode(requestSchema, "request")

    return (_: IA): Effect.Effect<R, SchemaError | E, ReadonlyArray<A>> =>
      pipe(encodeRequest(_), Effect.flatMap(run), Effect.flatMap(decodeResult))
  }

  function voidSchema<II, IA, R, E>(
    requestSchema: Schema.Schema<II, IA>,
    run: (_: II) => Effect.Effect<R, E, any>,
  ) {
    const encodeRequest = SqlSchema.encode(requestSchema, "request")
    return (_: IA): Effect.Effect<R, SchemaError | E, void> =>
      Effect.asUnit(Effect.flatMap(encodeRequest(_), run))
  }

  function singleSchema<II, IA, AI, A, R, E>(
    requestSchema: Schema.Schema<II, IA>,
    resultSchema: Schema.Schema<AI, A>,
    run: (_: II) => Effect.Effect<R, E, ReadonlyArray<AI>>,
  ) {
    const decodeResult = SqlSchema.parse(resultSchema, "result")
    const encodeRequest = SqlSchema.encode(requestSchema, "request")

    return (_: IA): Effect.Effect<R, SchemaError | E, A> =>
      pipe(
        encodeRequest(_),
        Effect.flatMap(run),
        Effect.flatMap(_ => Effect.orDie(ROA.head(_))),
        Effect.flatMap(decodeResult),
      )
  }

  function singleSchemaOption<II, IA, AI, A, R, E>(
    requestSchema: Schema.Schema<II, IA>,
    resultSchema: Schema.Schema<AI, A>,
    run: (_: II) => Effect.Effect<R, E, ReadonlyArray<AI>>,
  ) {
    const decodeResult = SqlSchema.parse(resultSchema, "result")
    const encodeRequest = SqlSchema.encode(requestSchema, "request")

    return (_: IA): Effect.Effect<R, SchemaError | E, Option.Option<A>> =>
      pipe(
        encodeRequest(_),
        Effect.flatMap(run),
        Effect.map(ROA.head),
        Effect.flatMap(
          Option.match({
            onNone: () => Effect.succeedNone,
            onSome: result => Effect.asSome(decodeResult(result)),
          }),
        ),
      )
  }

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
            Option.match(_, {
              onNone: () => context,
              onSome: tconn => Context.add(context, TransactionConn, tconn),
            }),
          ),
      )
      return (i0: RA) =>
        Effect.flatMap(resolverWithSql, resolver =>
          Effect.request(Request({ i0 }), resolver),
        )
    }

  const makePopulateCache =
    <E, A, RA>(
      Request: request.Request.Constructor<
        request.Request<SchemaError | E, A> & { i0: RA }
      >,
    ) =>
    (id: RA, _: A) =>
      Effect.cacheRequestResult(Request({ i0: id }), Exit.succeed(_))

  const makeInvalidateCache =
    <E, A, RA>(
      Request: request.Request.Constructor<
        request.Request<SchemaError | E, A> & { i0: RA }
      >,
    ) =>
    (id: RA) =>
      Effect.flatMap(FiberRef.get(FiberRef.currentRequestCache), cache =>
        cache.invalidate(Request({ i0: id })),
      )

  function singleResolverOption<T extends string, II, IA, AI, A, E>(
    tag: T,
    options: {
      readonly request: Schema.Schema<II, IA>
      readonly result: Schema.Schema<AI, A>
      readonly run: (request: II) => Effect.Effect<never, E, ReadonlyArray<AI>>
    },
  ): Resolver<T, IA, Option.Option<A>, E> {
    const Request = request.tagged<Request<T, IA, E, Option.Option<A>>>(tag)
    const encodeRequest = SqlSchema.encode(options.request, "request")
    const decodeResult = SqlSchema.parse(options.result, "result")
    const Resolver = RequestResolver.fromEffect(
      (req: Request<T, IA, E, Option.Option<A>>) =>
        pipe(
          encodeRequest(req.i0),
          Effect.flatMap(options.run),
          Effect.map(ROA.head),
          Effect.flatMap(
            Option.match({
              onNone: () => Effect.succeedNone,
              onSome: result => Effect.asSome(decodeResult(result)),
            }),
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

  function singleResolver<T extends string, II, IA, AI, A, E>(
    tag: T,
    options: {
      readonly request: Schema.Schema<II, IA>
      readonly result: Schema.Schema<AI, A>
      readonly run: (request: II) => Effect.Effect<never, E, ReadonlyArray<AI>>
    },
  ): Resolver<T, IA, A, E> {
    const Request = request.tagged<Request<T, IA, E, A>>(tag)
    const encodeRequest = SqlSchema.encode(options.request, "request")
    const decodeResult = SqlSchema.parse(options.result, "result")
    const Resolver = RequestResolver.fromEffect((req: Request<T, IA, E, A>) =>
      pipe(
        encodeRequest(req.i0),
        Effect.flatMap(options.run),
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

  function voidResolver<T extends string, II, IA, E>(
    tag: T,
    options: {
      readonly request: Schema.Schema<II, IA>
      readonly run: (
        requests: ReadonlyArray<II>,
      ) => Effect.Effect<never, E, void | ReadonlyArray<unknown>>
    },
  ): Resolver<T, IA, void, E> {
    const Request = request.tagged<Request<T, IA, E, void>>(tag)
    const encodeRequests = SqlSchema.encode(
      Schema.array(options.request),
      "request",
    )
    const Resolver = RequestResolver.makeBatched(
      (requests: Array<Request<T, IA, E, void>>) =>
        pipe(
          encodeRequests(requests.map(_ => _.i0)),
          Effect.flatMap(options.run),
          Effect.zipRight(
            Effect.forEach(
              requests,
              req => request.succeed(req, void 0 as any),
              { discard: true },
            ),
          ),
          Effect.catchAll(error =>
            Effect.forEach(requests, req => request.fail(req, error), {
              discard: true,
            }),
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
  function resolver<T extends string, II, IA, AI, A, E>(
    tag: T,
    options: {
      readonly request: Schema.Schema<II, IA>
      readonly result: Schema.Schema<AI, A>
      readonly run: (
        requests: ReadonlyArray<II>,
      ) => Effect.Effect<never, E, ReadonlyArray<AI>>
    },
  ): Resolver<T, IA, A, E | ResultLengthMismatch> {
    const Request =
      request.tagged<Request<T, IA, E | ResultLengthMismatch, A>>(tag)
    const encodeRequests = SqlSchema.encode(
      Schema.array(options.request),
      "request",
    )
    const decodeResult = SqlSchema.parse(options.result, "result")
    const Resolver = RequestResolver.makeBatched(
      (requests: Array<Request<T, IA, E | ResultLengthMismatch, A>>) =>
        pipe(
          encodeRequests(requests.map(_ => _.i0)),
          Effect.flatMap(options.run),
          Effect.filterOrFail(
            results => results.length === requests.length,
            _ => ResultLengthMismatch(requests.length, _.length),
          ),
          Effect.flatMap(results =>
            Effect.forEach(results, (result, i) =>
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
            Effect.forEach(requests, req => request.fail(req, error), {
              discard: true,
            }),
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

  function idResolverMany<T extends string, II, IA, AI, A, E, K>(
    tag: T,
    options: {
      readonly request: Schema.Schema<II, IA>
      readonly result: Schema.Schema<AI, A>
      readonly requestId: (_: IA) => K
      readonly resultId: (_: AI) => K
      readonly run: (
        requests: ReadonlyArray<II>,
      ) => Effect.Effect<never, E, ReadonlyArray<AI>>
    },
  ): Resolver<T, IA, ReadonlyArray<A>, E> {
    const Request = request.tagged<Request<T, IA, E, ReadonlyArray<A>>>(tag)
    const encodeRequests = SqlSchema.encode(
      Schema.array(options.request),
      "request",
    )
    const decodeResult = SqlSchema.parse(options.result, "result")
    const Resolver = RequestResolver.makeBatched(
      (requests: Array<Request<T, IA, E, ReadonlyArray<A>>>) =>
        pipe(
          Effect.all({
            results: Effect.flatMap(
              encodeRequests(requests.map(_ => _.i0)),
              options.run,
            ),
            requestsMap: Effect.sync(() =>
              requests.reduce(
                (acc, request) =>
                  MutableMap.set(acc, options.requestId(request.i0), [
                    request,
                    [],
                  ]),
                MutableMap.empty<
                  K,
                  readonly [Request<T, IA, E, ReadonlyArray<A>>, Array<A>]
                >(),
              ),
            ),
          }),
          Effect.tap(({ requestsMap, results }) =>
            Effect.forEach(
              results,
              result => {
                const id = options.resultId(result)
                const req = MutableMap.get(requestsMap, id)

                if (req._tag === "None") {
                  return Effect.unit
                }

                return pipe(
                  decodeResult(result),
                  Effect.tap(result =>
                    Effect.sync(() => {
                      req.value[1].push(result)
                    }),
                  ),
                  Effect.catchAll(error =>
                    Effect.zipRight(
                      Effect.sync(() => MutableMap.remove(requestsMap, id)),
                      request.fail(req.value[0], error),
                    ),
                  ),
                )
              },
              { concurrency: "unbounded", discard: true },
            ),
          ),
          Effect.tap(({ requestsMap }) =>
            Effect.forEach(
              requestsMap,
              ([, [req, results]]) => request.succeed(req, results),
              { discard: true },
            ),
          ),
          Effect.catchAll(error =>
            Effect.forEach(requests, req => request.fail(req, error as any), {
              discard: true,
            }),
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

  function idResolver<T extends string, II, IA, AI, A, E>(
    tag: T,
    options: {
      readonly id: Schema.Schema<II, IA>
      readonly result: Schema.Schema<AI, A>
      readonly resultId: (_: AI) => IA
      readonly run: (
        requests: ReadonlyArray<II>,
      ) => Effect.Effect<never, E, ReadonlyArray<AI>>
    },
  ): Resolver<T, IA, Option.Option<A>, E> {
    const Request = request.tagged<Request<T, IA, E, Option.Option<A>>>(tag)
    const encodeRequests = SqlSchema.encode(Schema.array(options.id), "request")
    const decodeResult = SqlSchema.parse(options.result, "result")
    const Resolver = RequestResolver.makeBatched(
      (requests: Array<Request<T, IA, E, Option.Option<A>>>) =>
        pipe(
          Effect.all({
            results: Effect.flatMap(
              encodeRequests(requests.map(_ => _.i0)),
              options.run,
            ),
            requestsMap: Effect.sync(() =>
              requests.reduce(
                (acc, request) => acc.set(request.i0, request),
                new Map<IA, Request<T, IA, E, Option.Option<A>>>(),
              ),
            ),
          }),
          Effect.tap(({ requestsMap, results }) =>
            Effect.forEach(
              results,
              result => {
                const id = options.resultId(result)
                const req = requestsMap.get(id)

                if (!req) {
                  return Effect.unit
                }

                requestsMap.delete(id)

                return pipe(
                  decodeResult(result),
                  Effect.flatMap(result =>
                    request.succeed(req, Option.some(result)),
                  ),
                  Effect.catchAll(error => request.fail(req, error as any)),
                )
              },
              { concurrency: "unbounded", discard: true },
            ),
          ),
          Effect.tap(({ requestsMap }) =>
            Effect.forEach(
              requestsMap.values(),
              req => request.succeed(req, Option.none()),
              { discard: true },
            ),
          ),
          Effect.catchAll(error =>
            Effect.forEach(requests, req => request.fail(req, error as any), {
              discard: true,
            }),
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

  const client: Client = Object.assign(
    Statement.make(getConnection, compiler),
    {
      safe: undefined as any,
      unsafe: Statement.unsafe(getConnection, compiler),
      and: Statement.and,
      or: Statement.or,
      join: Statement.join,
      csv: Statement.csv,
      withTransaction,
      reserve: transactionAcquirer,
      schema,
      singleSchema,
      singleSchemaOption,
      voidSchema,
      resolver,
      singleResolverOption,
      singleResolver,
      voidResolver,
      idResolver,
      idResolverMany,
    },
  )
  ;(client as any).safe = client

  return client
}

/** @internal */
export function defaultTransforms(
  transformer: (str: string) => string,
  nested = true,
) {
  function transformValue(value: any) {
    if (Array.isArray(value)) {
      if (value.length === 0 || value[0].constructor !== Object) {
        return value
      }
      return array(value)
    } else if (value?.constructor === Object) {
      return transformObject(value)
    }
    return value
  }

  function transformObject(obj: Record<string, any>): any {
    const newObj: Record<string, any> = {}
    for (const key in obj) {
      newObj[transformer(key)] = transformValue(obj[key])
    }
    return newObj
  }

  function transformArrayNested<A extends object>(
    rows: ReadonlyArray<A>,
  ): ReadonlyArray<A> {
    const newRows: Array<A> = new Array(rows.length)
    for (let i = 0, len = rows.length; i < len; i++) {
      const row = rows[i]
      const obj: any = {}
      for (const key in row) {
        obj[transformer(key)] = transformValue(row[key])
      }
      newRows[i] = obj
    }
    return newRows
  }

  function transformArray<A extends object>(
    rows: ReadonlyArray<A>,
  ): ReadonlyArray<A> {
    const newRows: Array<A> = new Array(rows.length)
    for (let i = 0, len = rows.length; i < len; i++) {
      const row = rows[i]
      const obj: any = {}
      for (const key in row) {
        obj[transformer(key)] = row[key]
      }
      newRows[i] = obj
    }
    return newRows
  }

  const array = nested ? transformArrayNested : transformArray

  return {
    value: transformValue,
    object: transformObject,
    array,
  } as const
}
