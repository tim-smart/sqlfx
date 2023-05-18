import * as Pg from "@sqlfx/pg"
import * as Config from "@effect/io/Config"
import * as Effect from "@effect/io/Effect"
import { pipe } from "@effect/data/Function"
import * as Schema from "@effect/schema/Schema"
import { SchemaClass } from "effect-schema-class"

class Person extends SchemaClass({
  id: Schema.number,
  name: Schema.string,
  createdAt: Schema.DateFromSelf,
}) {}

const InsertPersonSchema = pipe(
  Person.structSchema(),
  Schema.omit("id", "createdAt"),
)

const program = Effect.gen(function* (_) {
  const sql = yield* _(Pg.tag)

  const Insert = sql.resolver(
    "InsertPerson",
    InsertPersonSchema,
    Person.schema(),
    requests => sql`INSERT INTO people ${sql(requests)} RETURNING people.*`,
  )

  const GetById = sql.idResolver(
    "GetPersonById",
    Schema.number,
    Person.schema(),
    _ => _.id,
    ids => sql`SELECT * FROM people WHERE id IN ${sql(ids)}`,
  )

  const inserted = yield* _(
    Effect.allPar(
      Insert.execute({ name: "John Doe" }),
      Insert.execute({ name: "Joe Bloggs" }),
    ),
  )

  console.log(
    yield* _(
      Effect.allPar(
        GetById.execute(inserted[0].id),
        GetById.execute(inserted[1].id),
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
  Effect.tapErrorCause(Effect.logErrorCause),
  Effect.runFork,
)
