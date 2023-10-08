import { pipe } from "effect/Function"
import * as Config from "effect/Config"
import * as ConfigSecret from "effect/ConfigSecret"
import * as Effect from "effect/Effect"
import * as Sql from "@sqlfx/mysql"

const SqlLive = Sql.makeLayer({
  database: Config.succeed("effect_dev"),
  username: Config.succeed("effect"),
  password: Config.succeed(ConfigSecret.fromString("password")),
  transformQueryNames: Config.succeed(Sql.transform.camelToSnake),
  transformResultNames: Config.succeed(Sql.transform.snakeToCamel),
})

const program = Effect.gen(function* (_) {
  const sql = yield* _(Sql.tag)
  const result = yield* _(
    sql.withTransaction(sql`SELECT * FROM people LIMIT 1`),
    sql.withTransaction,
  )
  console.log(result)
})

pipe(
  program,
  Effect.provide(SqlLive),
  Effect.tapErrorCause(Effect.logError),
  Effect.runFork,
)
