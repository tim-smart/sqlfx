---
title: Schema.ts
nav_order: 4
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
  type: any
) => (input: A) => Effect.Effect<never, any, I>
```

Added in v1.0.0

## parse

**Signature**

```ts
export declare const parse: <I, A>(
  schema: Schema.Schema<I, A>,
  type: any
) => (input: unknown) => Effect.Effect<never, any, A>
```

Added in v1.0.0
