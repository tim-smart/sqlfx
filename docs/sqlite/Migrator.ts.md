---
title: Migrator.ts
nav_order: 5
parent: "@sqlfx/sqlite"
---

## Migrator overview

Added in v1.0.0

---

<h2 class="text-delta">Table of contents</h2>

- [constructor](#constructor)
  - [makeLayer](#makelayer)
  - [run](#run)
- [loader](#loader)
  - [fromBabelGlob](#frombabelglob)
  - [fromGlob](#fromglob)

---

# constructor

## makeLayer

**Signature**

```ts
export declare const makeLayer: (
  options: _.MigratorOptions
) => Layer.Layer<SqliteClient, _.MigrationError | SqlError, never>
```

Added in v1.0.0

## run

**Signature**

```ts
export declare const run: (
  options: _.MigratorOptions
) => Effect.Effect<SqliteClient, SqlError | _.MigrationError, ReadonlyArray<readonly [id: number, name: string]>>
```

Added in v1.0.0

# loader

## fromBabelGlob

**Signature**

```ts
export declare const fromBabelGlob: (migrations: Record<string, any>) => _.Loader
```

Added in v1.0.0

## fromGlob

**Signature**

```ts
export declare const fromGlob: (migrations: Record<string, () => Promise<any>>) => _.Loader
```

Added in v1.0.0
