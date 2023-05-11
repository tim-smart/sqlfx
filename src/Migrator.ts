import * as Data from "@effect/data/Data"
import { pipe } from "@effect/data/Function"
import * as Option from "@effect/data/Option"
import * as Effect from "@effect/io/Effect"
import * as Layer from "@effect/io/Layer"
import * as NFS from "node:fs"
import * as Path from "node:path"
import * as Pg from "pgfx"

export interface MigratorOptions {
  readonly directory: string
  readonly table?: string
}

interface Migration {
  readonly migrationid: number
  readonly name: string
  readonly createdat: Date
}

export interface MigrationError extends Data.Case {
  readonly _tag: "MigrationError"
  readonly reason: "bad-state" | "import-error" | "failed"
  readonly message: string
}
export const MigrationError = Data.tagged<MigrationError>("MigrationError")

export const run = ({
  directory,
  table = "pgfx_migrations",
}: MigratorOptions) =>
  Effect.gen(function* (_) {
    const sql = yield* _(Pg.tag)

    const ensureMigrationsTable = Effect.catchAll(
      sql`select ${table}::regclass`,
      () => sql`
        CREATE TABLE IF NOT EXISTS ${sql(table)} (
          migrationid serial primary key,
          createdat timestamp with time zone not null default now(),
          name text
        )
      `,
    )

    const lockMigrationsTable = sql`
      LOCK TABLE ${sql(table)} IN ACCESS EXCLUSIVE MODE
    `

    const insertMigration = (id: number, name: string) => sql`
      INSERT INTO ${sql(table)} (
        migrationid,
        name
      ) VALUES (
        ${id},
        ${name}
      )
    `

    const completedMigrations = sql<Migration[]>`
      SELECT * FROM ${sql(table)} ORDER BY migrationid ASC
    `

    const latestMigration = Effect.map(
      sql<Migration[]>`
        SELECT * FROM ${sql(table)} ORDER BY migrationid DESC LIMIT 1
      `,
      _ => Option.fromNullable(_[0]),
    )

    const currentMigrations = Effect.sync(() =>
      NFS.readdirSync(directory)
        .map(_ =>
          Option.fromNullable(Path.basename(_).match(/^(\d+)_([^.]+)\.js$/)),
        )
        .flatMap(
          Option.match(
            () => [],
            ([basename, id, name]) => [[Number(id), name, basename]] as const,
          ),
        )
        .sort(([a], [b]) => a - b),
    )

    const loadMigration = (path: string) => {
      const fullPath = Path.join(directory, path)
      return pipe(
        Effect.tryCatchPromise(
          () => import(fullPath),
          () =>
            MigrationError({
              reason: "import-error",
              message: `Could not import migration: ${fullPath}`,
            }),
        ),
        Effect.flatMap(_ =>
          _.default
            ? Effect.succeed(_.default)
            : Effect.fail(
                MigrationError({
                  reason: "import-error",
                  message: `Default export not found for migration: ${fullPath}`,
                }),
              ),
        ),
        Effect.filterOrFail(
          (_): _ is Effect.Effect<never, never, unknown> => Effect.isEffect(_),
          () =>
            MigrationError({
              reason: "import-error",
              message: `Default export was not an Effect for migration: ${fullPath}`,
            }),
        ),
      )
    }

    const runMigration = (
      id: number,
      name: string,
      effect: Effect.Effect<never, never, unknown>,
    ) =>
      Effect.zipRight(
        Effect.orDieWith(effect, _ =>
          MigrationError({
            reason: "failed",
            message: `Migration ${id}_${name} failed: ${JSON.stringify(_)}`,
          }),
        ),
        insertMigration(id, name),
      )

    // === run

    const run = Effect.gen(function* (_) {
      yield* _(lockMigrationsTable)

      const [complete, current] = yield* _(
        Effect.all(completedMigrations, currentMigrations),
      )

      const completedIds = new Set(complete.map(_ => _.migrationid))
      const remainingCompletedIds = new Set(complete.map(_ => _.migrationid))
      const required: (readonly [
        id: number,
        name: string,
        effect: Effect.Effect<never, never, unknown>,
      ])[] = []

      for (const [currentId, currentName, basename] of current) {
        if (completedIds.has(currentId)) {
          remainingCompletedIds.delete(currentId)
          break
        }

        if (remainingCompletedIds.size > 0) {
          yield* _(
            Effect.fail(
              MigrationError({
                reason: "bad-state",
                message: `Could not run migration ${currentId}_${currentName},
as the following already complete migrations would come after it: ${[
                  ...remainingCompletedIds,
                ].join(", ")}`,
              }),
            ),
          )
        }

        required.push([
          currentId,
          currentName,
          yield* _(loadMigration(basename)),
        ])
      }

      yield* _(
        Effect.forEachDiscard(required, ([id, name, effect]) =>
          pipe(
            Effect.logWarning(`Running migration`),
            Effect.zipRight(runMigration(id, name, effect)),
            Effect.logAnnotate("migration_id", String(id)),
            Effect.logAnnotate("migration_name", name),
          ),
        ),
      )

      const latest = yield* _(latestMigration)
      const latestVersion = Option.match(
        latest,
        () => "N/A",
        _ => `${_.migrationid}_${_.name}`,
      )
      yield* _(
        Effect.logInfo(
          `Migrations complete. Current version: ${latestVersion}`,
        ),
      )
    })

    yield* _(ensureMigrationsTable)
    yield* _(sql.withTransaction(run))
  })

export const makeLayer = (options: MigratorOptions) =>
  Layer.effectDiscard(run(options))
