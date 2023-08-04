import { pipe } from "@effect/data/Function"
import * as Config from "@effect/io/Config"
import * as ConfigSecret from "@effect/io/Config/Secret"
import * as Effect from "@effect/io/Effect"
import * as Stream from "@effect/stream/Stream"
import * as Sql from "@sqlfx/mysql"

const program = Effect.gen(function*(_) {
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
  transformQueryNames: Config.succeed(Sql.transform.fromCamel),
  transformResultNames: Config.succeed(Sql.transform.toCamel),
})

pipe(
  program,
  Effect.provideLayer(SqlLive),
  Effect.tapErrorCause(Effect.logError),
  Effect.runFork,
)
