/// <reference types="node" />

import { pipe } from "effect/Function"
import * as Config from "effect/Config"
import * as ConfigSecret from "effect/ConfigSecret"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Sql from "@sqlfx/mysql"
import * as Migrator from "@sqlfx/mysql/Migrator"
import { fileURLToPath } from "node:url"

const program = Effect.gen(function* (_) {
  const sql = yield* _(Sql.tag)

  const [{ id }] = yield* _(
    Effect.zipRight(
      sql`INSERT INTO people (name) VALUES ('John')`,
      sql<{ id: number }>`SELECT LAST_INSERT_ID() AS id`,
    ),
  )

  const person = yield* _(sql`SELECT * FROM people WHERE id = ${id}`)
  console.log(person[0])
})

const SqlLive = Sql.makeLayer({
  database: Config.succeed("effect_dev"),
  username: Config.succeed("effect"),
  password: Config.succeed(ConfigSecret.fromString("password")),
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
