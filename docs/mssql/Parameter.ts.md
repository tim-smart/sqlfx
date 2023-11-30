---
title: Parameter.ts
nav_order: 3
parent: "@sqlfx/mssql"
---

## Parameter overview

Added in v1.0.0

---

<h2 class="text-delta">Table of contents</h2>

- [constructor](#constructor)
  - [make](#make)
- [model](#model)
  - [Parameter (interface)](#parameter-interface)
- [type id](#type-id)
  - [ParameterId](#parameterid)
  - [ParameterId (type alias)](#parameterid-type-alias)

---

# constructor

## make

**Signature**

```ts
export declare const make: <A>(
  name: string,
  type: Tedious.TediousType,
  options?: Tedious.ParameterOptions
) => Parameter<A>
```

Added in v1.0.0

# model

## Parameter (interface)

**Signature**

```ts
export interface Parameter<A> {
  readonly [ParameterId]: (_: never) => A
  readonly _tag: "Parameter"
  readonly name: string
  readonly type: Tedious.TediousType
  readonly options: Tedious.ParameterOptions
}
```

Added in v1.0.0

# type id

## ParameterId

**Signature**

```ts
export declare const ParameterId: typeof ParameterId
```

Added in v1.0.0

## ParameterId (type alias)

**Signature**

```ts
export type ParameterId = typeof ParameterId
```

Added in v1.0.0
