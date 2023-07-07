---
title: index.ts
nav_order: 2
parent: "@sqlfx/mssql"
---

## index overview

Added in v1.0.0

---

<h2 class="text-delta">Table of contents</h2>

- [constructor](#constructor)
  - [MssqlClientConfig (interface)](#mssqlclientconfig-interface)
  - [make](#make)
  - [makeCompiler](#makecompiler)
  - [makeLayer](#makelayer)
- [model](#model)
  - [MssqlClient (interface)](#mssqlclient-interface)
- [tag](#tag)
  - [tag](#tag-1)
- [utils](#utils)
  - [TYPES](#types)
  - [defaultParameterTypes](#defaultparametertypes)
  - [transform](#transform)

---

# constructor

## MssqlClientConfig (interface)

**Signature**

```ts
export interface MssqlClientConfig {
  readonly domain?: string
  readonly server?: string
  readonly trustServer?: boolean
  readonly port?: number
  readonly authType?: string
  readonly database?: string
  readonly username?: string
  readonly password?: ConfigSecret.ConfigSecret
  readonly connectTimeout?: DurationInput

  readonly minConnections?: number
  readonly maxConnections?: number
  readonly connectionTTL?: DurationInput

  readonly parameterTypes?: Record<Statement.PrimitiveKind, Tedious.TediousType>

  readonly transformResultNames?: (str: string) => string
  readonly transformQueryNames?: (str: string) => string
}
```

Added in v1.0.0

## make

**Signature**

```ts
export declare const make: (options: MssqlClientConfig) => Effect.Effect<Scope, never, MssqlClient>
```

Added in v1.0.0

## makeCompiler

**Signature**

```ts
export declare const makeCompiler: (transform?: ((_: string) => string) | undefined) => Statement.Compiler
```

Added in v1.0.0

## makeLayer

**Signature**

```ts
export declare const makeLayer: (
  config: Config.Config.Wrap<MssqlClientConfig>
) => Layer.Layer<never, ConfigError, MssqlClient>
```

Added in v1.0.0

# model

## MssqlClient (interface)

**Signature**

```ts
export interface MssqlClient extends Client.Client {
  readonly config: MssqlClientConfig

  readonly param: (
    type: Tedious.TediousType,
    value: Statement.Primitive,
    options?: Tedious.ParameterOptions
  ) => Statement.Fragment

  readonly call: <I extends Record<string, Parameter<any>>, O extends Record<string, Parameter<any>>, A extends object>(
    procedure: ProcedureWithValues<I, O, A>
  ) => Effect.Effect<never, SqlError, Procedure.Result<O, A>>
}
```

Added in v1.0.0

# tag

## tag

**Signature**

```ts
export declare const tag: Tag<MssqlClient, MssqlClient>
```

Added in v1.0.0

# utils

## TYPES

Parameter types

**Signature**

```ts
export declare const TYPES: Tedious.TediousTypes
```

Added in v1.0.0

## defaultParameterTypes

**Signature**

```ts
export declare const defaultParameterTypes: Record<Statement.PrimitiveKind, Tedious.TediousType>
```

Added in v1.0.0

## transform

Column renaming helpers.

**Signature**

```ts
export declare const transform: typeof transform
```

Added in v1.0.0
