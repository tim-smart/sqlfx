---
title: index.ts
nav_order: 2
parent: Modules
---

## index overview

Added in v1.0.0

---

<h2 class="text-delta">Table of contents</h2>

- [constructor](#constructor)
  - [make](#make)
  - [makeLayer](#makelayer)
- [models](#models)
  - [PgFx (interface)](#pgfx-interface)
  - [Request (interface)](#request-interface)
  - [Resolver (interface)](#resolver-interface)
  - [SqlFragment (interface)](#sqlfragment-interface)
- [tag](#tag)
  - [tag](#tag-1)
- [transform](#transform)
  - [fromCamel](#fromcamel)
  - [fromKebab](#fromkebab)
  - [fromPascal](#frompascal)
  - [toCamel](#tocamel)
  - [toKebab](#tokebab)
  - [toPascal](#topascal)

---

# constructor

## make

**Signature**

```ts
export declare const make: (options: any) => Effect.Effect<Scope, never, PgFx>
```

Added in v1.0.0

## makeLayer

**Signature**

```ts
export declare const makeLayer: (
  config: Config.Config.Wrap<postgres.Options<{}>>
) => Layer.Layer<never, ConfigError, PgFx>
```

Added in v1.0.0

# models

## PgFx (interface)

**Signature**

```ts
export interface PgFx {
  /**
   * Create an Effect from an sql query
   */
  <T extends Record<string, any>>(
    template: TemplateStringsArray,
    ...parameters: ReadonlyArray<ParameterOrFragment<{}>>
  ): Effect.Effect<never, PostgresError, ReadonlyArray<T>>

  /**
   * Query helper
   */
  <T, K extends Rest<T>>(first: T & First<T, K, {}>, ...rest: K): SqlFragment

  /**
   * Create an Effect from an sql query, returning rows as arrays
   */
  readonly values: <T extends Record<string, any>>(
    template: TemplateStringsArray,
    ...parameters: ReadonlyArray<ParameterOrFragment<{}>>
  ) => Effect.Effect<never, PostgresError, PgValuesResult<T>>

  /**
   * Copy of `sql` for use as a safeql target
   */
  readonly safe: PgFx

  /**
   * Create unsafe SQL query
   */
  readonly unsafe: (
    query: string,
    parameters?: Array<ParameterOrJSON<{}>> | undefined,
    queryOptions?: postgres.UnsafeQueryOptions | undefined
  ) => SqlFragment

  /**
   * Create a SQL fragment
   */
  readonly $: (template: TemplateStringsArray, ...parameters: ReadonlyArray<ParameterOrFragment<{}>>) => SqlFragment

  /**
   * Create an array parameter
   */
  readonly array: postgres.Sql['array']

  /**
   * Create a JSON value
   */
  readonly json: postgres.Sql['json']

  /**
   * Create an `AND` chain for a where clause
   */
  readonly and: (clauses: ReadonlyArray<SqlFragment | string>) => SqlFragment

  /**
   * Create an `OR` chain for a where clause
   */
  readonly or: (clauses: ReadonlyArray<SqlFragment | string>) => SqlFragment

  /**
   * Create comma seperated values, with an optional prefix
   */
  readonly csv: {
    (clauses: ReadonlyArray<SqlFragment | string>): SqlFragment
    (prefix: string, clauses: ReadonlyArray<SqlFragment | string>): SqlFragment
  }

  /**
   * Describe the given sql
   */
  describe(
    template: TemplateStringsArray,
    ...parameters: ReadonlyArray<ParameterOrFragment<{}>>
  ): Effect.Effect<never, PostgresError, postgres.Statement>

  /**
   * With the given effect, ensure all sql queries are run in a transaction.
   *
   * Note: This will not include query run inside request resolvers.
   */
  withTransaction<R, E, A>(self: Effect.Effect<R, E, A>): Effect.Effect<R, E | PostgresError, A>

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
  ): (_: IA) => Effect.Effect<R, E | SchemaError, Option.Option<A>>

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
    requestSchema: Schema.Schema<II, IA>,
    resultSchema: Schema.Schema<AI, A>,
    run: (requests: ReadonlyArray<II>) => Effect.Effect<never, PostgresError | E, ReadonlyArray<AI>>,
    context?: Context<any>
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
  singleResolverOption<T extends string, II, IA, AI, A, E>(
    tag: T,
    requestSchema: Schema.Schema<II, IA>,
    resultSchema: Schema.Schema<AI, A>,
    run: (request: II) => Effect.Effect<never, PostgresError | E, ReadonlyArray<AI>>,
    context?: Context<any>
  ): Resolver<T, II, IA, Option.Option<A>, E>

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
    requestSchema: Schema.Schema<II, IA>,
    resultSchema: Schema.Schema<AI, A>,
    run: (request: II) => Effect.Effect<never, PostgresError | E, ReadonlyArray<AI>>,
    context?: Context<any>
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
  voidResolver<T extends string, II, IA, E, X>(
    tag: T,
    requestSchema: Schema.Schema<II, IA>,
    run: (requests: ReadonlyArray<II>) => Effect.Effect<never, PostgresError | E, ReadonlyArray<X>>,
    context?: Context<any>
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
  idResolver<T extends string, II, IA, AI, A, E>(
    tag: T,
    requestSchema: Schema.Schema<II, IA>,
    resultSchema: Schema.Schema<AI, A>,
    resultId: (_: AI) => II,
    run: (requests: ReadonlyArray<II>) => Effect.Effect<never, PostgresError | E, ReadonlyArray<AI>>,
    context?: Context<any>
  ): Resolver<T, II, IA, Option.Option<A>, E>
}
```

Added in v1.0.0

## Request (interface)

**Signature**

```ts
export interface Request<T extends string, I, E, A> extends request.Request<RequestError | E, A> {
  readonly _tag: T
  readonly i0: I
}
```

Added in v1.0.0

## Resolver (interface)

**Signature**

```ts
export interface Resolver<T extends string, II, IA, A, E> {
  readonly Request: request.Request.Constructor<Request<T, II, E, A>, '_tag'>
  readonly Resolver: RequestResolver.RequestResolver<Request<T, II, E, A>>
  execute(_: IA): Effect.Effect<never, RequestError | E, A>
  populateCache(id: II, _: A): Effect.Effect<never, never, void>
  invalidateCache(id: II): Effect.Effect<never, never, void>
}
```

Added in v1.0.0

## SqlFragment (interface)

**Signature**

```ts
export interface SqlFragment {
  readonly _: unique symbol
}
```

Added in v1.0.0

# tag

## tag

**Signature**

```ts
export declare const tag: Tag<PgFx, PgFx>
```

Added in v1.0.0

# transform

## fromCamel

**Signature**

```ts
export declare const fromCamel: any
```

Added in v1.0.0

## fromKebab

**Signature**

```ts
export declare const fromKebab: any
```

Added in v1.0.0

## fromPascal

**Signature**

```ts
export declare const fromPascal: any
```

Added in v1.0.0

## toCamel

**Signature**

```ts
export declare const toCamel: any
```

Added in v1.0.0

## toKebab

**Signature**

```ts
export declare const toKebab: any
```

Added in v1.0.0

## toPascal

**Signature**

```ts
export declare const toPascal: any
```

Added in v1.0.0
