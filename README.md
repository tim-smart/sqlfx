# pgfx

A simple effect wrapper around postgres.js

## Basic example

```typescript
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

```typescript
import { pipe } from "@effect/data/Function"
import * as Effect from "@effect/io/Effect"
import * as Request from "@effect/io/Request"
import * as Schema from "@effect/schema/Schema"
import { SchemaClass } from "effect-schema-class"
import * as Pg from "pgfx"

class Person extends SchemaClass({
  id: Schema.number,
  name: Schema.string,
  createdAt: Schema.Date,
  updatedAt: Schema.Date,
}) {}

const CreatePersonSchema = pipe(
  Person.structSchema(),
  Schema.omit("id", "createdAt", "updatedAt"),
)
const decodeCreatePerson = Schema.decodeEffect(CreatePersonSchema)

// request
interface CreatePerson extends Request.Request<Pg.RequestError, Person> {
  readonly _tag: "CreatePerson"
  readonly person: Schema.From<typeof CreatePersonSchema>
}
const CreatePerson = Request.tagged<CreatePerson>("CreatePerson")

export const makePersonService = Effect.gen(function* (_) {
  const sql = yield* _(Pg.tag)

  const createResolver = sql.resolver(
    (requests: CreatePerson[]) =>
      sql<
        ReadonlyArray<{
          readonly id: number
          readonly name: string
          readonly createdAt: string
          readonly updatedAt: string
        }>
      >`INSERT INTO people ${sql(
        requests.map(_ => _.person),
      )} RETURNING id, name, createdAt, updatedAt`,
    Person.schema(),
  )

  const create = (person: CreatePerson["person"]) =>
    pipe(
      decodeCreatePerson(person),
      Effect.flatMap(person =>
        Effect.request(CreatePerson({ person }), createResolver),
      ),
    )

  return { create }
})
```

## SELECT resolver

```typescript
import * as Effect from "@effect/io/Effect"
import * as Request from "@effect/io/Request"
import * as Schema from "@effect/schema/Schema"
import { SchemaClass } from "effect-schema-class"
import * as Pg from "pgfx"

class Person extends SchemaClass({
  id: Schema.number,
  name: Schema.string,
  createdAt: Schema.Date,
  updatedAt: Schema.Date,
}) {}

// request
interface GetPersonById extends Request.Request<Pg.RequestError, Person> {
  readonly _tag: "GetPersonById"
  readonly id: number
}
const GetPersonById = Request.tagged<GetPersonById>("GetPersonById")

export const makePersonService = Effect.gen(function* (_) {
  const sql = yield* _(Pg.tag)

  const getByIdResolver = sql.idResolver(
    (requests: GetPersonById[]) =>
      sql<
        ReadonlyArray<{
          readonly id: number
          readonly name: string
          readonly createdAt: string
          readonly updatedAt: string
        }>
      >`SELECT * FROM people WHERE id IN ${sql(requests.map(_ => _.id))}`,
    Person.schema(),
    // Specify an id function for requests and results
    request => request.id,
    result => result.id,
  )

  const getById = (id: number) =>
    Effect.request(GetPersonById({ id }), getByIdResolver)

  return { getById }
})
```
