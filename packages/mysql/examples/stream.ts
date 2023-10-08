import { pipe } from "effect/Function"
import * as Config from "effect/Config"
import * as ConfigSecret from "effect/ConfigSecret"
import * as Effect from "effect/Effect"
import * as Stream from "effect/Stream"
import * as Sql from "@sqlfx/mysql"

const program = Effect.gen(function* (_) {
  const sql = yield* _(Sql.tag)
  yield* _(
    sql`INSERT INTO people (name) VALUES ('John')`.pipe(Effect.repeatN(100)),
  )
  const results = yield* _(
    sql`SELECT * FROM people`.stream,
    Stream.tap(_ => Effect.logInfo(_).pipe(Effect.delay("10 millis"))),
    Stream.runCollect,
  )
  console.log(results)
})

const SqlLive = Sql.makeLayer({
  database: Config.succeed("effect_dev"),
  username: Config.succeed("effect"),
  password: Config.succeed(ConfigSecret.fromString("password")),
  transformQueryNames: Config.succeed(Sql.transform.camelToSnake),
  transformResultNames: Config.succeed(Sql.transform.snakeToCamel),
})

pipe(
  program,
  Effect.provide(SqlLive),
  Effect.tapErrorCause(Effect.logError),
  Effect.runFork,
)
