---
title: Migrator.ts
nav_order: 2
parent: "@sqlfx/sqlite"
---

## Migrator overview

Added in v1.0.0

---

<h2 class="text-delta">Table of contents</h2>

- [constructor](#constructor)
  - [makeLayer](#makelayer)
  - [run](#run)

---

# constructor

## makeLayer

**Signature**

```ts
export declare const makeLayer: (
  options: _.MigratorOptions
) => Layer.Layer<Sql.SqliteClient, _.MigrationError | SqlError, never>
```

Added in v1.0.0

## run

**Signature**

```ts
export declare const run: ({
  directory,
  schemaDirectory,
  table,
}: _.MigratorOptions) => Effect.Effect<
  Sql.SqliteClient,
  SqlError | _.MigrationError,
  ReadonlyArray<readonly [id: number, name: string]>
>
```

Added in v1.0.0
