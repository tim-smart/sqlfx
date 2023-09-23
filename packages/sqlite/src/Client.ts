/**
 * @since 1.0.0
 */
import type { Tag } from "@effect/data/Context"
import type * as Effect from "@effect/io/Effect"
import type * as Client from "@sqlfx/sql/Client"
import type { SqlError } from "@sqlfx/sql/Error"
import * as transform from "@sqlfx/sql/Transform"
import * as internal from "@sqlfx/sqlite/internal/client"

export {
  /**
   * Column renaming helpers.
   *
   * @since 1.0.0
   */
  transform,
}

/**
 * @category model
 * @since 1.0.0
 */
export interface SqliteClient extends Client.Client {
  readonly config: SqliteClientConfig
  readonly export: Effect.Effect<never, SqlError, Uint8Array>
}

/**
 * @category tag
 * @since 1.0.0
 */
export const tag: Tag<SqliteClient, SqliteClient> = internal.tag

/**
 * @category constructor
 * @since 1.0.0
 */
export interface SqliteClientConfig {
  readonly filename: string
  readonly readonly?: boolean
  readonly prepareCacheSize?: number
  readonly transformResultNames?: (str: string) => string
  readonly transformQueryNames?: (str: string) => string
}
