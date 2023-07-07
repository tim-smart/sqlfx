/**
 * @since 1.0.0
 */
import * as Data from "@effect/data/Data"
import { pipe } from "@effect/data/Function"
import * as Option from "@effect/data/Option"
import * as Effect from "@effect/io/Effect"
import type { Client } from "@sqlfx/sql/Client"
import type { SqlError } from "@sqlfx/sql/Error"

/**
 * @category model
 * @since 1.0.0
 */
export interface MigratorOptions {
  readonly loader: Loader
  readonly schemaDirectory?: string
  readonly table?: string
}

/**
 * @category model
 * @since 1.0.0
 */
export type Loader = Effect.Effect<
  never,
  MigrationError,
  ReadonlyArray<ResolvedMigration>
>

/**
 * @category model
 * @since 1.0.0
 */
export type ResolvedMigration = readonly [
  id: number,
  name: string,
  load: Effect.Effect<never, never, any>,
]

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
  readonly reason:
    | "bad-state"
    | "import-error"
    | "failed"
    | "duplicates"
    | "locked"
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
    lockTable = () => Effect.unit,
  }: {
    getClient: Effect.Effect<R, SqlError, R>
    dumpSchema: (
      sql: R,
      path: string,
      migrationsTable: string,
    ) => Effect.Effect<never, MigrationError, void>
    ensureTable: (sql: R, table: string) => Effect.Effect<never, SqlError, void>
    lockTable?: (sql: R, table: string) => Effect.Effect<never, SqlError, void>
  }) =>
  ({
    loader,
    schemaDirectory,
    table = "sqlfx_migrations",
  }: MigratorOptions): Effect.Effect<
    R,
    MigrationError | SqlError,
    ReadonlyArray<readonly [id: number, name: string]>
  > =>
    Effect.gen(function* (_) {
      const sql = yield* _(getClient)
      const ensureMigrationsTable = ensureTable(sql, table)

      const insertMigrations = (
        rows: ReadonlyArray<[id: number, name: string]>,
      ) => sql`
        INSERT INTO ${sql(table)}
        ${sql(rows.map(([migration_id, name]) => ({ migration_id, name })))}
      `

      const latestMigration = Effect.map(
        sql<{ migration_id: number; name: string; created_at: Date }>`
          SELECT migration_id, name, created_at FROM ${sql(
            table,
          )} ORDER BY migration_id DESC LIMIT 1
        `.withoutTransform,
        _ =>
          Option.map(
            Option.fromNullable(_[0] as any),
            ({ created_at, migration_id, name }): Migration => ({
              id: migration_id,
              name,
              createdAt: created_at,
            }),
          ),
      )

      const loadMigration = ([id, name, load]: ResolvedMigration) =>
        pipe(
          Effect.catchAllDefect(load, _ =>
            Effect.fail(
              MigrationError({
                reason: "import-error",
                message: `Could not import migration "${id}_${name}"\n\n${_}`,
              }),
            ),
          ),
          Effect.flatMap(_ =>
            _.default
              ? Effect.succeed(_.default?.default ?? _.default)
              : Effect.fail(
                  MigrationError({
                    reason: "import-error",
                    message: `Default export not found for migration "${id}_${name}"`,
                  }),
                ),
          ),
          Effect.filterOrFail({
            filter: (_): _ is Effect.Effect<never, never, unknown> =>
              Effect.isEffect(_),
            orFailWith: () =>
              MigrationError({
                reason: "import-error",
                message: `Default export was not an Effect for migration "${id}_${name}"`,
              }),
          }),
        )

      const runMigration = (
        id: number,
        name: string,
        effect: Effect.Effect<never, never, unknown>,
      ) =>
        Effect.orDieWith(effect, _ =>
          MigrationError({
            reason: "failed",
            message: `Migration "${id}_${name}" failed: ${JSON.stringify(_)}`,
          }),
        )

      // === run

      const run = Effect.gen(function* (_) {
        yield* _(lockTable(sql, table))

        const [latestMigrationId, current] = yield* _(
          Effect.all(
            Effect.map(
              latestMigration,
              Option.match({
                onNone: () => 0,
                onSome: _ => _.id,
              }),
            ),
            loader,
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

        const required: Array<ResolvedMigration> = []

        for (const resolved of current) {
          const [currentId, currentName] = resolved
          if (currentId <= latestMigrationId) {
            continue
          }

          required.push([
            currentId,
            currentName,
            yield* _(loadMigration(resolved)),
          ])
        }

        if (required.length > 0) {
          yield* _(
            insertMigrations(required.map(([id, name]) => [id, name])),
            Effect.mapError(_ =>
              MigrationError({
                reason: "locked",
                message: "Migrations already running",
              }),
            ),
          )
        }

        yield* _(
          Effect.forEach(
            required,
            ([id, name, effect]) =>
              pipe(
                Effect.log(`Running migration`, { level: "Debug" }),
                Effect.zipRight(runMigration(id, name, effect)),
                Effect.annotateLogs("migration_id", String(id)),
                Effect.annotateLogs("migration_name", name),
              ),
            { discard: true },
          ),
        )

        yield* _(
          latestMigration,
          Effect.flatMap(
            Option.match({
              onNone: () =>
                Effect.log(`Migrations complete`, { level: "Debug" }),
              onSome: _ =>
                pipe(
                  Effect.log(`Migrations complete`, { level: "Debug" }),
                  Effect.annotateLogs("latest_migration_id", _.id.toString()),
                  Effect.annotateLogs("latest_migration_name", _.name),
                ),
            }),
          ),
        )

        return required.map(([id, name]) => [id, name] as const)
      })

      yield* _(ensureMigrationsTable)

      const completed = yield* _(
        sql.withTransaction(run),
        Effect.catchTag("MigrationError", _ =>
          _.reason === "locked"
            ? Effect.as(Effect.log(_.message, { level: "Debug" }), [])
            : Effect.fail(_),
        ),
      )

      if (schemaDirectory && completed.length > 0) {
        yield* _(
          dumpSchema(sql, `${schemaDirectory}/_schema.sql`, table),
          Effect.ignoreLogged,
        )
      }

      return completed
    })

/**
 * @since 1.0.0
 */
export const fromDisk = (directory: string): Loader =>
  pipe(
    Effect.promise(() => import("node:fs")),
    Effect.map(NFS =>
      NFS.readdirSync(directory)
        .map(_ =>
          Option.fromNullable(_.match(/^(?:.*\/)?(\d+)_([^.]+)\.(js|ts)$/)),
        )
        .flatMap(
          Option.match({
            onNone: () => [],
            onSome: ([basename, id, name]): ReadonlyArray<ResolvedMigration> =>
              [
                [
                  Number(id),
                  name,
                  Effect.promise(
                    () =>
                      import(
                        /* @vite-ignore */
                        `${directory}/${basename}`
                      ),
                  ),
                ],
              ] as const,
          }),
        )
        .sort(([a], [b]) => a - b),
    ),
    Effect.catchAllDefect(_ =>
      Effect.as(
        Effect.log(`Could not load migrations from disk: ${_}`, {
          level: "Debug",
        }),
        [],
      ),
    ),
  )

/**
 * @since 1.0.0
 */
export const fromGlob = (
  migrations: Record<string, () => Promise<any>>,
): Loader =>
  Effect.succeed(
    Object.keys(migrations)
      .map(_ =>
        Option.fromNullable(_.match(/^(?:.*\/)?(\d+)_([^.]+)\.(js|ts)$/)),
      )
      .flatMap(
        Option.match({
          onNone: () => [],
          onSome: ([key, id, name]) =>
            [
              [Number(id), name, Effect.promise(() => migrations[key]())],
            ] as const,
        }),
      )
      .sort(([a], [b]) => a - b),
  )
