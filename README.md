# pgfx

A simple effect wrapper around postgres.js

## Basic example

```ts
import { pipe } from "@effect/data/Function"
import * as Config from "@effect/io/Config"
import * as Effect from "@effect/io/Effect"
import * as Pg from "pgfx"

const PgLive = Pg.makeLayer({
  database: Config.succeed("effect_pg_dev"),
})

const program = Effect.gen(function* (_) {
  const sql = yield* _(Pg.tag)

  const people = yield* _(
    sql<
      ReadonlyArray<{
        readonly id: number
        readonly name: string
      }>
    >`SELECT id, name FROM people`,
  )

  yield* _(Effect.log(`Got ${people.length} results!`))
})

pipe(program, Effect.provideLayer(PgLive), Effect.runPromise)
```

## INSERT resolver

```ts
import { pipe } from "@effect/data/Function"
import * as Effect from "@effect/io/Effect"
import * as Schema from "@effect/schema/Schema"
import { SchemaClass } from "effect-schema-class"
import * as Pg from "pgfx"

class Person extends SchemaClass({
  id: Schema.number,
  name: Schema.string,
  createdAt: Schema.DateFromSelf,
  updatedAt: Schema.DateFromSelf,
}) {}

const InsertPersonSchema = pipe(
  Person.structSchema(),
  Schema.omit("id", "createdAt", "updatedAt"),
)

export const makePersonService = Effect.gen(function* (_) {
  const sql = yield* _(Pg.tag)

  const insert = sql.resolver(
    "InsertPerson",
    InsertPersonSchema,
    Person.schema(),
    requests =>
      sql<
        ReadonlyArray<{
          readonly id: number
          readonly name: string
          readonly createdAt: Date
          readonly updatedAt: Date
        }>
      >`
        INSERT INTO people
        ${sql(requests)}
        RETURNING people.*
      `,
  ).execute

  return { insert }
})
```

## SELECT resolver

```ts
import * as Effect from "@effect/io/Effect"
import * as Schema from "@effect/schema/Schema"
import { SchemaClass } from "effect-schema-class"
import * as Pg from "pgfx"

class Person extends SchemaClass({
  id: Schema.number,
  name: Schema.string,
  createdAt: Schema.DateFromSelf,
  updatedAt: Schema.DateFromSelf,
}) {}

export const makePersonService = Effect.gen(function* (_) {
  const sql = yield* _(Pg.tag)

  const getByIdResolver = sql.idResolver(
    "GetPersonById",
    Schema.number,
    Person.schema(),
    _ => _.id,
    ids =>
      sql<
        ReadonlyArray<{
          readonly id: number
          readonly name: string
          readonly createdAt: Date
          readonly updatedAt: Date
        }>
      >`SELECT * FROM people WHERE id IN ${sql(ids)}`,
  )

  const getById = (id: number) =>
    Effect.withRequestCaching("on")(getByIdResolver.execute(id))

  return { getById }
})
```

## Migrations

A `Migrator` module is provided, for running migrations.

Migrations are forward-only, and are written in Typescript as Effect's.

Here is an example migration:

```ts
// src/migrations/0001_add_users.ts

import * as Effect from "@effect/io/Effect"
import * as Pg from "pgfx"

export default Effect.gen(function* (_) {
  const sql = yield* _(Pg.tag)

  yield* _(
    sql`
      CREATE TABLE users (
        id serial PRIMARY KEY,
        name varchar(255) NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `,
  )
})
```

To run your migrations:

```ts
// src/main.ts

import * as Effect from "@effect/io/Effect"
import * as Pg from "pgfx"
import * as Migrator from "pgfx/Migrator"
import * as Config from "@effect/io/Config"
import { fileURLToPath } from "node:url"
import * as Layer from "@effect/io/Layer"
import { pipe } from "@effect/data/Function"

const program = Effect.gen(function* (_) {
  // ...
})

const PgLive = Pg.makeLayer({
  database: Config.succeed("example_database"),
})

const MigratorLive = Layer.provide(
  PgLive,
  Migrator.makeLayer({
    directory: fileURLToPath(new URL("migrations", import.meta.url)),
  }),
)

const EnvLive = Layer.mergeAll(PgLive, MigratorLive)

pipe(
  program,
  Effect.provideLayer(EnvLive),
  Effect.tapErrorCause(Effect.logErrorCause),
  Effect.runFork,
)
```
