/**
 * @since 1.0.0
 */
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
  | Identifier
  | Parameter
  | ArrayHelper
  | RecordInsertHelper
  | RecordUpdateHelper

/**
 * @category model
 * @since 1.0.0
 */
export type RecordHelperKind = "insert" | "update"

/**
 * @category model
 * @since 1.0.0
 */
export interface Literal {
  readonly _tag: "Literal"
  readonly value: string
  readonly params?: ReadonlyArray<Primitive> | undefined
}

/**
 * @category model
 * @since 1.0.0
 */
export interface Identifier {
  readonly _tag: "Identifier"
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
export interface RecordInsertHelper {
  readonly _tag: "RecordInsertHelper"
  readonly value: ReadonlyArray<Record<string, Primitive>>
}

/**
 * @category model
 * @since 1.0.0
 */
export interface RecordUpdateHelper {
  readonly _tag: "RecordUpdateHelper"
  readonly value: ReadonlyArray<Record<string, Primitive>>
  readonly idColumn: string
  readonly alias: string
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
export type Helper =
  | ArrayHelper
  | RecordInsertHelper
  | RecordUpdateHelper
  | Identifier

/**
 * @category model
 * @since 1.0.0
 */
export type Argument = Primitive | Helper | Statement

/**
 * @category constructor
 * @since 1.0.0
 */
export const make: {
  (value: Array<Primitive | Record<string, Primitive>>): ArrayHelper
  (value: Array<Record<string, Primitive>>): RecordInsertHelper
  (
    value: Array<Record<string, Primitive>>,
    idColumn: string,
    identifier: string,
  ): RecordUpdateHelper
  (value: Record<string, Primitive>): RecordInsertHelper
  (
    value: Record<string, Primitive>,
    idColumn: string,
    identifier: string,
  ): RecordUpdateHelper
  (value: string): Identifier
  (strings: TemplateStringsArray, ...args: Array<Argument>): Statement
} = internal.make

/**
 * @category constructor
 * @since 1.0.0
 */
export const unsafe: (
  sql: string,
  params?: ReadonlyArray<Primitive> | undefined,
) => Statement = internal.unsafe

/**
 * @category constructor
 * @since 1.0.0
 */
export const and: (clauses: ReadonlyArray<string | Statement>) => Statement =
  internal.and

/**
 * @category constructor
 * @since 1.0.0
 */
export const or: (clauses: ReadonlyArray<string | Statement>) => Statement =
  internal.or

/**
 * @category constructor
 * @since 1.0.0
 */
export const csv: {
  (values: ReadonlyArray<string | Statement>): Statement
  (prefix: string, values: ReadonlyArray<string | Statement>): Statement
} = internal.csv

/**
 * @category constructor
 * @since 1.0.0
 */
export const join: (
  literal: string,
  addParens?: boolean,
  fallback?: string,
) => (clauses: ReadonlyArray<string | Statement>) => Statement = internal.join

/**
 * @category model
 * @since 1.0.0
 */
export interface Compiler {
  readonly compile: (
    statement: Statement,
  ) => readonly [sql: string, params: ReadonlyArray<Primitive>]
}

/**
 * @category compiler
 * @since 1.0.0
 */
export const makeCompiler: (
  parameterPlaceholder: string,
  onIdentifier: (value: string) => string,
  onArray: (
    placeholder: string,
    values: ReadonlyArray<Primitive>,
  ) => readonly [sql: string, binds: ReadonlyArray<Primitive>],
  onRecordInsert: (
    columns: ReadonlyArray<string>,
    placeholder: string,
    values: ReadonlyArray<ReadonlyArray<Primitive>>,
  ) => readonly [sql: string, binds: ReadonlyArray<Primitive>],
  onRecordUpdate: (
    columns: ReadonlyArray<readonly [table: string, value: string]>,
    placeholder: string,
    valueAlias: string,
    valueColumns: ReadonlyArray<string>,
    values: ReadonlyArray<ReadonlyArray<Primitive>>,
  ) => readonly [sql: string, binds: ReadonlyArray<Primitive>],
) => Compiler = internal.makeCompiler

/**
 * @since 1.0.0
 */
export const defaultEscape: (str: string) => string = internal.defaultEscape

/**
 * @since 1.0.0
 */
export const defaultCompiler: Compiler = internal.defaultCompiler
