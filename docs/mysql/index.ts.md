---
title: index.ts
nav_order: 2
parent: "@sqlfx/mysql"
---

## index overview

Added in v1.0.0

---

<h2 class="text-delta">Table of contents</h2>

- [constructor](#constructor)
  - [MysqlClientConfig (interface)](#mysqlclientconfig-interface)
  - [make](#make)
  - [makeCompiler](#makecompiler)
  - [makeLayer](#makelayer)
- [model](#model)
  - [MysqlClient (interface)](#mysqlclient-interface)
- [tag](#tag)
  - [tag](#tag-1)
- [utils](#utils)
  - [transform](#transform)

---

# constructor

## MysqlClientConfig (interface)

**Signature**

```ts
export interface MysqlClientConfig {
  /**
   * Connection URI. Setting this will override the other connection options
   */
  readonly url?: ConfigSecret.ConfigSecret

  readonly host?: string
  readonly port?: number
  readonly database?: string
  readonly username?: string
  readonly password?: ConfigSecret.ConfigSecret

  readonly maxConnections?: number
  readonly connectionTTL?: Duration.DurationInput

  readonly poolConfig?: Mysql.PoolConfig

  readonly transformResultNames?: (str: string) => string
  readonly transformQueryNames?: (str: string) => string
}
```

Added in v1.0.0

## make

**Signature**

```ts
export declare const make: (options: MysqlClientConfig) => Effect.Effect<Scope, never, MysqlClient>
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
  config: Config.Config.Wrap<MysqlClientConfig>
) => Layer.Layer<never, ConfigError, MysqlClient>
```

Added in v1.0.0

# model

## MysqlClient (interface)

**Signature**

```ts
export interface MysqlClient extends Client.Client {
  readonly config: MysqlClientConfig
}
```

Added in v1.0.0

# tag

## tag

**Signature**

```ts
export declare const tag: Tag<MysqlClient, MysqlClient>
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
