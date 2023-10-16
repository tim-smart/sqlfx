import { pipe } from "effect/Function"
import * as Config from "effect/Config"
import * as Effect from "effect/Effect"
import * as Sql from "@sqlfx/sqlite/bun"

const SqlLive = Sql.makeLayer({
  filename: Config.succeed("examples/db.sqlite"),
  transformQueryNames: Config.succeed(Sql.transform.camelToSnake),
  transformResultNames: Config.succeed(Sql.transform.snakeToCamel),
})

const program = Effect.gen(function* (_) {
  const sql = yield* _(Sql.tag)
  yield* _(
    sql`
      INSERT INTO people ${sql.insert([
        { name: "John" },
        { name: "Jane" },
        { name: "Fred" },
      ])}
    `,
  )
  const result = yield* _(sql`SELECT * FROM people`)
  console.log(result)
})

pipe(
  program,
  Effect.provide(SqlLive),
  Effect.tapErrorCause(Effect.logError),
  Effect.runFork,
)
