---
title: Statement.ts
nav_order: 7
parent: "@sqlfx/sql"
---

## Statement overview

Added in v1.0.0

---

<h2 class="text-delta">Table of contents</h2>

- [compiler](#compiler)
  - [makeCompiler](#makecompiler)
- [constructor](#constructor)
  - [and](#and)
  - [csv](#csv)
  - [custom](#custom)
  - [join](#join)
  - [make](#make)
  - [or](#or)
  - [unsafe](#unsafe)
  - [unsafeFragment](#unsafefragment)
- [guard](#guard)
  - [isCustom](#iscustom)
  - [isFragment](#isfragment)
- [model](#model)
  - [Argument (type alias)](#argument-type-alias)
  - [ArrayHelper (interface)](#arrayhelper-interface)
  - [Compiler (interface)](#compiler-interface)
  - [Constructor (interface)](#constructor-interface)
  - [Custom (interface)](#custom-interface)
  - [Fragment (interface)](#fragment-interface)
  - [Helper (type alias)](#helper-type-alias)
  - [Identifier (interface)](#identifier-interface)
  - [Literal (interface)](#literal-interface)
  - [Parameter (interface)](#parameter-interface)
  - [Primitive (type alias)](#primitive-type-alias)
  - [PrimitiveKind (type alias)](#primitivekind-type-alias)
  - [RecordInsertHelper (interface)](#recordinserthelper-interface)
  - [RecordUpdateHelper (interface)](#recordupdatehelper-interface)
  - [RecordUpdateHelperSingle (interface)](#recordupdatehelpersingle-interface)
  - [Segment (type alias)](#segment-type-alias)
  - [Statement (interface)](#statement-interface)
- [type id](#type-id)
  - [FragmentId](#fragmentid)
  - [FragmentId (type alias)](#fragmentid-type-alias)
- [utils](#utils)
  - [defaultEscape](#defaultescape)
  - [primitiveKind](#primitivekind)

---

# compiler

## makeCompiler

**Signature**

```ts
export declare const makeCompiler: <C extends Custom<any, any, any, any> = any>(
  parameterPlaceholder: (index: number) => string,
  onIdentifier: (value: string) => string,
  onRecordUpdate: (
    placeholders: string,
    alias: string,
    columns: string,
    values: ReadonlyArray<ReadonlyArray<Primitive>>
  ) => readonly [sql: string, params: ReadonlyArray<Primitive>],
  onCustom: (type: C, placeholder: () => string) => readonly [sql: string, params: ReadonlyArray<Primitive>],
  onInsert?:
    | ((
        columns: ReadonlyArray<string>,
        placeholders: string,
        values: ReadonlyArray<ReadonlyArray<Primitive>>
      ) => readonly [sql: string, binds: ReadonlyArray<Primitive>])
    | undefined,
  onRecordUpdateSingle?:
    | ((
        columns: ReadonlyArray<string>,
        values: ReadonlyArray<Primitive>
      ) => readonly [sql: string, params: ReadonlyArray<Primitive>])
    | undefined
) => Compiler
```

Added in v1.0.0

# constructor

## and

**Signature**

```ts
export declare const and: (clauses: ReadonlyArray<string | Fragment>) => Fragment
```

Added in v1.0.0

## csv

**Signature**

```ts
export declare const csv: {
  (values: ReadonlyArray<string | Fragment>): Fragment
  (prefix: string, values: ReadonlyArray<string | Fragment>): Fragment
}
```

Added in v1.0.0

## custom

**Signature**

```ts
export declare const custom: <C extends Custom<any, any, any, any>>(
  kind: C["kind"]
) => (i0: C["i0"], i1: C["i1"], i2: C["i2"]) => Fragment
```

Added in v1.0.0

## join

**Signature**

```ts
export declare const join: (
  literal: string,
  addParens?: boolean,
  fallback?: string
) => (clauses: ReadonlyArray<string | Fragment>) => Fragment
```

Added in v1.0.0

## make

**Signature**

```ts
export declare const make: (acquirer: Connection.Acquirer, compiler: Compiler) => Constructor
```

Added in v1.0.0

## or

**Signature**

```ts
export declare const or: (clauses: ReadonlyArray<string | Fragment>) => Fragment
```

Added in v1.0.0

## unsafe

**Signature**

```ts
export declare const unsafe: (
  acquirer: Connection.Acquirer,
  compiler: Compiler
) => <A extends object = Row>(sql: string, params?: ReadonlyArray<Primitive> | undefined) => Statement<A>
```

Added in v1.0.0

## unsafeFragment

**Signature**

```ts
export declare const unsafeFragment: (sql: string, params?: ReadonlyArray<Primitive> | undefined) => Fragment
```

Added in v1.0.0

# guard

## isCustom

**Signature**

```ts
export declare const isCustom: <A extends Custom<any, any, any, any>>(kind: A["kind"]) => (u: unknown) => u is A
```

Added in v1.0.0

## isFragment

**Signature**

```ts
export declare const isFragment: (u: unknown) => u is Fragment
```

Added in v1.0.0

# model

## Argument (type alias)

**Signature**

```ts
export type Argument = Primitive | Helper | Fragment
```

Added in v1.0.0

## ArrayHelper (interface)

**Signature**

```ts
export interface ArrayHelper {
  readonly _tag: "ArrayHelper"
  readonly value: ReadonlyArray<Primitive | Fragment>
}
```

Added in v1.0.0

## Compiler (interface)

**Signature**

```ts
export interface Compiler {
  readonly compile: (statement: Fragment) => readonly [sql: string, params: ReadonlyArray<Primitive>]
}
```

Added in v1.0.0

## Constructor (interface)

**Signature**

```ts
export interface Constructor {
  <A extends object = Row>(strings: TemplateStringsArray, ...args: Array<Argument>): Statement<A>

  (value: string): Identifier

  (value: ReadonlyArray<Primitive | Record<string, Primitive | Fragment>>): ArrayHelper

  readonly insert: {
    (value: ReadonlyArray<Record<string, Primitive | Fragment>>): RecordInsertHelper
    (value: Record<string, Primitive | Fragment>): RecordInsertHelper
  }

  readonly update: <A extends Record<string, Primitive | Fragment>>(
    value: A,
    omit?: ReadonlyArray<keyof A>
  ) => RecordUpdateHelperSingle

  readonly updateValues: (
    value: ReadonlyArray<Record<string, Primitive | Fragment>>,
    alias: string
  ) => RecordUpdateHelper
}
```

Added in v1.0.0

## Custom (interface)

**Signature**

```ts
export interface Custom<T extends string = string, A = void, B = void, C = void> {
  readonly _tag: "Custom"
  readonly kind: T
  readonly i0: A
  readonly i1: B
  readonly i2: C
}
```

Added in v1.0.0

## Fragment (interface)

**Signature**

```ts
export interface Fragment {
  readonly [FragmentId]: (_: never) => FragmentId
  readonly segments: ReadonlyArray<Segment>
}
```

Added in v1.0.0

## Helper (type alias)

**Signature**

```ts
export type Helper =
  | ArrayHelper
  | RecordInsertHelper
  | RecordUpdateHelper
  | RecordUpdateHelperSingle
  | Identifier
  | Custom
```

Added in v1.0.0

## Identifier (interface)

**Signature**

```ts
export interface Identifier {
  readonly _tag: "Identifier"
  readonly value: string
}
```

Added in v1.0.0

## Literal (interface)

**Signature**

```ts
export interface Literal {
  readonly _tag: "Literal"
  readonly value: string
  readonly params?: ReadonlyArray<Primitive> | undefined
}
```

Added in v1.0.0

## Parameter (interface)

**Signature**

```ts
export interface Parameter {
  readonly _tag: "Parameter"
  readonly value: Primitive
}
```

Added in v1.0.0

## Primitive (type alias)

**Signature**

```ts
export type Primitive = string | number | bigint | boolean | Date | null | Int8Array | Uint8Array
```

Added in v1.0.0

## PrimitiveKind (type alias)

**Signature**

```ts
export type PrimitiveKind = "string" | "number" | "bigint" | "boolean" | "Date" | "null" | "Int8Array" | "Uint8Array"
```

Added in v1.0.0

## RecordInsertHelper (interface)

**Signature**

```ts
export interface RecordInsertHelper {
  readonly _tag: "RecordInsertHelper"
  readonly value: ReadonlyArray<Record<string, Primitive | Fragment>>
}
```

Added in v1.0.0

## RecordUpdateHelper (interface)

**Signature**

```ts
export interface RecordUpdateHelper {
  readonly _tag: "RecordUpdateHelper"
  readonly value: ReadonlyArray<Record<string, Primitive | Fragment>>
  readonly alias: string
}
```

Added in v1.0.0

## RecordUpdateHelperSingle (interface)

**Signature**

```ts
export interface RecordUpdateHelperSingle {
  readonly _tag: "RecordUpdateHelperSingle"
  readonly value: Record<string, Primitive | Fragment>
  readonly omit: ReadonlyArray<string>
}
```

Added in v1.0.0

## Segment (type alias)

**Signature**

```ts
export type Segment =
  | Literal
  | Identifier
  | Parameter
  | ArrayHelper
  | RecordInsertHelper
  | RecordUpdateHelper
  | RecordUpdateHelperSingle
  | Custom
```

Added in v1.0.0

## Statement (interface)

**Signature**

```ts
export interface Statement<A> extends Fragment, Equal, Effect<never, SqlError, ReadonlyArray<A>>, Pipeable {
  readonly withoutTransform: Effect<never, SqlError, ReadonlyArray<A>>
  readonly stream: Stream.Stream<never, SqlError, A>
  readonly values: Effect<never, SqlError, ReadonlyArray<ReadonlyArray<Primitive>>>
  readonly compile: () => readonly [sql: string, params: ReadonlyArray<Primitive>]
}
```

Added in v1.0.0

# type id

## FragmentId

**Signature**

```ts
export declare const FragmentId: typeof FragmentId
```

Added in v1.0.0

## FragmentId (type alias)

**Signature**

```ts
export type FragmentId = typeof FragmentId
```

Added in v1.0.0

# utils

## defaultEscape

**Signature**

```ts
export declare const defaultEscape: (c: string) => (str: string) => string
```

Added in v1.0.0

## primitiveKind

**Signature**

```ts
export declare const primitiveKind: (value: Primitive) => PrimitiveKind
```

Added in v1.0.0
