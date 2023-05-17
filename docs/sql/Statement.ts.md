---
title: Statement.ts
nav_order: 5
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
  - [join](#join)
  - [make](#make)
  - [or](#or)
  - [unsafe](#unsafe)
  - [unsafeFragment](#unsafefragment)
- [guard](#guard)
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
  - [RecordInsertHelper (interface)](#recordinserthelper-interface)
  - [RecordUpdateHelper (interface)](#recordupdatehelper-interface)
  - [Segment (type alias)](#segment-type-alias)
  - [Statement (interface)](#statement-interface)
- [type id](#type-id)
  - [FragmentId](#fragmentid)
  - [FragmentId (type alias)](#fragmentid-type-alias)
- [utils](#utils)
  - [defaultCompiler](#defaultcompiler)
  - [defaultEscape](#defaultescape)

---

# compiler

## makeCompiler

**Signature**

```ts
export declare const makeCompiler: (
  parameterPlaceholder: string,
  onIdentifier: (value: string) => string,
  onArray: (
    placeholder: string,
    values: ReadonlyArray<Primitive>
  ) => readonly [sql: string, params: ReadonlyArray<Primitive>],
  onRecordInsert: (
    columns: ReadonlyArray<string>,
    placeholder: string,
    values: ReadonlyArray<ReadonlyArray<Primitive>>
  ) => readonly [sql: string, params: ReadonlyArray<Primitive>],
  onRecordUpdate: (
    columns: ReadonlyArray<readonly [table: string, value: string]>,
    placeholder: string,
    valueAlias: string,
    valueColumns: ReadonlyArray<string>,
    values: ReadonlyArray<ReadonlyArray<Primitive>>
  ) => readonly [sql: string, params: ReadonlyArray<Primitive>],
  onCustom: (kind: string, i0: unknown, i1: unknown) => readonly [sql: string, params: ReadonlyArray<Primitive>]
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

## join

**Signature**

```ts
export declare const join: (
  literal: string,
  addParens?: boolean | undefined,
  fallback?: string | undefined
) => (clauses: ReadonlyArray<string | Fragment>) => Fragment
```

Added in v1.0.0

## make

**Signature**

```ts
export declare const make: (acquirer: Connection.Acquirer) => Constructor
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
  acquirer: Connection.Acquirer
) => <A extends Record<string, any>>(sql: string, params?: ReadonlyArray<Primitive> | undefined) => Statement<A>
```

Added in v1.0.0

## unsafeFragment

**Signature**

```ts
export declare const unsafeFragment: (sql: string, params?: ReadonlyArray<Primitive> | undefined) => Fragment
```

Added in v1.0.0

# guard

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
  readonly _tag: 'ArrayHelper'
  readonly value: ReadonlyArray<Primitive>
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
  (value: Array<Primitive | Record<string, Primitive>>): ArrayHelper
  (value: Array<Record<string, Primitive>>): RecordInsertHelper
  (value: Array<Record<string, Primitive>>, idColumn: string, identifier: string): RecordUpdateHelper
  (value: Record<string, Primitive>): RecordInsertHelper
  (value: Record<string, Primitive>, idColumn: string, identifier: string): RecordUpdateHelper
  (value: string): Identifier
  <A extends Row>(strings: TemplateStringsArray, ...args: Array<Argument>): Statement<A>
}
```

Added in v1.0.0

## Custom (interface)

**Signature**

```ts
export interface Custom {
  readonly _tag: 'Custom'
  readonly kind: string
  readonly i0: unknown
  readonly i1: unknown
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
export type Helper = ArrayHelper | RecordInsertHelper | RecordUpdateHelper | Identifier | Custom
```

Added in v1.0.0

## Identifier (interface)

**Signature**

```ts
export interface Identifier {
  readonly _tag: 'Identifier'
  readonly value: string
}
```

Added in v1.0.0

## Literal (interface)

**Signature**

```ts
export interface Literal {
  readonly _tag: 'Literal'
  readonly value: string
  readonly params?: ReadonlyArray<Primitive> | undefined
}
```

Added in v1.0.0

## Parameter (interface)

**Signature**

```ts
export interface Parameter {
  readonly _tag: 'Parameter'
  readonly value: Primitive
}
```

Added in v1.0.0

## Primitive (type alias)

**Signature**

```ts
export type Primitive = string | number | bigint | boolean | Date | null
```

Added in v1.0.0

## RecordInsertHelper (interface)

**Signature**

```ts
export interface RecordInsertHelper {
  readonly _tag: 'RecordInsertHelper'
  readonly value: ReadonlyArray<Record<string, Primitive>>
}
```

Added in v1.0.0

## RecordUpdateHelper (interface)

**Signature**

```ts
export interface RecordUpdateHelper {
  readonly _tag: 'RecordUpdateHelper'
  readonly value: ReadonlyArray<Record<string, Primitive>>
  readonly idColumn: string
  readonly alias: string
}
```

Added in v1.0.0

## Segment (type alias)

**Signature**

```ts
export type Segment = Literal | Identifier | Parameter | ArrayHelper | RecordInsertHelper | RecordUpdateHelper | Custom
```

Added in v1.0.0

## Statement (interface)

**Signature**

```ts
export interface Statement<A extends Row> extends Fragment, Effect<never, SqlError, ReadonlyArray<A>> {
  readonly values: Effect<never, SqlError, ReadonlyArray<ReadonlyArray<Primitive>>>
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

## defaultCompiler

**Signature**

```ts
export declare const defaultCompiler: Compiler
```

Added in v1.0.0

## defaultEscape

**Signature**

```ts
export declare const defaultEscape: (str: string) => string
```

Added in v1.0.0
