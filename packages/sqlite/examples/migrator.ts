import { pipe } from "@effect/data/Function"
import * as Config from "@effect/io/Config"
import * as Effect from "@effect/io/Effect"
import * as Sql from "@sqlfx/sqlite"
import * as Migrator from "@sqlfx/sqlite/Migrator"
import * as Layer from "@effect/io/Layer"

const program = Effect.gen(function* (_) {
  const sql = yield* _(Sql.tag)

  const [{ id }] = yield* _(
    sql`INSERT INTO people (name) VALUES ('John') RETURNING *`,
  )

  const person = yield* _(sql`SELECT * FROM people WHERE id = ${id}`)
  console.log(person[0])
})

const SqlLive = Sql.makeLayer({
  filename: Config.succeed("examples/db.sqlite"),
  transformQueryNames: Config.succeed(Sql.transform.fromCamel),
  transformResultNames: Config.succeed(Sql.transform.toCamel),
})

const MigratorLive = Layer.provide(
  SqlLive,
  Migrator.makeLayer({
    loader: Migrator.fromDisk(`${__dirname}/migrations`),
    schemaDirectory: "examples/migrations",
  }),
)

pipe(
  program,
  Effect.provideLayer(Layer.mergeAll(SqlLive, MigratorLive)),
  Effect.tapErrorCause(Effect.logErrorCause),
  Effect.runFork,
)
