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
- [utils](#utils)
  - [Connection (namespace)](#connection-namespace)
    - [Acquirer (type alias)](#acquirer-type-alias)

---

# model

## Connection (interface)

**Signature**

```ts
export interface Connection {
  readonly execute: <A extends object = Row>(
    statement: Statement<A>
  ) => Effect.Effect<never, SqlError, ReadonlyArray<A>>

  readonly executeStream: <A extends object = Row>(statement: Statement<A>) => Stream.Stream<never, SqlError, A>

  readonly executeWithoutTransform: <A extends object = Row>(
    statement: Statement<A>
  ) => Effect.Effect<never, SqlError, ReadonlyArray<A>>

  readonly executeValues: <A extends object = Row>(
    statement: Statement<A>
  ) => Effect.Effect<never, SqlError, ReadonlyArray<ReadonlyArray<Primitive>>>

  readonly executeRaw: <A extends object = Row>(
    sql: string,
    params?: ReadonlyArray<Primitive> | undefined
  ) => Effect.Effect<never, SqlError, ReadonlyArray<A>>
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

# utils

## Connection (namespace)

Added in v1.0.0

### Acquirer (type alias)

**Signature**

```ts
export type Acquirer = Effect.Effect<Scope, SqlError, Connection>
```

Added in v1.0.0
