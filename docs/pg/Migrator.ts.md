---
title: Migrator.ts
nav_order: 3
parent: "@sqlfx/pg"
---

## Migrator overview

Added in v1.0.0

---

<h2 class="text-delta">Table of contents</h2>

- [constructor](#constructor)
  - [makeLayer](#makelayer)
  - [run](#run)
- [loader](#loader)
  - [fromDisk](#fromdisk)
  - [fromGlob](#fromglob)
  - [fromRecord](#fromrecord)

---

# constructor

## makeLayer

**Signature**

```ts
export declare const makeLayer: (
  options: _.MigratorOptions
) => Layer.Layer<Pg.PgClient, _.MigrationError | SqlError, never>
```

Added in v1.0.0

## run

**Signature**

```ts
export declare const run: (
  options: _.MigratorOptions
) => Effect.Effect<Pg.PgClient, SqlError | _.MigrationError, ReadonlyArray<readonly [id: number, name: string]>>
```

Added in v1.0.0

# loader

## fromDisk

**Signature**

```ts
export declare const fromDisk: (directory: string) => _.Loader
```

Added in v1.0.0

## fromGlob

**Signature**

```ts
export declare const fromGlob: (migrations: Record<string, () => Promise<any>>) => _.Loader
```

Added in v1.0.0

## fromRecord

**Signature**

```ts
export declare const fromRecord: (migrations: Record<string, any>) => _.Loader
```

Added in v1.0.0
