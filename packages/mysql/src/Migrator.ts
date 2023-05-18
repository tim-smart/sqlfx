/**
 * @since 1.0.0
 */
import * as Effect from "@effect/io/Effect"
import * as Layer from "@effect/io/Layer"
import * as Sql from "@sqlfx/mysql"
import type { SqlError } from "@sqlfx/sql/Error"
import * as _ from "@sqlfx/sql/Migrator"

/**
 * @category constructor
 * @since 1.0.0
 */
export const run: ({
  directory,
  schemaDirectory,
  table,
}: _.MigratorOptions) => Effect.Effect<
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
  lockTable(sql, table) {
    return sql`
      LOCK TABLES ${sql(table)} READ
    `
  },
  dumpSchema() {
    return Effect.unit()
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
