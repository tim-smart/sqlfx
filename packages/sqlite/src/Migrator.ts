/**
 * @since 1.0.0
 */
import * as Effect from "@effect/io/Effect"
import * as Layer from "@effect/io/Layer"
import type { SqlError } from "@sqlfx/sql/Error"
import * as _ from "@sqlfx/sql/Migrator"
import type { SqliteClient } from "@sqlfx/sqlite/node"
import * as internal from "@sqlfx/sqlite/internal/client"

const { fromBabelGlob, fromDisk, fromGlob } = _

export {
  /**
   * @category loader
   * @since 1.0.0
   */
  fromDisk,
  /**
   * @category loader
   * @since 1.0.0
   */
  fromGlob,
  /**
   * @category loader
   * @since 1.0.0
   */
  fromBabelGlob,
}

/**
 * @category constructor
 * @since 1.0.0
 */
export const run: (
  options: _.MigratorOptions,
) => Effect.Effect<
  SqliteClient,
  SqlError | _.MigrationError,
  ReadonlyArray<readonly [id: number, name: string]>
> = _.make({
  getClient: internal.tag,
  ensureTable(sql, table) {
    return sql`
      CREATE TABLE IF NOT EXISTS ${sql(table)} (
        migration_id integer PRIMARY KEY NOT NULL,
        created_at datetime NOT NULL DEFAULT current_timestamp,
        name VARCHAR(255) NOT NULL
      )
    `
  },
  dumpSchema: (sql, path, table) =>
    Effect.gen(function* ($) {
      const { execFile } = yield* $(
        Effect.promise(() => import("node:child_process")),
      )
      const NFS = yield* $(Effect.promise(() => import("node:fs")))
      const Path = yield* $(Effect.promise(() => import("node:path")))

      const sqliteDump = (args: Array<string>) =>
        Effect.map(
          Effect.async<never, _.MigrationError, string>(resume => {
            execFile(
              "sqlite3",
              [sql.config.filename, ...args],
              (error, sql) => {
                if (error) {
                  resume(
                    Effect.fail(
                      _.MigrationError({
                        reason: "failed",
                        message: `Failed to dump schema: ${error}`,
                      }),
                    ),
                  )
                } else {
                  resume(Effect.succeed(sql))
                }
              },
            )
          }),
          _ =>
            _.replace(/^create table sqlite_sequence\(.*$/im, "")
              .replace(/\n{2,}/gm, "\n\n")
              .trim(),
        )

      const dumpSchema = sqliteDump([".schema"])

      const dumpMigrations = sqliteDump([
        "--cmd",
        `.mode insert ${table}`,
        `select * from ${table}`,
      ])

      const dumpAll = Effect.map(
        Effect.all([dumpSchema, dumpMigrations], { concurrency: 2 }),
        ([schema, migrations]) => schema + "\n\n" + migrations,
      )

      const dumpFile = (path: string) =>
        Effect.flatMap(dumpAll, sql =>
          Effect.sync(() => {
            NFS.mkdirSync(Path.dirname(path), {
              recursive: true,
            })
            NFS.writeFileSync(path, sql)
          }),
        )

      return yield* $(dumpFile(path))
    }),
})

/**
 * @category constructor
 * @since 1.0.0
 */
export const makeLayer = (
  options: _.MigratorOptions,
): Layer.Layer<SqliteClient, _.MigrationError | SqlError, never> =>
  Layer.effectDiscard(run(options))
