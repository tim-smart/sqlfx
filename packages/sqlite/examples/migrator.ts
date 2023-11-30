/// <reference types="node" />

import { pipe } from "effect/Function"
import * as Config from "effect/Config"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Sql from "@sqlfx/sqlite/node"
import * as Migrator from "@sqlfx/sqlite/Migrator/Node"
import { fileURLToPath } from "node:url"

const program = Effect.gen(function* (_) {
  const sql = yield* _(Sql.tag)

  const [{ id }] = yield* _(
    sql`INSERT INTO people ${sql.insert({ name: "John" })} RETURNING *`,
  )

  const person = yield* _(sql`SELECT * FROM people WHERE id = ${id}`)
  console.log(person[0])
})

const SqlLive = Sql.makeLayer({
  filename: Config.succeed("examples/db.sqlite"),
  transformQueryNames: Config.succeed(Sql.transform.camelToSnake),
  transformResultNames: Config.succeed(Sql.transform.snakeToCamel),
})

const MigratorLive = Layer.provide(
  Migrator.makeLayer({
    loader: Migrator.fromDisk(
      `${fileURLToPath(new URL(".", import.meta.url))}/migrations`,
    ),
    schemaDirectory: "examples/migrations",
  }),
  SqlLive,
)

pipe(
  program,
  Effect.provide(Layer.mergeAll(SqlLive, MigratorLive)),
  Effect.tapErrorCause(Effect.logError),
  Effect.runFork,
)
