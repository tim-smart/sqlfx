/**
 * @since 1.0.0
 */
import * as Data from "@effect/data/Data"
import { pipe } from "@effect/data/Function"
import * as Option from "@effect/data/Option"
import * as Effect from "@effect/io/Effect"
import * as NFS from "node:fs"
import * as Path from "node:path"
import type { SqlError } from "@sqlfx/sql/Error"
import type { Client } from "@sqlfx/sql/Client"

/**
 * @category model
 * @since 1.0.0
 */
export interface MigratorOptions {
  readonly directory: string
  readonly schemaDirectory: string
  readonly table?: string
}

/**
 * @category model
 * @since 1.0.0
 */
export interface Migration {
  readonly id: number
  readonly name: string
  readonly createdAt: Date
}

/**
 * @category errors
 * @since 1.0.0
 */
export interface MigrationError extends Data.Case {
  readonly _tag: "MigrationError"
  readonly reason: "bad-state" | "import-error" | "failed" | "duplicates"
  readonly message: string
}
/**
 * @category errors
 * @since 1.0.0
 */
export const MigrationError: Data.Case.Constructor<MigrationError, "_tag"> =
  Data.tagged<MigrationError>("MigrationError")

/**
 * @category constructor
 * @since 1.0.0
 */
export const make =
  <R extends Client>({
    dumpSchema,
    ensureTable,
    getClient,
    lockTable,
  }: {
    getClient: Effect.Effect<R, SqlError, R>
    dumpSchema: (
      sql: R,
      path: string,
      migrationsTable: string,
    ) => Effect.Effect<never, MigrationError, void>
    ensureTable: (sql: R, table: string) => Effect.Effect<never, SqlError, void>
    lockTable: (sql: R, table: string) => Effect.Effect<never, SqlError, void>
  }) =>
  ({
    directory,
    schemaDirectory,
    table = "sqlfx_migrations",
  }: MigratorOptions): Effect.Effect<
    R,
    MigrationError | SqlError,
    ReadonlyArray<readonly [id: number, name: string]>
  > =>
    Effect.gen(function* (_) {
      const sql = yield* _(getClient)
      const ensureMigrationsTable = ensureTable(table)
      const lockMigrationsTable = lockTable(table)

      const insertMigration = (id: number, name: string) => sql`
      INSERT INTO ${sql(table)} (
        migration_id,
        name
      ) VALUES (
        ${id},
        ${name}
      )
    `
      const latestMigration = Effect.map(
        sql<Migration>`
        SELECT migration_id, name, created_at FROM ${sql(
          table,
        )} ORDER BY migration_id DESC LIMIT 1
      `.values,
        _ =>
          Option.map(
            Option.fromNullable(_[0] as any),
            ([id, name, createdAt]: [number, string, Date]): Migration => ({
              id,
              name,
              createdAt,
            }),
          ),
      )

      const migrationsFromDisk = Effect.catchAllDefect(
        Effect.sync(() =>
          NFS.readdirSync(directory)
            .map(_ =>
              Option.fromNullable(
                Path.basename(_).match(/^(\d+)_([^.]+)\.js$/),
              ),
            )
            .flatMap(
              Option.match(
                () => [],
                ([basename, id, name]) =>
                  [[Number(id), name, basename]] as const,
              ),
            )
            .sort(([a], [b]) => a - b),
        ),
        _ =>
          Effect.as(
            Effect.logInfo(`Could not load migrations from disk: ${_}`),
            [],
          ),
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
            (_): _ is Effect.Effect<never, never, unknown> =>
              Effect.isEffect(_),
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
        pipe(
          Effect.orDieWith(effect, _ =>
            MigrationError({
              reason: "failed",
              message: `Migration ${id}_${name} failed: ${JSON.stringify(_)}`,
            }),
          ),
          Effect.zipRight(insertMigration(id, name)),
        )

      // === run

      const run = Effect.gen(function* (_) {
        yield* _(lockMigrationsTable)

        const [latestMigrationId, current] = yield* _(
          Effect.all(
            Effect.map(
              latestMigration,
              Option.match(
                () => 0,
                _ => _.id,
              ),
            ),
            migrationsFromDisk,
          ),
        )

        if (new Set(current.map(([id]) => id)).size !== current.length) {
          yield* _(
            Effect.fail(
              MigrationError({
                reason: "duplicates",
                message: "Found duplicate migration id's",
              }),
            ),
          )
        }

        const required: Array<
          readonly [
            id: number,
            name: string,
            effect: Effect.Effect<never, never, unknown>,
          ]
        > = []

        for (const [currentId, currentName, basename] of current) {
          if (currentId <= latestMigrationId) {
            continue
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
              Effect.logInfo(`Running migration`),
              Effect.zipRight(runMigration(id, name, effect)),
              Effect.logAnnotate("migration_id", String(id)),
              Effect.logAnnotate("migration_name", name),
            ),
          ),
        )

        yield* _(
          latestMigration,
          Effect.flatMap(
            Option.match(
              () => Effect.logInfo(`Migrations complete`),
              _ =>
                pipe(
                  Effect.logInfo(`Migrations complete`),
                  Effect.logAnnotate("latest_migration_id", _.id.toString()),
                  Effect.logAnnotate("latest_migration_name", _.name),
                ),
            ),
          ),
        )

        return required.map(([id, name]) => [id, name] as const)
      })

      yield* _(ensureMigrationsTable)
      const completed = yield* _(sql.withTransaction(run))

      if (completed.length > 0) {
        yield* _(
          Effect.ignoreLogged(
            dumpSchema(sql, Path.join(schemaDirectory, "_schema.sql")),
          ),
        )
      }

      return completed
    })
