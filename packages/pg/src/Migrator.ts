/**
 * @since 1.0.0
 */
/// <reference types="node" />

import * as ConfigSecret from "effect/ConfigSecret"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Pg from "./index.js"
import type { SqlError } from "@sqlfx/sql/Error"
import * as _ from "@sqlfx/sql/Migrator"
import { fromDisk } from "@sqlfx/sql/Migrator/Node"
import { execFile } from "node:child_process"
import * as NFS from "node:fs"
import * as Path from "node:path"

const { fromBabelGlob, fromGlob } = _

export {
  /**
   * @category loader
   * @since 1.0.0
   */
  fromBabelGlob,
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
  Pg.PgClient,
  SqlError | _.MigrationError,
  ReadonlyArray<readonly [id: number, name: string]>
> = _.make({
  getClient: Pg.tag,
  ensureTable(sql, table) {
    return Effect.catchAll(
      sql`select ${table}::regclass`,
      () =>
        sql`
        CREATE TABLE ${sql(table)} (
          migration_id integer primary key,
          created_at timestamp with time zone not null default now(),
          name text not null
        )
      `,
    )
  },
  lockTable(sql, table) {
    return sql`
      LOCK TABLE ${sql(table)} IN ACCESS EXCLUSIVE MODE
    `
  },
  dumpSchema(sql, path, table) {
    const pgDump = (args: Array<string>) =>
      Effect.map(
        Effect.async<never, _.MigrationError, string>(resume => {
          execFile(
            "pg_dump",
            [...args, "--no-owner", "--no-privileges"],
            {
              env: {
                PATH: process.env.PATH,
                PGHOST: sql.config.host,
                PGPORT: sql.config.port?.toString(),
                PGUSER: sql.config.username,
                PGPASSWORD: sql.config.password
                  ? ConfigSecret.value(sql.config.password)
                  : undefined,
                PGDATABASE: sql.config.database,
                PGSSLMODE: sql.config.ssl ? "require" : "prefer",
              },
            },
            (error, sql) => {
              if (error) {
                resume(
                  Effect.fail(
                    _.MigrationError({
                      reason: "failed",
                      message: "Failed to dump schema",
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
          _.replace(/^--.*$/gm, "")
            .replace(/^SET .*$/gm, "")
            .replace(/^SELECT pg_catalog\..*$/gm, "")
            .replace(/\n{2,}/gm, "\n\n")
            .trim(),
      )

    const pgDumpSchema = pgDump(["--schema-only"])

    const pgDumpMigrations = pgDump([
      "--column-inserts",
      "--data-only",
      `--table=${table}`,
    ])

    const pgDumpAll = Effect.map(
      Effect.all([pgDumpSchema, pgDumpMigrations], { concurrency: 2 }),
      ([schema, migrations]) => schema + "\n\n" + migrations,
    )

    const pgDumpFile = (path: string) =>
      Effect.flatMap(pgDumpAll, sql =>
        Effect.sync(() => {
          NFS.mkdirSync(Path.dirname(path), {
            recursive: true,
          })
          NFS.writeFileSync(path, sql)
        }),
      )

    return pgDumpFile(path)
  },
})

/**
 * @category constructor
 * @since 1.0.0
 */
export const makeLayer = (
  options: _.MigratorOptions,
): Layer.Layer<Pg.PgClient, _.MigrationError | SqlError, never> =>
  Layer.effectDiscard(run(options))
