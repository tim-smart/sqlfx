import type { Effect } from "@effect/io/Effect"
import * as internal from "pgfx/internal_effect_untraced/statement"
import type { Connection, Row } from "./Connection"
import type { SqlError } from "./Error"

/**
 * @category type id
 * @since 1.0.0
 */
export const StatementId: unique symbol = internal.StatementId

/**
 * @category type id
 * @since 1.0.0
 */
export type StatementId = typeof StatementId

/**
 * @category model
 * @since 1.0.0
 */
export interface Statement
  extends Effect<Connection, SqlError, ReadonlyArray<Row>> {
  readonly [StatementId]: (_: never) => StatementId
  readonly segments: ReadonlyArray<Segment>
}

/**
 * @category guard
 * @since 1.0.0
 */
export const isStatement: (u: unknown) => u is Statement = internal.isStatement

/**
 * @category model
 * @since 1.0.0
 */
export type Segment =
  | Literal
  | Parameter
  | ArrayHelper
  | RecordHelper
  | ArrayOfRecordsHelper

/**
 * @category model
 * @since 1.0.0
 */
export interface Literal {
  readonly _tag: "Literal"
  readonly value: string
}

/**
 * @category model
 * @since 1.0.0
 */
export interface Parameter {
  readonly _tag: "Parameter"
  readonly value: Primitive
}

/**
 * @category model
 * @since 1.0.0
 */
export interface ArrayHelper {
  readonly _tag: "ArrayHelper"
  readonly value: ReadonlyArray<Primitive>
}

/**
 * @category model
 * @since 1.0.0
 */
export interface RecordHelper {
  readonly _tag: "RecordHelper"
  readonly value: Record<string, Primitive>
}

/**
 * @category model
 * @since 1.0.0
 */
export interface ArrayOfRecordsHelper {
  readonly _tag: "ArrayOfRecordsHelper"
  readonly value: ReadonlyArray<Record<string, Primitive>>
}

/**
 * @category model
 * @since 1.0.0
 */
export type Primitive = string | number | bigint | boolean | Date | null

/**
 * @category model
 * @since 1.0.0
 */
export type Argument = Primitive | ArrayHelper | RecordHelper

/**
 * @category constructor
 * @since 1.0.0
 */
export const sql: {
  (value: Array<Primitive>): ArrayHelper
  (value: Array<Record<string, Primitive>>): ArrayOfRecordsHelper
  (value: Record<string, Primitive>): RecordHelper
  (
    strings: TemplateStringsArray,
    ...args: Array<Statement | Argument>
  ): Statement
} = internal.sql

/**
 * @category constructor
 * @since 1.0.0
 */
export const unsafe: (sql: string) => Statement = internal.unsafe

console.log(sql`SELECT * FROM users WHERE id = ${1}`)
