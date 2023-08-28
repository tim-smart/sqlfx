import { pipe } from "@effect/data/Function"
import * as Config from "@effect/io/Config"
import * as Effect from "@effect/io/Effect"
import * as Schema from "@effect/schema/Schema"
import * as Pg from "@sqlfx/pg"

class Person extends Schema.Class({
  id: Schema.number,
  name: Schema.string,
  createdAt: Schema.DateFromSelf,
}) {}

const InsertPersonSchema = pipe(
  Person.schemaStruct(),
  Schema.omit("id", "createdAt"),
)

const program = Effect.gen(function*(_) {
  const sql = yield* _(Pg.tag)

  const Insert = sql.resolver("InsertPerson", {
    request: InsertPersonSchema,
    result: Person.schema(),
    run: requests =>
      sql`INSERT INTO people ${sql(requests)} RETURNING people.*`,
  })

  const GetById = sql.idResolver("GetPersonById", {
    id: Schema.number,
    result: Person.schema(),
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
  transformQueryNames: Config.succeed(Pg.transform.fromCamel),
  transformResultNames: Config.succeed(Pg.transform.toCamel),
})

pipe(
  program,
  Effect.provideLayer(PgLive),
  Effect.tapErrorCause(Effect.logError),
  Effect.runFork,
)
