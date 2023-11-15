/**
 * @since 1.0.0
 */
import * as Effect from "effect/Effect"
import * as Schema from "@effect/schema/Schema"
import { SchemaError } from "./Error.js"

/**
 * @since 1.0.0
 */
export const parse = <I, A>(
  schema: Schema.Schema<I, A>,
  type: SchemaError["type"],
): ((input: unknown) => Effect.Effect<never, SchemaError, A>) => {
  const parse = Schema.parse(schema)

  return input =>
    Effect.mapError(parse(input), _ => SchemaError(type, _.errors))
}

/**
 * @since 1.0.0
 */
export const encode = <I, A>(
  schema: Schema.Schema<I, A>,
  type: SchemaError["type"],
): ((input: A) => Effect.Effect<never, SchemaError, I>) => {
  const encode = Schema.encode(schema)

  return input =>
    Effect.mapError(encode(input), _ => SchemaError(type, _.errors))
}
