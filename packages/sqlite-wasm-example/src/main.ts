import { pipe } from "@effect/data/Function"
import * as Effect from "@effect/io/Effect"
import * as Layer from "@effect/io/Layer"
import * as Migrator from "@sqlfx/sqlite/Migrator"
import * as Sql from "@sqlfx/sqlite/wasm"

const program = Effect.gen(function* (_) {
  const sql = yield* _(Sql.tag)
  yield* _(
    sql`
      INSERT INTO people ${sql([
        { name: "John" },
        { name: "Jane" },
        { name: "Fred" },
      ])}
    `,
  )
  const result = yield* _(sql`SELECT * FROM people`)
  console.log(result)

  console.log(yield* _(sql.export))
})

const SqlLive = Sql.makeLayer({
  dbName: ":localStorage:",
  transformQueryNames: Sql.transform.fromCamel,
  transformResultNames: Sql.transform.toCamel,
})

const MigratorLive = Layer.provide(
  SqlLive,
  Migrator.makeLayer({
    loader: Migrator.fromGlob(import.meta.glob("./migrations/*.ts")),
  }),
)

const EnvLive = Layer.provideMerge(SqlLive, MigratorLive)

pipe(
  program,
  Effect.provide(EnvLive),
  Effect.tapErrorCause(Effect.logError),
  Effect.runFork,
)
