/**
 * @since 1.0.0
 */
import { Tag } from "effect/Context"
import type * as Effect from "effect/Effect"
import type { Scope } from "effect/Scope"
import type * as Stream from "effect/Stream"
import type { SqlError } from "./Error.js"
import type { Primitive, Statement } from "./Statement.js"

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
