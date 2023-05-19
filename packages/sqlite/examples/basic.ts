import * as Sql from "@sqlfx/sqlite"
import * as Config from "@effect/io/Config"
import * as Effect from "@effect/io/Effect"
import { pipe } from "@effect/data/Function"

const SqlLive = Sql.makeLayer({
  filename: Config.succeed("examples/db.sqlite"),
  transformQueryNames: Config.succeed(Sql.transform.fromCamel),
  transformResultNames: Config.succeed(Sql.transform.toCamel),
})

const program = Effect.gen(function* (_) {
  const sql = yield* _(Sql.tag)
  const result = yield* _(
    sql.withTransaction(sql`SELECT * FROM ${sql("people")} LIMIT 1`),
  )
  console.log(result)
})

pipe(
  program,
  Effect.provideLayer(SqlLive),
  Effect.tapErrorCause(Effect.logErrorCause),
  Effect.runFork,
)
