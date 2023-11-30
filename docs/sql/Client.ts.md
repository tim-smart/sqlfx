---
title: Client.ts
nav_order: 1
parent: "@sqlfx/sql"
---

## Client overview

Added in v1.0.0

---

<h2 class="text-delta">Table of contents</h2>

- [constructor](#constructor)
  - [make](#make)
- [model](#model)
  - [Client (interface)](#client-interface)
- [models](#models)
  - [Request (interface)](#request-interface)
  - [Resolver (interface)](#resolver-interface)
- [utils](#utils)
  - [Client (namespace)](#client-namespace)
    - [MakeOptions (interface)](#makeoptions-interface)
  - [TransactionConnection](#transactionconnection)
  - [defaultTransforms](#defaulttransforms)

---

# constructor

## make

**Signature**

```ts
export declare const make: ({
  acquirer,
  beginTransaction,
  commit,
  rollback,
  rollbackSavepoint,
  savepoint,
  transactionAcquirer
}: Client.MakeOptions) => Client
```

Added in v1.0.0

# model

## Client (interface)

**Signature**

```ts
export interface Client extends Constructor {
  /**
   * Copy of the client for safeql etc.
   */
  readonly safe: this

  /**
   * Create unsafe SQL query
   */
  readonly unsafe: <A extends object>(sql: string, params?: ReadonlyArray<Primitive> | undefined) => Statement<A>

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
    fallback?: string
  ) => (clauses: ReadonlyArray<string | Fragment>) => Fragment

  readonly reserve: Effect.Effect<Scope, SqlError, Connection>

  /**
   * With the given effect, ensure all sql queries are run in a transaction.
   *
   * Note: This will not include query run inside request resolvers.
   */
  withTransaction<R, E, A>(self: Effect.Effect<R, E, A>): Effect.Effect<R, E | SqlError, A>

  /**
   * Run a sql query with a request schema and a result schema.
   *
   * The request schema is used to validate the input of the query.
   * The result schema is used to validate the output of the query.
   */
  schema<II, IA, AI, A, R, E>(
    requestSchema: Schema.Schema<II, IA>,
    resultSchema: Schema.Schema<AI, A>,
    run: (_: II) => Effect.Effect<R, E, ReadonlyArray<AI>>
  ): (_: IA) => Effect.Effect<R, E | SchemaError, ReadonlyArray<A>>

  /**
   * Run a sql query with a request schema that returns void.
   */
  voidSchema<II, IA, R, E>(
    requestSchema: Schema.Schema<II, IA>,
    run: (_: II) => Effect.Effect<R, E, any>
  ): (_: IA) => Effect.Effect<R, E | SchemaError, void>

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
    run: (_: II) => Effect.Effect<R, E, ReadonlyArray<AI>>
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
    run: (_: II) => Effect.Effect<R, E, ReadonlyArray<AI>>
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

  resolver<T extends string, II, IA, AI, A, E>(
    tag: T,
    options: {
      readonly request: Schema.Schema<II, IA>
      readonly result: Schema.Schema<AI, A>
      readonly run: (requests: ReadonlyArray<II>) => Effect.Effect<never, E, ReadonlyArray<AI>>
    }
  ): Resolver<T, IA, A, E | ResultLengthMismatch>

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
    options: {
      readonly request: Schema.Schema<II, IA>
      readonly result: Schema.Schema<AI, A>
      readonly run: (request: II) => Effect.Effect<never, E, ReadonlyArray<AI>>
    }
  ): Resolver<T, IA, Option<A>, E>

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
    options: {
      readonly request: Schema.Schema<II, IA>
      readonly result: Schema.Schema<AI, A>
      readonly run: (request: II) => Effect.Effect<never, E, ReadonlyArray<AI>>
    }
  ): Resolver<T, IA, A, E>

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
    options: {
      readonly request: Schema.Schema<II, IA>
      readonly run: (requests: ReadonlyArray<II>) => Effect.Effect<never, E, void | ReadonlyArray<unknown>>
    }
  ): Resolver<T, IA, void, E>

  /**
   * Create a resolver for a sql query with a request schema and a result schema.
   * Returns an array of the potentially matching results.
   *
   * Takes a tag parameter to identify the requests.
   * Takes a function to extract the id from the request and result.
   *
   * Returns a resolver, request and an execute function.
   */
  idResolver<T extends string, II, IA, AI, A, E>(
    tag: T,
    options: {
      readonly id: Schema.Schema<II, IA>
      readonly result: Schema.Schema<AI, A>
      readonly resultId: (_: AI) => IA
      readonly run: (requests: ReadonlyArray<II>) => Effect.Effect<never, E, ReadonlyArray<AI>>
    }
  ): Resolver<T, IA, Option<A>, E>

  /**
   * Create a resolver for a sql query with a request schema and a result schema.
   * Returns an array of the potentially matching results.
   *
   * Takes a tag parameter to identify the requests.
   * Takes a function to extract the id from the request and result.
   *
   * Returns a resolver, request and an execute function.
   */
  idResolverMany<T extends string, II, IA, AI, A, E, K>(
    tag: T,
    options: {
      readonly request: Schema.Schema<II, IA>
      readonly requestId: (_: IA) => K
      readonly result: Schema.Schema<AI, A>
      readonly resultId: (_: AI) => K
      readonly run: (requests: ReadonlyArray<II>) => Effect.Effect<never, E, ReadonlyArray<AI>>
    }
  ): Resolver<T, IA, ReadonlyArray<A>, E>
}
```

Added in v1.0.0

# models

## Request (interface)

**Signature**

```ts
export interface Request<T extends string, I, E, A> extends request.Request<SchemaError | E, A> {
  readonly _tag: T
  readonly i0: I
}
```

Added in v1.0.0

## Resolver (interface)

**Signature**

```ts
export interface Resolver<T extends string, I, A, E> {
  readonly Request: request.Request.Constructor<Request<T, I, E, A>, "_tag">
  readonly Resolver: RequestResolver.RequestResolver<Request<T, I, E, A>>
  readonly execute: (_: I) => Effect.Effect<never, SchemaError | E, A>
  readonly makeExecute: (
    Resolver: RequestResolver.RequestResolver<any, never>,
    context?: Context<any>
  ) => (i0: I) => Effect.Effect<never, SchemaError | E, A>
  readonly populateCache: (id: I, _: A) => Effect.Effect<never, never, void>
  readonly invalidateCache: (id: I) => Effect.Effect<never, never, void>
}
```

Added in v1.0.0

# utils

## Client (namespace)

Added in v1.0.0

### MakeOptions (interface)

**Signature**

```ts
export interface MakeOptions {
  readonly acquirer: Connection.Acquirer
  readonly compiler: Compiler
  readonly transactionAcquirer: Connection.Acquirer
  readonly beginTransaction?: string
  readonly rollback?: string
  readonly commit?: string
  readonly savepoint?: (name: string) => string
  readonly rollbackSavepoint?: (name: string) => string
}
```

Added in v1.0.0

## TransactionConnection

**Signature**

```ts
export declare const TransactionConnection: Tag<
  readonly [conn: Connection, counter: number],
  readonly [conn: Connection, counter: number]
>
```

Added in v1.0.0

## defaultTransforms

**Signature**

```ts
export declare const defaultTransforms: (
  transformer: (str: string) => string,
  nested?: boolean
) => {
  readonly value: (value: any) => any
  readonly object: (obj: Record<string, any>) => any
  readonly array: <A extends object>(rows: readonly A[]) => readonly A[]
}
```

Added in v1.0.0
