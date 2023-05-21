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
export interface Statement<A>
  extends Fragment,
    Effect<never, SqlError, ReadonlyArray<A>> {
  readonly withoutTransform: Effect<never, SqlError, ReadonlyArray<A>>
  readonly values: Effect<
    never,
    SqlError,
    ReadonlyArray<ReadonlyArray<Primitive>>
  >
  readonly compile: Effect<
    never,
    SqlError,
    readonly [sql: string, params: ReadonlyArray<Primitive>]
  >
}

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
  | Custom

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
  readonly alias: string
}

/**
 * @category model
 * @since 1.0.0
 */
export interface Custom<T extends string = string, A = void, B = void> {
  readonly _tag: "Custom"
  readonly kind: T
  readonly i0: A
  readonly i1: B
}

/**
 * @category constructor
 * @since 1.0.0
 */
export const custom: <C extends Custom<any, any, any>>(
  kind: C["kind"],
) => (i0: C["i0"], i1: C["i1"]) => Fragment = internal.custom

/**
 * @category model
 * @since 1.0.0
 */
export type Primitive =
  | string
  | number
  | bigint
  | boolean
  | Date
  | null
  | Int8Array
  | Uint8Array

/**
 * @category model
 * @since 1.0.0
 */
export type Helper =
  | ArrayHelper
  | RecordInsertHelper
  | RecordUpdateHelper
  | Identifier
  | Custom

/**
 * @category model
 * @since 1.0.0
 */
export type Argument = Primitive | Helper | Fragment

/**
 * @category model
 * @since 1.0.0
 */
export interface Constructor {
  <A extends object = Row>(
    strings: TemplateStringsArray,
    ...args: Array<Argument>
  ): Statement<A>

  (value: string): Identifier

  (value: ReadonlyArray<Primitive | Record<string, Primitive>>): ArrayHelper
  (value: ReadonlyArray<Record<string, Primitive>>): RecordInsertHelper
  (
    value: ReadonlyArray<Record<string, Primitive>>,
    alias: string,
  ): RecordUpdateHelper
  (value: Record<string, Primitive>): RecordInsertHelper
  (value: Record<string, Primitive>, alias: string): RecordUpdateHelper
}

/**
 * @category constructor
 * @since 1.0.0
 */
export const make: (acquirer: Connection.Acquirer) => Constructor =
  internal.make

/**
 * @category constructor
 * @since 1.0.0
 */
export const unsafe: (
  acquirer: Connection.Acquirer,
) => <A extends object = Row>(
  sql: string,
  params?: ReadonlyArray<Primitive> | undefined,
) => Statement<A> = internal.unsafe

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
export const makeCompiler: <C extends Custom<any, any, any> = any>(
  parameterPlaceholder: (index: number) => string,
  onIdentifier: (value: string) => string,
  onRecordUpdate: (
    placeholders: string,
    alias: string,
    columns: string,
    values: ReadonlyArray<ReadonlyArray<Primitive>>,
  ) => readonly [sql: string, params: ReadonlyArray<Primitive>],
  onCustom: (
    type: C,
    placeholder: () => string,
  ) => readonly [sql: string, params: ReadonlyArray<Primitive>],
) => Compiler = internal.makeCompiler

/**
 * @since 1.0.0
 */
export const defaultEscape: (c: string) => (str: string) => string =
  internal.defaultEscape
