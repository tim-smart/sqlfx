/**
 * @since 1.0.0
 */
import { identity } from "@effect/data/Function"
import * as Parameter from "@sqlfx/mssql/Parameter"
import type { Row } from "@sqlfx/sql/Connection"
import type * as Tedious from "tedious"

/**
 * @category type id
 * @since 1.0.0
 */
export const ProcedureId = Symbol.for("@sqlfx/mssql/Procedure")

/**
 * @category type id
 * @since 1.0.0
 */
export type ProcedureId = typeof ProcedureId

/**
 * @category model
 * @since 1.0.0
 */
export interface Procedure<
  I extends Record<string, Parameter.Parameter<any>>,
  O extends Record<string, Parameter.Parameter<any>>,
  A = never,
> {
  readonly [ProcedureId]: (_: never) => A
  readonly _tag: "Procedure"
  readonly name: string
  readonly params: I
  readonly outputParams: O
}

/**
 * @category model
 * @since 1.0.0
 */
export interface ProcedureWithValues<
  I extends Record<string, Parameter.Parameter<any>>,
  O extends Record<string, Parameter.Parameter<any>>,
  A,
> extends Procedure<I, O, A> {
  readonly values: Procedure.ParametersRecord<I>
}

/**
 * @since 1.0.0
 */
export namespace Procedure {
  /**
   * @since 1.0.0
   */
  export type ParametersRecord<
    A extends Record<string, Parameter.Parameter<any>>,
  > = {
    readonly [K in keyof A]: A[K] extends Parameter.Parameter<infer T>
      ? T
      : never
  } & {}

  /**
   * @category model
   * @since 1.0.0
   */
  export interface Result<
    O extends Record<string, Parameter.Parameter<any>>,
    A,
  > {
    readonly output: ParametersRecord<O>
    readonly rows: ReadonlyArray<A>
  }
}

type Simplify<A> = { [K in keyof A]: A[K] } & {}

/**
 * @category constructor
 * @since 1.0.0
 */
export const make = (name: string): Procedure<{}, {}> => ({
  [ProcedureId]: identity,
  _tag: "Procedure",
  name,
  params: {},
  outputParams: {},
})

/**
 * @category combinator
 * @since 1.0.0
 */
export const param =
  <A>() =>
  <N extends string, T extends Tedious.TediousType>(
    name: N,
    type: T,
    options?: Tedious.ParameterOptions,
  ) =>
  <
    I extends Record<string, Parameter.Parameter<any>>,
    O extends Record<string, Parameter.Parameter<any>>,
  >(
    self: Procedure<I, O>,
  ): Procedure<Simplify<I & { [K in N]: Parameter.Parameter<A> }>, O> => ({
    ...self,
    params: {
      ...self.params,
      [name]: Parameter.make(name, type, options),
    },
  })

/**
 * @category combinator
 * @since 1.0.0
 */
export const outputParam =
  <A>() =>
  <N extends string, T extends Tedious.TediousType>(
    name: N,
    type: T,
    options?: Tedious.ParameterOptions,
  ) =>
  <
    I extends Record<string, Parameter.Parameter<any>>,
    O extends Record<string, Parameter.Parameter<any>>,
  >(
    self: Procedure<I, O>,
  ): Procedure<I, Simplify<O & { [K in N]: Parameter.Parameter<A> }>> => ({
    ...self,
    outputParams: {
      ...self.outputParams,
      [name]: Parameter.make(name, type, options),
    },
  })

/**
 * @category combinator
 * @since 1.0.0
 */
export const withRows =
  <A extends object = Row>() =>
  <
    I extends Record<string, Parameter.Parameter<any>>,
    O extends Record<string, Parameter.Parameter<any>>,
  >(
    self: Procedure<I, O>,
  ): Procedure<I, O, A> =>
    self as any

/**
 * @category combinator
 * @since 1.0.0
 */
export const compile =
  <
    I extends Record<string, Parameter.Parameter<any>>,
    O extends Record<string, Parameter.Parameter<any>>,
    A,
  >(
    self: Procedure<I, O, A>,
  ) =>
  (input: Procedure.ParametersRecord<I>): ProcedureWithValues<I, O, A> => ({
    ...self,
    values: input,
  })
