/**
 * @since 1.0.0
 */
import type { Tag } from "effect/Context"
import type { DurationInput } from "effect/Duration"
import type * as Config from "effect/Config"
import type { ConfigError } from "effect/ConfigError"
import type * as ConfigSecret from "effect/ConfigSecret"
import type * as Effect from "effect/Effect"
import type * as Layer from "effect/Layer"
import type { Scope } from "effect/Scope"
import * as internal from "./internal/client.js"
import type { Parameter } from "./Parameter.js"
import type { Procedure, ProcedureWithValues } from "./Procedure.js"
import type * as Client from "@sqlfx/sql/Client"
import type { SqlError } from "@sqlfx/sql/Error"
import type * as Statement from "@sqlfx/sql/Statement"
import * as transform from "@sqlfx/sql/Transform"
import * as Tedious from "tedious"

const TYPES = Tedious.TYPES

export {
  /**
   * Column renaming helpers.
   *
   * @since 1.0.0
   */
  transform,
  /**
   * Parameter types
   *
   * @since 1.0.0
   */
  TYPES,
}

/**
 * @category model
 * @since 1.0.0
 */
export interface MssqlClient extends Client.Client {
  readonly config: MssqlClientConfig

  readonly param: (
    type: Tedious.TediousType,
    value: Statement.Primitive,
    options?: Tedious.ParameterOptions,
  ) => Statement.Fragment

  readonly call: <
    I extends Record<string, Parameter<any>>,
    O extends Record<string, Parameter<any>>,
    A extends object,
  >(
    procedure: ProcedureWithValues<I, O, A>,
  ) => Effect.Effect<never, SqlError, Procedure.Result<O, A>>
}

/**
 * @category tag
 * @since 1.0.0
 */
export const tag: Tag<MssqlClient, MssqlClient> = internal.tag

/**
 * @category constructor
 * @since 1.0.0
 */
export interface MssqlClientConfig {
  readonly domain?: string
  readonly server?: string
  readonly trustServer?: boolean
  readonly port?: number
  readonly authType?: string
  readonly database?: string
  readonly username?: string
  readonly password?: ConfigSecret.ConfigSecret
  readonly connectTimeout?: DurationInput

  readonly minConnections?: number
  readonly maxConnections?: number
  readonly connectionTTL?: DurationInput

  readonly parameterTypes?: Record<Statement.PrimitiveKind, Tedious.TediousType>

  readonly transformResultNames?: (str: string) => string
  readonly transformQueryNames?: (str: string) => string
}

/**
 * @category constructor
 * @since 1.0.0
 */
export const make: (
  options: MssqlClientConfig,
) => Effect.Effect<Scope, never, MssqlClient> = internal.make

/**
 * @category constructor
 * @since 1.0.0
 */
export const makeLayer: (
  config: Config.Config.Wrap<MssqlClientConfig>,
) => Layer.Layer<never, ConfigError, MssqlClient> = internal.makeLayer

/**
 * @category constructor
 * @since 1.0.0
 */
export const makeCompiler: (
  transform?: ((_: string) => string) | undefined,
) => Statement.Compiler = internal.makeCompiler

/**
 * @since 1.0.0
 */
export const defaultParameterTypes: Record<
  Statement.PrimitiveKind,
  Tedious.TediousType
> = internal.defaultParameterTypes
