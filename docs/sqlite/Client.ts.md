---
title: Client.ts
nav_order: 2
parent: "@sqlfx/sqlite"
---

## Client overview

Added in v1.0.0

---

<h2 class="text-delta">Table of contents</h2>

- [constructor](#constructor)
  - [makeCompiler](#makecompiler)
- [model](#model)
  - [SqliteClient (interface)](#sqliteclient-interface)
- [tag](#tag)
  - [tag](#tag-1)
- [utils](#utils)
  - [transform](#transform)

---

# constructor

## makeCompiler

**Signature**

```ts
export declare const makeCompiler: (transform?: ((_: string) => string) | undefined) => Statement.Compiler
```

Added in v1.0.0

# model

## SqliteClient (interface)

**Signature**

```ts
export interface SqliteClient extends Client.Client {
  readonly config: unknown
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
