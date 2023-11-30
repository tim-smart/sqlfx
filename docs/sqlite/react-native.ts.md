---
title: react-native.ts
nav_order: 8
parent: "@sqlfx/sqlite"
---

## react-native overview

Added in v1.0.0

---

<h2 class="text-delta">Table of contents</h2>

- [constructor](#constructor)
  - [make](#make)
  - [makeCompiler](#makecompiler)
  - [makeLayer](#makelayer)
- [fiber refs](#fiber-refs)
  - [asyncQuery](#asyncquery)
  - [withAsyncQuery](#withasyncquery)
- [models](#models)
  - [SqliteClient](#sqliteclient)
  - [SqliteRNClientConfig (interface)](#sqliternclientconfig-interface)
- [tags](#tags)
  - [tag](#tag)
- [utils](#utils)
  - [transform](#transform)

---

# constructor

## make

**Signature**

```ts
export declare const make: (options: SqliteRNClientConfig) => Effect.Effect<Scope, never, SqliteClient>
```

Added in v1.0.0

## makeCompiler

**Signature**

```ts
export declare const makeCompiler: (transform?: ((_: string) => string) | undefined) => Statement.Compiler
```

Added in v1.0.0

## makeLayer

**Signature**

```ts
export declare const makeLayer: (config: SqliteRNClientConfig) => Layer.Layer<never, never, SqliteClient>
```

Added in v1.0.0

# fiber refs

## asyncQuery

**Signature**

```ts
export declare const asyncQuery: FiberRef.FiberRef<boolean>
```

Added in v1.0.0

## withAsyncQuery

**Signature**

```ts
export declare const withAsyncQuery: <R, E, A>(effect: Effect.Effect<R, E, A>) => Effect.Effect<R, E, A>
```

Added in v1.0.0

# models

## SqliteClient

**Signature**

```ts
export declare const SqliteClient: SqliteClient
```

Added in v1.0.0

## SqliteRNClientConfig (interface)

**Signature**

```ts
export interface SqliteRNClientConfig {
  readonly filename: string
  readonly location?: string
  readonly transformResultNames?: (str: string) => string
  readonly transformQueryNames?: (str: string) => string
}
```

Added in v1.0.0

# tags

## tag

**Signature**

```ts
export declare const tag: Tag<SqliteClient, SqliteClient>
```

Added in v1.0.0

# utils

## transform

Column renaming helpers.

**Signature**

```ts
export declare const transform: typeof import("/Volumes/Code/sqlfx/packages/sql/src/Transform")
```

Added in v1.0.0
