---
title: Connection.ts
nav_order: 2
parent: "@sqlfx/sql"
---

## Connection overview

Added in v1.0.0

---

<h2 class="text-delta">Table of contents</h2>

- [model](#model)
  - [Connection (interface)](#connection-interface)
  - [Row (type alias)](#row-type-alias)
- [tag](#tag)
  - [Connection](#connection)

---

# model

## Connection (interface)

**Signature**

```ts
export interface Connection {
  readonly execute: <A extends Row>(statement: Statement<A>) => Effect.Effect<never, SqlError, ReadonlyArray<A>>

  readonly executeValues: <A extends Row>(
    statement: Statement<A>
  ) => Effect.Effect<never, SqlError, ReadonlyArray<ReadonlyArray<Primitive>>>

  readonly executeRaw: (
    sql: string,
    params?: ReadonlyArray<Primitive> | undefined
  ) => Effect.Effect<never, SqlError, ReadonlyArray<Row>>
}
```

Added in v1.0.0

## Row (type alias)

**Signature**

```ts
export type Row = { readonly [column: string]: Primitive }
```

Added in v1.0.0

# tag

## Connection

**Signature**

```ts
export declare const Connection: Tag<Connection, Connection>
```

Added in v1.0.0
