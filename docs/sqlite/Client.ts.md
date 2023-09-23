---
title: Client.ts
nav_order: 1
parent: "@sqlfx/sqlite"
---

## Client overview

Added in v1.0.0

---

<h2 class="text-delta">Table of contents</h2>

- [constructor](#constructor)
  - [SqliteClientConfig (interface)](#sqliteclientconfig-interface)
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

# model

## SqliteClient (interface)

**Signature**

```ts
export interface SqliteClient extends Client.Client {
  readonly config: SqliteClientConfig
  readonly export: Effect.Effect<never, SqlError, Uint8Array>
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
