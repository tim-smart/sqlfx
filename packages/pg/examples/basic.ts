import { pipe } from "effect/Function"
import * as Config from "effect/Config"
import * as Effect from "effect/Effect"
import * as Stream from "effect/Stream"
import * as Pg from "@sqlfx/pg"
import { Console } from "effect"

const PgLive = Pg.makeLayer({
  database: Config.succeed("effect_pg_dev"),
  transformQueryNames: Config.succeed(Pg.transform.camelToSnake),
  transformResultNames: Config.succeed(Pg.transform.snakeToCamel),
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

  yield* _(
    sql`SELECT * FROM people`.stream,
    Stream.tap(Effect.logInfo),
    Stream.runDrain,
  )

  yield* _(
    sql`SELECT json_agg(id) as agg_ids FROM people`,
    Effect.tap(Console.log),
  )
})

pipe(
  program,
  Effect.provide(PgLive),
  Effect.tapErrorCause(Effect.logError),
  Effect.runFork,
)
