---
title: Error.ts
nav_order: 2
parent: Modules
---

## Error overview

Added in v1.0.0

---

<h2 class="text-delta">Table of contents</h2>

- [constructor](#constructor)
  - [PostgresError](#postgreserror)
  - [ResultLengthMismatch](#resultlengthmismatch)
  - [SchemaError](#schemaerror)
- [model](#model)
  - [PostgresError (interface)](#postgreserror-interface)
  - [RequestError (type alias)](#requesterror-type-alias)
  - [ResultLengthMismatch (interface)](#resultlengthmismatch-interface)
  - [SchemaError (interface)](#schemaerror-interface)
- [utils](#utils)
  - [PgFxErrorId](#pgfxerrorid)
  - [PgFxErrorId (type alias)](#pgfxerrorid-type-alias)
  - [SqlError (type alias)](#sqlerror-type-alias)

---

# constructor

## PostgresError

**Signature**

```ts
export declare const PostgresError: (error: any) => PostgresError
```

Added in v1.0.0

## ResultLengthMismatch

**Signature**

```ts
export declare const ResultLengthMismatch: (expected: number, actual: number) => ResultLengthMismatch
```

Added in v1.0.0

## SchemaError

**Signature**

```ts
export declare const SchemaError: (
  type: SchemaError['type'],
  errors: readonly [ParseErrors, ...ParseErrors[]]
) => SchemaError
```

Added in v1.0.0

# model

## PostgresError (interface)

**Signature**

```ts
export interface PostgresError extends Data.Case {
  readonly [PgFxErrorId]: PgFxErrorId
  readonly _tag: 'PostgresError'
  readonly code: string
  readonly message: string

  readonly detail?: string | undefined
  readonly hint?: string | undefined
  readonly internal_position?: string | undefined
  readonly internal_query?: string | undefined
  readonly where?: string | undefined
  readonly schema_name?: string | undefined
  readonly table_name?: string | undefined
  readonly column_name?: string | undefined
  readonly data?: string | undefined
  readonly type_name?: string | undefined
  readonly constraint_name?: string | undefined
}
```

Added in v1.0.0

## RequestError (type alias)

**Signature**

```ts
export type RequestError = SchemaError | PostgresError
```

Added in v1.0.0

## ResultLengthMismatch (interface)

**Signature**

```ts
export interface ResultLengthMismatch extends Data.Case {
  readonly [PgFxErrorId]: PgFxErrorId
  readonly _tag: 'ResultLengthMismatch'
  readonly expected: number
  readonly actual: number
}
```

Added in v1.0.0

## SchemaError (interface)

**Signature**

```ts
export interface SchemaError extends Data.Case {
  readonly [PgFxErrorId]: PgFxErrorId
  readonly _tag: 'SchemaError'
  readonly type: 'request' | 'result'
  readonly errors: NonEmptyReadonlyArray<ParseErrors>
}
```

Added in v1.0.0

# utils

## PgFxErrorId

**Signature**

```ts
export declare const PgFxErrorId: typeof PgFxErrorId
```

Added in v1.0.0

## PgFxErrorId (type alias)

**Signature**

```ts
export type PgFxErrorId = typeof PgFxErrorId
```

Added in v1.0.0

## SqlError (type alias)

**Signature**

```ts
export type SqlError = never
```

Added in v1.0.0
