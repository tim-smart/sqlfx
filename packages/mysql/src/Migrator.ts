/**
 * @since 1.0.0
 */
import * as Effect from "@effect/io/Effect"
import * as Layer from "@effect/io/Layer"
import * as Sql from "@sqlfx/mysql"
import type { SqlError } from "@sqlfx/sql/Error"
import * as _ from "@sqlfx/sql/Migrator"
import { execFile } from "node:child_process"
import * as NFS from "node:fs"
import * as Path from "node:path"
import * as ConfigSecret from "@effect/io/Config/Secret"

const { fromDisk, fromGlob } = _

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
}

/**
 * @category constructor
 * @since 1.0.0
 */
export const run: (
  options: _.MigratorOptions,
) => Effect.Effect<
  Sql.MysqlClient,
  SqlError | _.MigrationError,
  ReadonlyArray<readonly [id: number, name: string]>
> = _.make({
  getClient: Sql.tag,
  ensureTable(sql, table) {
    return sql`
      CREATE TABLE IF NOT EXISTS ${sql(table)} (
        migration_id INTEGER UNSIGNED NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        name VARCHAR(255) NOT NULL,
        PRIMARY KEY (migration_id)
      )
    `
  },
  dumpSchema(sql, path, table) {
    const mysqlDump = (args: Array<string>) =>
      Effect.map(
        Effect.async<never, _.MigrationError, string>(resume => {
          execFile(
            "mysqldump",
            [
              ...(sql.config.username ? ["-u", sql.config.username] : []),
              ...(sql.config.database ? [sql.config.database] : []),
              "--skip-comments",
              "--compact",
              ...args,
            ],
            {
              env: {
                PATH: process.env.PATH,
                MYSQL_HOST: sql.config.host,
                MYSQL_TCP_PORT: sql.config.port?.toString(),
                MYSQL_PWD: sql.config.password
                  ? ConfigSecret.value(sql.config.password)
                  : undefined,
              },
            },
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
          _.replace(/^\/\*.*$/gm, "")
            .replace(/\n{2,}/gm, "\n\n")
            .trim(),
      )

    const dumpSchema = mysqlDump(["--no-data"])

    const dumpMigrations = mysqlDump(["--no-create-info", "--tables", table])

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

    return dumpFile(path)
  },
})

/**
 * @category constructor
 * @since 1.0.0
 */
export const makeLayer = (
  options: _.MigratorOptions,
): Layer.Layer<Sql.MysqlClient, _.MigrationError | SqlError, never> =>
  Layer.effectDiscard(run(options))
