import * as Schema from "@effect/schema/Schema"
import * as Pg from "@sqlfx/pg"
import * as Config from "effect/Config"
import * as Effect from "effect/Effect"
import { pipe } from "effect/Function"

class Person extends Schema.Class<Person>("Person")({
  id: Schema.Number,
  name: Schema.String,
  createdAt: Schema.DateFromSelf,
}) {}

const InsertPersonSchema = pipe(
  Schema.Struct(Person.fields),
  Schema.omit("id", "createdAt"),
)

const program = Effect.gen(function* (_) {
  const sql = yield* _(Pg.tag)

  const Insert = sql.resolver("InsertPerson", {
    request: InsertPersonSchema,
    result: Person,
    run: requests =>
      sql`INSERT INTO people ${sql.insert(requests)} RETURNING people.*`,
  })

  const GetById = sql.resolverId("GetPersonById", {
    id: Schema.Number,
    result: Person,
    resultId: _ => _.id,
    run: ids => sql`SELECT * FROM people WHERE id IN ${sql(ids)}`,
  })

  const GetByName = sql.resolverIdMany("GetPersonByName", {
    request: Schema.String,
    requestId: _ => _,
    result: Person,
    resultId: _ => _.name,
    run: ids => sql`SELECT * FROM people WHERE name IN ${sql(ids)}`,
  })

  const inserted = yield* _(
    Effect.all(
      [
        Insert.execute({ name: "John Doe" }),
        Insert.execute({ name: "Joe Bloggs" }),
      ],
      { batching: true },
    ),
  )

  console.log(
    yield* _(
      Effect.all(
        [GetById.execute(inserted[0].id), GetById.execute(inserted[1].id)],
        { batching: true },
      ),
    ),
  )

  console.log(
    yield* _(
      Effect.forEach(
        ["John Doe", "Joe Bloggs", "John Doe"],
        id => GetByName.execute(id),
        { batching: true },
      ),
    ),
  )
})

const PgLive = Pg.makeLayer({
  database: Config.succeed("effect_pg_dev"),
  transformQueryNames: Config.succeed(Pg.transform.camelToSnake),
  transformResultNames: Config.succeed(Pg.transform.snakeToCamel),
})

pipe(
  program,
  Effect.provide(PgLive),
  Effect.tapErrorCause(Effect.logError),
  Effect.runFork,
)
