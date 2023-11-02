---
title: index.ts
nav_order: 2
parent: "@sqlfx/pg"
---

## index overview

Added in v1.0.0

---

<h2 class="text-delta">Table of contents</h2>

- [constructor](#constructor)
  - [PgClientConfig (interface)](#pgclientconfig-interface)
  - [make](#make)
  - [makeCompiler](#makecompiler)
  - [makeLayer](#makelayer)
- [model](#model)
  - [PgClient (interface)](#pgclient-interface)
- [tag](#tag)
  - [tag](#tag-1)
- [utils](#utils)
  - [transform](#transform)

---

# constructor

## PgClientConfig (interface)

**Signature**

```ts
export interface PgClientConfig {
  readonly url?: ConfigSecret.ConfigSecret

  readonly host?: string
  readonly port?: number
  readonly path?: string
  readonly ssl?: boolean
  readonly database?: string
  readonly username?: string
  readonly password?: ConfigSecret.ConfigSecret

  readonly idleTimeout?: Duration.DurationInput
  readonly connectTimeout?: Duration.DurationInput

  readonly maxConnections?: number
  readonly connectionTTL?: Duration.DurationInput

  readonly transformResultNames?: (str: string) => string
  readonly transformQueryNames?: (str: string) => string
  readonly transformJson?: boolean
  readonly fetchTypes?: boolean
}
```

Added in v1.0.0

## make

**Signature**

```ts
export declare const make: (options: PgClientConfig) => Effect.Effect<Scope, never, PgClient>
```

Added in v1.0.0

## makeCompiler

**Signature**

```ts
export declare const makeCompiler: (
  transform?: ((_: string) => string) | undefined,
  transformJson?: boolean
) => Statement.Compiler
```

Added in v1.0.0

## makeLayer

**Signature**

```ts
export declare const makeLayer: (
  config: Config.Config.Wrap<PgClientConfig>
) => Layer.Layer<never, ConfigError, PgClient>
```

Added in v1.0.0

# model

## PgClient (interface)

**Signature**

```ts
export interface PgClient extends Client.Client {
  readonly config: PgClientConfig

  readonly json: (_: unknown) => Fragment
  readonly array: (_: ReadonlyArray<Primitive>) => Fragment
}
```

Added in v1.0.0

# tag

## tag

**Signature**

```ts
export declare const tag: Tag<PgClient, PgClient>
```

Added in v1.0.0

# utils

## transform

Column renaming helpers.

**Signature**

```ts
export declare const transform: typeof transform
```

Added in v1.0.0
