---
title: index.ts
nav_order: 1
parent: "@sqlfx/sqlite"
---

## index overview

Added in v1.0.0

---

<h2 class="text-delta">Table of contents</h2>

- [constructor](#constructor)
  - [SqliteClientConfig (interface)](#sqliteclientconfig-interface)
  - [make](#make)
  - [makeCompiler](#makecompiler)
  - [makeLayer](#makelayer)
- [model](#model)
  - [SqliteClient (interface)](#sqliteclient-interface)
- [tag](#tag)
  - [tag](#tag-1)
- [utils](#utils)
  - [transform](#transform)

---

# constructor

## SqliteClientConfig (interface)

**Signature**

```ts
export interface SqliteClientConfig {
  readonly filename: string
  readonly readonly?: boolean
  readonly prepareCacheSize?: number
  readonly transformResultNames?: (str: string) => string
  readonly transformQueryNames?: (str: string) => string
}
```

Added in v1.0.0

## make

**Signature**

```ts
export declare const make: (options: SqliteClientConfig) => Effect.Effect<Scope, never, SqliteClient>
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
export declare const makeLayer: (
  config: Config.Config.Wrap<SqliteClientConfig>
) => Layer.Layer<never, ConfigError, SqliteClient>
```

Added in v1.0.0

# model

## SqliteClient (interface)

**Signature**

```ts
export interface SqliteClient extends Client.Client {
  readonly config: SqliteClientConfig
}
```

Added in v1.0.0

# tag

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
export declare const transform: typeof transform
```

Added in v1.0.0
