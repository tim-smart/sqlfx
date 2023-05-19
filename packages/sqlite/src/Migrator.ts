/**
 * @since 1.0.0
 */
import * as Effect from "@effect/io/Effect"
import * as Layer from "@effect/io/Layer"
import type { SqlError } from "@sqlfx/sql/Error"
import * as _ from "@sqlfx/sql/Migrator"
import * as Sql from "@sqlfx/sqlite"
import { execFile } from "node:child_process"
import * as NFS from "node:fs"
import * as Path from "node:path"

/**
 * @category constructor
 * @since 1.0.0
 */
export const run: ({
  directory,
  schemaDirectory,
  table,
}: _.MigratorOptions) => Effect.Effect<
  Sql.SqliteClient,
  SqlError | _.MigrationError,
  ReadonlyArray<readonly [id: number, name: string]>
> = _.make({
  getClient: Sql.tag,
  ensureTable(sql, table) {
    return sql`
      CREATE TABLE IF NOT EXISTS ${sql(table)} (
        migration_id integer PRIMARY KEY NOT NULL,
        created_at datetime NOT NULL DEFAULT current_timestamp,
        name VARCHAR(255) NOT NULL
      )
    `
  },
  dumpSchema(sql, path, table) {
    const sqliteDump = (args: Array<string>) =>
      Effect.map(
        Effect.async<never, _.MigrationError, string>(resume => {
          execFile("sqlite3", [sql.config.filename, ...args], (error, sql) => {
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
          })
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
      Effect.zipPar(dumpSchema, dumpMigrations),
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

    return dumpFile(path)
  },
})

/**
 * @category constructor
 * @since 1.0.0
 */
export const makeLayer = (
  options: _.MigratorOptions,
): Layer.Layer<Sql.SqliteClient, _.MigrationError | SqlError, never> =>
  Layer.effectDiscard(run(options))
