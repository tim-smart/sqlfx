---
title: wasm.ts
nav_order: 4
parent: "@sqlfx/sqlite"
---

## wasm overview

Added in v1.0.0

---

<h2 class="text-delta">Table of contents</h2>

- [constructor](#constructor)
  - [SqliteWasmClientConfig (type alias)](#sqlitewasmclientconfig-type-alias)
  - [make](#make)
  - [makeCompiler](#makecompiler)
  - [makeLayer](#makelayer)
- [tag](#tag)
  - [tag](#tag-1)
- [utils](#utils)
  - [transform](#transform)

---

# constructor

## SqliteWasmClientConfig (type alias)

**Signature**

```ts
export type SqliteWasmClientConfig =
  | {
      readonly mode?: 'vfs'
      readonly dbName?: string
      readonly openMode?: OpenMode
      readonly transformResultNames?: (str: string) => string
      readonly transformQueryNames?: (str: string) => string
    }
  | {
      readonly mode: 'opfs'
      readonly dbName: string
      readonly openMode?: OpenMode
      readonly transformResultNames?: (str: string) => string
      readonly transformQueryNames?: (str: string) => string
    }
```

Added in v1.0.0

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
