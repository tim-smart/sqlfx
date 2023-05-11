---
title: Migrator.ts
nav_order: 3
parent: Modules
---

## Migrator overview

Added in v1.0.0

---

<h2 class="text-delta">Table of contents</h2>

- [constructor](#constructor)
  - [makeLayer](#makelayer)
  - [run](#run)
- [errors](#errors)
  - [MigrationError](#migrationerror)
  - [MigrationError (interface)](#migrationerror-interface)
- [model](#model)
  - [MigratorOptions (interface)](#migratoroptions-interface)

---

# constructor

## makeLayer

**Signature**

```ts
export declare const makeLayer: (options: MigratorOptions) => Layer.Layer<unknown, unknown, never>
```

Added in v1.0.0

## run

**Signature**

```ts
export declare const run: ({ directory, table }: MigratorOptions) => Effect.Effect<unknown, unknown, void>
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
  readonly reason: 'bad-state' | 'import-error' | 'failed' | 'duplicates'
  readonly message: string
}
```

Added in v1.0.0

# model

## MigratorOptions (interface)

**Signature**

```ts
export interface MigratorOptions {
  readonly directory: string
  readonly table?: string
}
```

Added in v1.0.0
