---
title: Schema.ts
nav_order: 5
parent: Modules
---

## Schema overview

Added in v1.0.0

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [decode](#decode)
  - [encode](#encode)

---

# utils

## decode

**Signature**

```ts
export declare const decode: <I, A>(
  schema: Schema.Schema<I, A>,
  type: SchemaError['type']
) => (input: I) => Effect.Effect<never, SchemaError, A>
```

Added in v1.0.0

## encode

**Signature**

```ts
export declare const encode: <I, A>(
  schema: Schema.Schema<I, A>,
  type: SchemaError['type']
) => (input: A) => Effect.Effect<never, SchemaError, I>
```

Added in v1.0.0
