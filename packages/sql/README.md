# sqlfx

A SQL toolkit for Effect-TS

https://tim-smart.github.io/sqlfx

## Basic example

```ts
import { pipe } from "effect/Function"
import * as Config from "effect/Config"
import * as Effect from "effect/Effect"
import * as Pg from "@sqlfx/pg"

const PgLive = Pg.makeLayer({
  database: Config.succeed("effect_pg_dev"),
})

const program = Effect.gen(function* (_) {
  const sql = yield* _(Pg.tag)

  const people = yield* _(
    sql<{
      readonly id: number
      readonly name: string
    }>`SELECT id, name FROM people`,
  )

  yield* _(Effect.log(`Got ${people.length} results!`))
})

pipe(program, Effect.provideLayer(PgLive), Effect.runPromise)
```

## INSERT resolver

```ts
import { pipe } from "effect/Function"
import * as Effect from "effect/Effect"
import * as Schema from "@effect/schema/Schema"
import * as Pg from "@sqlfx/pg"

class Person extends Schema.class({
  id: Schema.number,
  name: Schema.string,
  createdAt: Schema.DateFromSelf,
  updatedAt: Schema.DateFromSelf,
}) {}

const InsertPersonSchema = pipe(
  Person.schemaStruct(),
  Schema.omit("id", "createdAt", "updatedAt"),
)

export const makePersonService = Effect.gen(function* (_) {
  const sql = yield* _(Pg.tag)

  const insert = sql.resolver(
    "InsertPerson",
    InsertPersonSchema,
    Person.schema(),
    requests =>
      sql`
        INSERT INTO people
        ${sql.insert(requests)}
        RETURNING people.*
      `,
  ).execute

  return { insert }
})
```

## SELECT resolver

```ts
import * as Effect from "effect/Effect"
import * as Schema from "@effect/schema/Schema"
import * as Pg from "@sqlfx/pg"

class Person extends Schema.Class({
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
    ids => sql`SELECT * FROM people WHERE id IN ${sql(ids)}`,
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

import * as Effect from "effect/Effect"
import * as Pg from "@sqlfx/pg"

export default Effect.flatMap(
  Pg.tag,
  sql => sql`
    CREATE TABLE users (
      id serial PRIMARY KEY,
      name varchar(255) NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `,
)
```

To run your migrations:

```ts
// src/main.ts

import * as Effect from "effect/Effect"
import * as Pg from "@sqlfx/pg"
import * as Migrator from "@sqlfx/pg/Migrator"
import * as Config from "effect/Config"
import { fileURLToPath } from "node:url"
import * as Layer from "effect/Layer"
import { pipe } from "effect/Function"

const program = Effect.gen(function* (_) {
  // ...
})

const PgLive = Pg.makeLayer({
  database: Config.succeed("example_database"),
})

const MigratorLive = Layer.provide(
  Migrator.makeLayer({
    directory: fileURLToPath(new URL("migrations", import.meta.url)),
    // Where to put the `_schema.sql` file
    schemaDirectory: "src/migrations",
  }),
  PgLive,
)

const EnvLive = Layer.mergeAll(PgLive, MigratorLive)

pipe(
  program,
  Effect.provideLayer(EnvLive),
  Effect.tapErrorCause(Effect.logErrorCause),
  Effect.runFork,
)
```
