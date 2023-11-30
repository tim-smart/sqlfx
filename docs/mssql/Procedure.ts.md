---
title: Procedure.ts
nav_order: 4
parent: "@sqlfx/mssql"
---

## Procedure overview

Added in v1.0.0

---

<h2 class="text-delta">Table of contents</h2>

- [combinator](#combinator)
  - [compile](#compile)
  - [outputParam](#outputparam)
  - [param](#param)
  - [withRows](#withrows)
- [constructor](#constructor)
  - [make](#make)
- [model](#model)
  - [Procedure (interface)](#procedure-interface)
  - [ProcedureWithValues (interface)](#procedurewithvalues-interface)
- [type id](#type-id)
  - [TypeId](#typeid)
  - [TypeId (type alias)](#typeid-type-alias)
- [utils](#utils)
  - [Procedure (namespace)](#procedure-namespace)
    - [Result (interface)](#result-interface)
    - [ParametersRecord (type alias)](#parametersrecord-type-alias)

---

# combinator

## compile

**Signature**

```ts
export declare const compile: <
  I extends Record<string, Parameter.Parameter<any>>,
  O extends Record<string, Parameter.Parameter<any>>,
  A
>(
  self: Procedure<I, O, A>
) => (input: { readonly [K in keyof I]: I[K] extends Parameter.Parameter<infer T> ? T : never }) => ProcedureWithValues<
  I,
  O,
  A
>
```

Added in v1.0.0

## outputParam

**Signature**

```ts
export declare const outputParam: <A>() => <N extends string, T extends Tedious.TediousType>(
  name: N,
  type: T,
  options?: Tedious.ParameterOptions
) => <I extends Record<string, Parameter.Parameter<any>>, O extends Record<string, Parameter.Parameter<any>>>(
  self: Procedure<I, O, never>
) => Procedure<
  I,
  { [K in keyof (O & { [K in N]: Parameter.Parameter<A> })]: (O & { [K in N]: Parameter.Parameter<A> })[K] },
  never
>
```

Added in v1.0.0

## param

**Signature**

```ts
export declare const param: <A>() => <N extends string, T extends Tedious.TediousType>(
  name: N,
  type: T,
  options?: Tedious.ParameterOptions
) => <I extends Record<string, Parameter.Parameter<any>>, O extends Record<string, Parameter.Parameter<any>>>(
  self: Procedure<I, O, never>
) => Procedure<
  { [K in keyof (I & { [K in N]: Parameter.Parameter<A> })]: (I & { [K in N]: Parameter.Parameter<A> })[K] },
  O,
  never
>
```

Added in v1.0.0

## withRows

**Signature**

```ts
export declare const withRows: <A extends object = Row>() => <
  I extends Record<string, Parameter.Parameter<any>>,
  O extends Record<string, Parameter.Parameter<any>>
>(
  self: Procedure<I, O, never>
) => Procedure<I, O, A>
```

Added in v1.0.0

# constructor

## make

**Signature**

```ts
export declare const make: (name: string) => Procedure<{}, {}>
```

Added in v1.0.0

# model

## Procedure (interface)

**Signature**

```ts
export interface Procedure<
  I extends Record<string, Parameter.Parameter<any>>,
  O extends Record<string, Parameter.Parameter<any>>,
  A = never
> extends Pipeable {
  readonly [TypeId]: (_: never) => A
  readonly _tag: "Procedure"
  readonly name: string
  readonly params: I
  readonly outputParams: O
}
```

Added in v1.0.0

## ProcedureWithValues (interface)

**Signature**

```ts
export interface ProcedureWithValues<
  I extends Record<string, Parameter.Parameter<any>>,
  O extends Record<string, Parameter.Parameter<any>>,
  A
> extends Procedure<I, O, A> {
  readonly values: Procedure.ParametersRecord<I>
}
```

Added in v1.0.0

# type id

## TypeId

**Signature**

```ts
export declare const TypeId: typeof TypeId
```

Added in v1.0.0

## TypeId (type alias)

**Signature**

```ts
export type TypeId = typeof TypeId
```

Added in v1.0.0

# utils

## Procedure (namespace)

Added in v1.0.0

### Result (interface)

**Signature**

```ts
export interface Result<O extends Record<string, Parameter.Parameter<any>>, A> {
  readonly output: ParametersRecord<O>
  readonly rows: ReadonlyArray<A>
}
```

Added in v1.0.0

### ParametersRecord (type alias)

**Signature**

```ts
export type ParametersRecord<A extends Record<string, Parameter.Parameter<any>>> = {
  readonly [K in keyof A]: A[K] extends Parameter.Parameter<infer T> ? T : never
} & {}
```

Added in v1.0.0
