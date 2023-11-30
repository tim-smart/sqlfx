---
title: wasm.ts
nav_order: 9
parent: "@sqlfx/sqlite"
---

## wasm overview

Added in v1.0.0

---

<h2 class="text-delta">Table of contents</h2>

- [constructor](#constructor)
  - [make](#make)
  - [makeCompiler](#makecompiler)
  - [makeLayer](#makelayer)
- [models](#models)
  - [SqliteClient](#sqliteclient)
  - [SqliteWasmClientConfig (type alias)](#sqlitewasmclientconfig-type-alias)
- [tags](#tags)
  - [tag](#tag)
- [utils](#utils)
  - [transform](#transform)

---

# constructor

## make

**Signature**

```ts
export declare const make: (options: SqliteWasmClientConfig) => Effect.Effect<Scope, never, SqliteClient>
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
export declare const makeLayer: (config: SqliteWasmClientConfig) => Layer.Layer<never, never, SqliteClient>
```

Added in v1.0.0

# models

## SqliteClient

**Signature**

```ts
export declare const SqliteClient: SqliteClient
```

Added in v1.0.0

## SqliteWasmClientConfig (type alias)

**Signature**

```ts
export type SqliteWasmClientConfig =
  | {
      readonly mode?: "vfs"
      readonly dbName?: string
      readonly openMode?: OpenMode
      readonly transformResultNames?: (str: string) => string
      readonly transformQueryNames?: (str: string) => string
    }
  | {
      readonly mode: "opfs"
      readonly dbName: string
      readonly openMode?: OpenMode
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
