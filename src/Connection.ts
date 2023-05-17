/**
 * @since 1.0.0
 */
import { Tag } from "@effect/data/Context"
import type * as Effect from "@effect/io/Effect"
import type { SqlError } from "pgfx/Error"
import type { Primitive, Statement } from "pgfx/Statement"

/**
 * @category model
 * @since 1.0.0
 */
export interface Connection {
  readonly execute: (
    statement: Statement,
  ) => Effect.Effect<never, SqlError, ReadonlyArray<Row>>

  readonly executeRaw: (
    sql: string,
  ) => Effect.Effect<never, SqlError, ReadonlyArray<Row>>
}

/**
 * @category tag
 * @since 1.0.0
 */
export const Connection = Tag<Connection>()

/**
 * @category model
 * @since 1.0.0
 */
export type Row = Record<string, Primitive>
