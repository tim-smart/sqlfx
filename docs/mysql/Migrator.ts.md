---
title: Migrator.ts
nav_order: 2
parent: "@sqlfx/mysql"
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
) => Layer.Layer<Sql.MysqlClient, _.MigrationError | SqlError, never>
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
  Sql.MysqlClient,
  SqlError | _.MigrationError,
  ReadonlyArray<readonly [id: number, name: string]>
>
```

Added in v1.0.0
