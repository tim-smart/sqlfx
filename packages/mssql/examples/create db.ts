import * as Sql from "@sqlfx/mssql"
import * as Config from "effect/Config"
import * as ConfigSecret from "effect/ConfigSecret"
import * as Effect from "effect/Effect"
import { pipe } from "effect/Function"

const SqlLive = Sql.makeLayer({
  database: Config.succeed("msdb"),
  server: Config.succeed("localhost"),
  username: Config.succeed("sa"),
  password: Config.succeed(ConfigSecret.fromString("$q1Fx_password")),
  transformQueryNames: Config.succeed(Sql.transform.camelToSnake),
  transformResultNames: Config.succeed(Sql.transform.snakeToCamel),
})

const program = Effect.gen(function* (_) {
  const sql = yield* _(Sql.tag)
  yield* _(sql`CREATE DATABASE effect_dev`)
})

pipe(
  program,
  Effect.provide(SqlLive),
  Effect.tapErrorCause(Effect.logError),
  Effect.runFork,
)
