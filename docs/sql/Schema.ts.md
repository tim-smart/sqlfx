---
title: Schema.ts
nav_order: 6
parent: "@sqlfx/sql"
---

## Schema overview

Added in v1.0.0

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [decodeUnknown](#decodeunknown)
  - [encode](#encode)

---

# utils

## decodeUnknown

**Signature**

```ts
export declare const decodeUnknown: <R, I, A>(
  schema: Schema.Schema<A, I, R>,
  type: SchemaError["type"]
) => (input: unknown) => Effect.Effect<A, SchemaError, R>
```

Added in v1.0.0

## encode

**Signature**

```ts
export declare const encode: <R, I, A>(
  schema: Schema.Schema<A, I, R>,
  type: SchemaError["type"]
) => (input: A) => Effect.Effect<I, SchemaError, R>
```

Added in v1.0.0
