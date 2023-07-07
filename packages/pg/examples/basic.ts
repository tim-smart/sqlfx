import * as Pg from "@sqlfx/pg"
import * as Config from "@effect/io/Config"
import * as Effect from "@effect/io/Effect"
import { pipe } from "@effect/data/Function"

const PgLive = Pg.makeLayer({
  database: Config.succeed("effect_pg_dev"),
  transformQueryNames: Config.succeed(Pg.transform.fromCamel),
  transformResultNames: Config.succeed(Pg.transform.toCamel),
})

const program = Effect.gen(function* (_) {
  const sql = yield* _(Pg.tag)
  const query = yield* _(sql`SELECT ${sql.array([1, 2, "test"])} as test_arr`)
  console.log(query)

  const jsonQuery = yield* _(
    sql`SELECT ${sql.json({ name: "Tim", age: 18 })} as user`,
  )
  console.log(jsonQuery)

  const result = yield* _(
    sql`
      SELECT
        people.*,
        JSON_AGG(users)->0 AS user
      FROM people
      JOIN users ON people.user_id = users.id
      GROUP BY people.id
      LIMIT 1
    `,
  )
  console.log(result)
})

pipe(
  program,
  Effect.provideLayer(PgLive),
  Effect.tapErrorCause(Effect.logCause({ level: "Error" })),
  Effect.runFork,
)
