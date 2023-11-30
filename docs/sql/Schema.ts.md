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
  - [encode](#encode)
  - [parse](#parse)

---

# utils

## encode

**Signature**

```ts
export declare const encode: <I, A>(
  schema: Schema.Schema<I, A>,
  type: SchemaError["type"]
) => (input: A) => Effect.Effect<never, SchemaError, I>
```

Added in v1.0.0

## parse

**Signature**

```ts
export declare const parse: <I, A>(
  schema: Schema.Schema<I, A>,
  type: SchemaError["type"]
) => (input: unknown) => Effect.Effect<never, SchemaError, A>
```

Added in v1.0.0
