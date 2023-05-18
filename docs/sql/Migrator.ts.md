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
  - [Migration (interface)](#migration-interface)
  - [MigratorOptions (interface)](#migratoroptions-interface)

---

# constructor

## make

**Signature**

```ts
export declare const make: <R extends Client>({
  dumpSchema,
  ensureTable,
  getClient,
  lockTable,
}: {
  getClient: Effect.Effect<R, SqlError, R>
  dumpSchema: (sql: R, path: string, migrationsTable: string) => Effect.Effect<never, MigrationError, void>
  ensureTable: (sql: R, table: string) => Effect.Effect<never, SqlError, void>
  lockTable?: ((sql: R, table: string) => Effect.Effect<never, SqlError, void>) | undefined
}) => ({
  directory,
  schemaDirectory,
  table,
}: MigratorOptions) => Effect.Effect<R, SqlError | MigrationError, readonly (readonly [id: number, name: string])[]>
```

Added in v1.0.0

# errors

## MigrationError

**Signature**

```ts
export declare const MigrationError: Data.Case.Constructor<MigrationError, '_tag'>
```

Added in v1.0.0

## MigrationError (interface)

**Signature**

```ts
export interface MigrationError extends Data.Case {
  readonly _tag: 'MigrationError'
  readonly reason: 'bad-state' | 'import-error' | 'failed' | 'duplicates' | 'locked'
  readonly message: string
}
```

Added in v1.0.0

# model

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
  readonly directory: string
  readonly schemaDirectory: string
  readonly table?: string
}
```

Added in v1.0.0
