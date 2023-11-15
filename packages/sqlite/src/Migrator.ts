/**
 * @since 1.0.0
 */
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import type { SqlError } from "@sqlfx/sql/Error"
import * as _ from "@sqlfx/sql/Migrator"
import type { SqliteClient } from "./node.js"
import * as internal from "./internal/client.js"

const { fromBabelGlob, fromGlob } = _

export {
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
  dumpSchema: (_sql, _path, _table) => Effect.dieMessage("Not implemented"),
})

/**
 * @category constructor
 * @since 1.0.0
 */
export const makeLayer = (
  options: _.MigratorOptions,
): Layer.Layer<SqliteClient, _.MigrationError | SqlError, never> =>
  Layer.effectDiscard(run(options))
