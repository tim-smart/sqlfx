import { pipe } from "effect/Function"
import * as Config from "effect/Config"
import * as Effect from "effect/Effect"
import * as Schema from "@effect/schema/Schema"
import * as Pg from "@sqlfx/pg"

class Person extends Schema.Class<Person>()({
  id: Schema.number,
  name: Schema.string,
  createdAt: Schema.DateFromSelf,
}) {}

const InsertPersonSchema = pipe(Person.struct, Schema.omit("id", "createdAt"))

const program = Effect.gen(function* (_) {
  const sql = yield* _(Pg.tag)

  const Insert = sql.resolver("InsertPerson", {
    request: InsertPersonSchema,
    result: Person,
    run: requests =>
      sql`INSERT INTO people ${sql.insert(requests)} RETURNING people.*`,
  })

  const GetById = sql.idResolver("GetPersonById", {
    id: Schema.number,
    result: Person,
    resultId: _ => _.id,
    run: ids => sql`SELECT * FROM people WHERE id IN ${sql(ids)}`,
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
