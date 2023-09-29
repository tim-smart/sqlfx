import { pipe } from "effect/Function"
import * as Config from "effect/Config"
import * as ConfigSecret from "effect/ConfigSecret"
import * as Effect from "effect/Effect"
import * as Sql from "@sqlfx/mssql"
import * as Proc from "@sqlfx/mssql/Procedure"

const SqlLive = Sql.makeLayer({
  database: Config.succeed("effect_dev"),
  server: Config.succeed("localhost"),
  username: Config.succeed("sa"),
  password: Config.succeed(ConfigSecret.fromString("$q1Fx_password")),
  transformQueryNames: Config.succeed(Sql.transform.fromCamel),
  transformResultNames: Config.succeed(Sql.transform.toCamel),
})

const peopleProcedure = pipe(
  Proc.make("people_proc"),
  Proc.param<string>()("name", Sql.TYPES.VarChar),
  Proc.withRows<{ readonly id: number; readonly name: string }>(),
  Proc.compile,
)

const program = Effect.gen(function* (_) {
  const sql = yield* _(Sql.tag)

  yield* _(
    sql`
      IF OBJECT_ID(N'people', N'U') IS NULL
        CREATE TABLE people (
          id INT IDENTITY(1,1) PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          created_at DATETIME NOT NULL
        )
    `,
  )

  yield* _(
    sql`
      CREATE OR ALTER PROC people_proc
        @name VARCHAR(255)
      AS
      BEGIN
        SELECT * FROM people WHERE name = @name
      END
    `,
  )

  // Insert
  const [inserted] = yield* _(
    sql`INSERT INTO ${sql("people")} ${sql({
      name: "Tim",
      createdAt: new Date(),
    })}`,
  )
  console.log(inserted)

  console.log(yield* _(sql`SELECT TOP 3 * FROM ${sql("people")}`))
  console.log(yield* _(sql`SELECT TOP 3 * FROM ${sql("people")}`.values))
  console.log(
    yield* _(sql`SELECT TOP 3 * FROM ${sql("people")}`.withoutTransform),
  )
  console.log(yield* _(sql.call(peopleProcedure({ name: "Tim" }))))

  console.log(
    yield* _(sql`
      UPDATE people
      SET name = data.name
      OUTPUT inserted.*
      FROM ${sql([{ ...inserted, name: "New name" }], "data")}
      WHERE people.id = data.id
    `),
  )

  console.log(
    yield* _(
      sql.withTransaction(
        pipe(
          sql`SELECT TOP 3 * FROM ${sql("people")}`,
          Effect.zipRight(
            Effect.catchAllCause(
              sql.withTransaction(Effect.die("fail")),
              _ => Effect.unit,
            ),
          ),
          Effect.zipRight(
            sql.withTransaction(sql`SELECT TOP 3 * FROM ${sql("people")}`),
          ),
        ),
      ),
    ),
  )
})

pipe(
  program,
  Effect.provide(SqlLive),
  Effect.tapErrorCause(Effect.logError),
  Effect.runFork,
)
