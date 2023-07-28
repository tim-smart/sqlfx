/**
 * @since 1.0.0
 */
import { Tag } from "@effect/data/Context"
import type * as Effect from "@effect/io/Effect"
import type { Scope } from "@effect/io/Scope"
import type * as Stream from "@effect/stream/Stream"
import type { SqlError } from "@sqlfx/sql/Error"
import type { Primitive, Statement } from "@sqlfx/sql/Statement"

/**
 * @category model
 * @since 1.0.0
 */
export interface Connection {
  readonly execute: <A extends object = Row>(
    statement: Statement<A>,
  ) => Effect.Effect<never, SqlError, ReadonlyArray<A>>

  readonly executeStream: <A extends object = Row>(
    statement: Statement<A>,
  ) => Stream.Stream<never, SqlError, A>

  readonly executeWithoutTransform: <A extends object = Row>(
    statement: Statement<A>,
  ) => Effect.Effect<never, SqlError, ReadonlyArray<A>>

  readonly executeValues: <A extends object = Row>(
    statement: Statement<A>,
  ) => Effect.Effect<never, SqlError, ReadonlyArray<ReadonlyArray<Primitive>>>

  readonly executeRaw: <A extends object = Row>(
    sql: string,
    params?: ReadonlyArray<Primitive> | undefined,
  ) => Effect.Effect<never, SqlError, ReadonlyArray<A>>

  readonly compile: <A>(
    statement: Statement<A>,
  ) => Effect.Effect<
    never,
    SqlError,
    readonly [sql: string, params: ReadonlyArray<Primitive>]
  >
}

/**
 * @since 1.0.0
 */
export namespace Connection {
  /**
   * @category model
   * @since 1.0.0
   */
  export type Acquirer = Effect.Effect<Scope, SqlError, Connection>
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
export type Row = { readonly [column: string]: Primitive }
