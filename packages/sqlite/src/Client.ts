/**
 * @since 1.0.0
 */
import type { Tag } from "effect/Context"
import type * as Effect from "effect/Effect"
import type * as Client from "@sqlfx/sql/Client"
import type { SqlError } from "@sqlfx/sql/Error"
import type * as Statement from "@sqlfx/sql/Statement"
import * as transform from "@sqlfx/sql/Transform"
import * as internal from "./internal/client.js"

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
  readonly config: unknown
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
export const makeCompiler: (
  transform?: ((_: string) => string) | undefined,
) => Statement.Compiler = internal.makeCompiler
