/**
 * @since 1.0.0
 */
import { GenericTag } from "effect/Context"
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
  ) => Effect.Effect<ReadonlyArray<A>, SqlError>

  readonly executeStream: <A extends object = Row>(
    statement: Statement<A>,
  ) => Stream.Stream<A, SqlError>

  readonly executeWithoutTransform: <A extends object = Row>(
    statement: Statement<A>,
  ) => Effect.Effect<ReadonlyArray<A>, SqlError>

  readonly executeValues: <A extends object = Row>(
    statement: Statement<A>,
  ) => Effect.Effect<ReadonlyArray<ReadonlyArray<Primitive>>, SqlError>

  readonly executeRaw: <A extends object = Row>(
    sql: string,
    params?: ReadonlyArray<Primitive> | undefined,
  ) => Effect.Effect<ReadonlyArray<A>, SqlError>
}

/**
 * @since 1.0.0
 */
export namespace Connection {
  /**
   * @category model
   * @since 1.0.0
   */
  export type Acquirer = Effect.Effect<Connection, SqlError, Scope>
}

/**
 * @category tag
 * @since 1.0.0
 */
export const Connection = GenericTag<Connection>("@services/Connection")

/**
 * @category model
 * @since 1.0.0
 */
export type Row = { readonly [column: string]: Primitive }
