---
title: Stream.ts
nav_order: 8
parent: "@sqlfx/sql"
---

## Stream overview

Added in v1.0.0

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [asyncPauseResume](#asyncpauseresume)

---

# utils

## asyncPauseResume

**Signature**

```ts
export declare const asyncPauseResume: <R, E, A>(
  register: (emit: {
    readonly single: (item: A) => void
    readonly fail: (error: E) => void
    readonly end: () => void
  }) => {
    readonly onInterrupt: Effect.Effect<R, never, void>
    readonly onPause: Effect.Effect<never, never, void>
    readonly onResume: Effect.Effect<never, never, void>
  },
  bufferSize?: number
) => Stream.Stream<R, E, A>
```

Added in v1.0.0
