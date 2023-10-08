import { pipe } from "effect/Function"
import * as Config from "effect/Config"
import * as Effect from "effect/Effect"
import * as Pg from "@sqlfx/pg"

const PgLive = Pg.makeLayer({
  database: Config.succeed("effect_pg_dev"),
  transformQueryNames: Config.succeed(Pg.transform.camelToSnake),
  transformResultNames: Config.succeed(Pg.transform.snakeToCamel),
})

const program = Effect.gen(function* (_) {
  const sql = yield* _(Pg.tag)
  const result = yield* _(
    sql.withTransaction(sql`SELECT * FROM people LIMIT 1`),
    sql.withTransaction,
  )
  console.log(result)
})

pipe(
  program,
  Effect.provide(PgLive),
  Effect.tapErrorCause(Effect.logError),
  Effect.runFork,
)
