/**
 * @since 1.0.0
 */
import type { Effect } from "@effect/io/Effect"
import * as internal from "@sqlfx/sql/internal_effect_untraced/statement"
import type { Connection, Row } from "./Connection"
import type { SqlError } from "./Error"

/**
 * @category type id
 * @since 1.0.0
 */
export const FragmentId: unique symbol = internal.FragmentId

/**
 * @category type id
 * @since 1.0.0
 */
export type FragmentId = typeof FragmentId

/**
 * @category model
 * @since 1.0.0
 */
export interface Fragment {
  readonly [FragmentId]: (_: never) => FragmentId
  readonly segments: ReadonlyArray<Segment>
}

/**
 * @category model
 * @since 1.0.0
 */
export interface Statement
  extends Fragment,
    Effect<never, SqlError, ReadonlyArray<Row>> {}

/**
 * @category guard
 * @since 1.0.0
 */
export const isFragment: (u: unknown) => u is Fragment = internal.isFragment

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
export type Argument = Primitive | Helper | Fragment

/**
 * @category constructor
 * @since 1.0.0
 */
export const make: (acquirer: Connection.Acquirer) => {
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
  acquirer: Connection.Acquirer,
) => (sql: string, params?: ReadonlyArray<Primitive> | undefined) => Statement =
  internal.unsafe

/**
 * @category constructor
 * @since 1.0.0
 */
export const unsafeFragment: (
  sql: string,
  params?: ReadonlyArray<Primitive> | undefined,
) => Fragment = internal.unsafeFragment

/**
 * @category constructor
 * @since 1.0.0
 */
export const and: (clauses: ReadonlyArray<string | Fragment>) => Fragment =
  internal.and

/**
 * @category constructor
 * @since 1.0.0
 */
export const or: (clauses: ReadonlyArray<string | Fragment>) => Fragment =
  internal.or

/**
 * @category constructor
 * @since 1.0.0
 */
export const csv: {
  (values: ReadonlyArray<string | Fragment>): Fragment
  (prefix: string, values: ReadonlyArray<string | Fragment>): Fragment
} = internal.csv

/**
 * @category constructor
 * @since 1.0.0
 */
export const join: (
  literal: string,
  addParens?: boolean,
  fallback?: string,
) => (clauses: ReadonlyArray<string | Fragment>) => Fragment = internal.join

/**
 * @category model
 * @since 1.0.0
 */
export interface Compiler {
  readonly compile: (
    statement: Fragment,
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
