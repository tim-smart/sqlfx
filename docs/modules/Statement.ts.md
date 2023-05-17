---
title: Statement.ts
nav_order: 6
parent: Modules
---

## Statement overview

Added in v1.0.0

---

<h2 class="text-delta">Table of contents</h2>

- [compiler](#compiler)
  - [makeCompiler](#makecompiler)
- [constructor](#constructor)
  - [sql](#sql)
  - [unsafe](#unsafe)
- [guard](#guard)
  - [isStatement](#isstatement)
- [model](#model)
  - [Argument (type alias)](#argument-type-alias)
  - [ArrayHelper (interface)](#arrayhelper-interface)
  - [ArrayOfRecordsHelper (interface)](#arrayofrecordshelper-interface)
  - [Compiler (interface)](#compiler-interface)
  - [Helper (type alias)](#helper-type-alias)
  - [Identifier (interface)](#identifier-interface)
  - [Literal (interface)](#literal-interface)
  - [Parameter (interface)](#parameter-interface)
  - [Primitive (type alias)](#primitive-type-alias)
  - [RecordHelper (interface)](#recordhelper-interface)
  - [Segment (type alias)](#segment-type-alias)
  - [Statement (interface)](#statement-interface)
- [type id](#type-id)
  - [StatementId](#statementid)
  - [StatementId (type alias)](#statementid-type-alias)
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
  onRecord: (
    columns: ReadonlyArray<string>,
    identifiers: ReadonlyArray<string>,
    placeholder: string,
    values: ReadonlyArray<ReadonlyArray<Primitive>>
  ) => readonly [sql: string, binds: ReadonlyArray<Primitive>],
  onArray: (
    placeholder: string,
    values: ReadonlyArray<Primitive>
  ) => readonly [sql: string, binds: ReadonlyArray<Primitive>]
) => Compiler
```

Added in v1.0.0

# constructor

## sql

**Signature**

```ts
export declare const sql: {
  (value: Array<Primitive | Record<string, Primitive>>): ArrayHelper
  (value: Array<Record<string, Primitive>>): ArrayOfRecordsHelper
  (value: Record<string, Primitive>): RecordHelper
  (value: string): Identifier
  (strings: TemplateStringsArray, ...args: Array<Statement | Argument>): Statement
}
```

Added in v1.0.0

## unsafe

**Signature**

```ts
export declare const unsafe: (sql: string) => Statement
```

Added in v1.0.0

# guard

## isStatement

**Signature**

```ts
export declare const isStatement: (u: unknown) => u is Statement
```

Added in v1.0.0

# model

## Argument (type alias)

**Signature**

```ts
export type Argument = Primitive | Helper
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

## ArrayOfRecordsHelper (interface)

**Signature**

```ts
export interface ArrayOfRecordsHelper {
  readonly _tag: 'ArrayOfRecordsHelper'
  readonly value: ReadonlyArray<Record<string, Primitive>>
}
```

Added in v1.0.0

## Compiler (interface)

**Signature**

```ts
export interface Compiler {
  readonly compile: (statement: Statement) => readonly [sql: string, binds: ReadonlyArray<Primitive>]
}
```

Added in v1.0.0

## Helper (type alias)

**Signature**

```ts
export type Helper = ArrayHelper | RecordHelper | ArrayOfRecordsHelper | Identifier
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

## RecordHelper (interface)

**Signature**

```ts
export interface RecordHelper {
  readonly _tag: 'RecordHelper'
  readonly value: Record<string, Primitive>
}
```

Added in v1.0.0

## Segment (type alias)

**Signature**

```ts
export type Segment = Literal | Identifier | Parameter | ArrayHelper | RecordHelper | ArrayOfRecordsHelper
```

Added in v1.0.0

## Statement (interface)

**Signature**

```ts
export interface Statement extends Effect<Connection, SqlError, ReadonlyArray<Row>> {
  readonly [StatementId]: (_: never) => StatementId
  readonly segments: ReadonlyArray<Segment>
}
```

Added in v1.0.0

# type id

## StatementId

**Signature**

```ts
export declare const StatementId: typeof StatementId
```

Added in v1.0.0

## StatementId (type alias)

**Signature**

```ts
export type StatementId = typeof StatementId
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
