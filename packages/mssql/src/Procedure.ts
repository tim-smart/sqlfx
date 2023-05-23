/**
 * @since 1.0.0
 */
import * as Parameter from "@sqlfx/mssql/Parameter"
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
> {
  readonly [ProcedureId]: ProcedureId
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
> extends Procedure<I, O> {
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
}

type Simplify<A> = { [K in keyof A]: A[K] } & {}

/**
 * @category constructor
 * @since 1.0.0
 */
export const make = (name: string): Procedure<{}, {}> => ({
  [ProcedureId]: ProcedureId,
  _tag: "Procedure",
  name,
  params: {},
  outputParams: {},
})

/**
 * @category combinator
 * @since 1.0.0
 */
export const addParam =
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
export const addOutputParam =
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
export const compile =
  <
    I extends Record<string, Parameter.Parameter<any>>,
    O extends Record<string, Parameter.Parameter<any>>,
  >(
    self: Procedure<I, O>,
  ) =>
  (input: Procedure.ParametersRecord<I>): ProcedureWithValues<I, O> => ({
    ...self,
    values: input,
  })
