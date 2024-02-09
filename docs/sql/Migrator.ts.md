---
title: Migrator.ts
nav_order: 4
parent: "@sqlfx/sql"
---

## Migrator overview

Added in v1.0.0

---

<h2 class="text-delta">Table of contents</h2>

- [constructor](#constructor)
  - [make](#make)
- [errors](#errors)
  - [MigrationError](#migrationerror)
  - [MigrationError (interface)](#migrationerror-interface)
- [model](#model)
  - [Loader (type alias)](#loader-type-alias)
  - [Migration (interface)](#migration-interface)
  - [MigratorOptions (interface)](#migratoroptions-interface)
  - [ResolvedMigration (type alias)](#resolvedmigration-type-alias)
- [utils](#utils)
  - [fromBabelGlob](#frombabelglob)
  - [fromGlob](#fromglob)

---

# constructor

## make

**Signature**

```ts
export declare const make: <R extends Client>({
  dumpSchema,
  ensureTable,
  getClient,
  lockTable
}: {
  getClient: Effect.Effect<R, SqlError, R>
  dumpSchema: (sql: R, path: string, migrationsTable: string) => Effect.Effect<void, MigrationError>
  ensureTable: (sql: R, table: string) => Effect.Effect<void, SqlError>
  lockTable?: ((sql: R, table: string) => Effect.Effect<void, SqlError>) | undefined
}) => ({
  loader,
  schemaDirectory,
  table
}: MigratorOptions) => Effect.Effect<readonly (readonly [id: number, name: string])[], SqlError | MigrationError, R>
```

Added in v1.0.0

# errors

## MigrationError

**Signature**

```ts
export declare const MigrationError: Data.Case.Constructor<MigrationError, "_tag">
```

Added in v1.0.0

## MigrationError (interface)

**Signature**

```ts
export interface MigrationError {
  readonly _tag: "MigrationError"
  readonly reason: "bad-state" | "import-error" | "failed" | "duplicates" | "locked"
  readonly message: string
}
```

Added in v1.0.0

# model

## Loader (type alias)

**Signature**

```ts
export type Loader = Effect.Effect<ReadonlyArray<ResolvedMigration>, MigrationError>
```

Added in v1.0.0

## Migration (interface)

**Signature**

```ts
export interface Migration {
  readonly id: number
  readonly name: string
  readonly createdAt: Date
}
```

Added in v1.0.0

## MigratorOptions (interface)

**Signature**

```ts
export interface MigratorOptions {
  readonly loader: Loader
  readonly schemaDirectory?: string
  readonly table?: string
}
```

Added in v1.0.0

## ResolvedMigration (type alias)

**Signature**

```ts
export type ResolvedMigration = readonly [id: number, name: string, load: Effect.Effect<any>]
```

Added in v1.0.0

# utils

## fromBabelGlob

**Signature**

```ts
export declare const fromBabelGlob: (migrations: Record<string, any>) => Loader
```

Added in v1.0.0

## fromGlob

**Signature**

```ts
export declare const fromGlob: (migrations: Record<string, () => Promise<any>>) => Loader
```

Added in v1.0.0
