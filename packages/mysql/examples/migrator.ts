import { pipe } from "@effect/data/Function"
import * as Config from "@effect/io/Config"
import * as ConfigSecret from "@effect/io/Config/Secret"
import * as Effect from "@effect/io/Effect"
import * as Sql from "@sqlfx/mysql"
import * as Migrator from "@sqlfx/mysql/Migrator"
import * as Path from "path"
import * as Layer from "@effect/io/Layer"

const SqlLive = Sql.makeLayer({
  database: Config.succeed("effect_dev"),
  username: Config.succeed("effect"),
  password: Config.succeed(ConfigSecret.fromString("password")),
  transformQueryNames: Config.succeed(Sql.transform.fromCamel),
  transformResultNames: Config.succeed(Sql.transform.toCamel),
})

const MigratorLive = Layer.provide(
  SqlLive,
  Migrator.makeLayer({
    directory: Path.join(__dirname, "migrations"),
    schemaDirectory: "examples/migrations",
  }),
)

pipe(
  Effect.unit(),
  Effect.provideLayer(MigratorLive),
  Effect.tapErrorCause(Effect.logErrorCause),
  Effect.runFork,
)
