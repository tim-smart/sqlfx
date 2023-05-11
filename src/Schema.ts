/**
 * @since 1.0.0
 */
import * as Effect from "@effect/io/Effect"
import * as Schema from "@effect/schema/Schema"
import { SchemaError } from "pgfx/Error"

/**
 * @since 1.0.0
 */
export const decode = <I, A>(
  schema: Schema.Schema<I, A>,
  type: SchemaError["type"],
): ((input: I) => Effect.Effect<never, SchemaError, A>) => {
  const decode = Schema.decodeEffect(schema)

  return input =>
    Effect.mapError(decode(input), _ => SchemaError(type, _.errors))
}

/**
 * @since 1.0.0
 */
export const encode = <I, A>(
  schema: Schema.Schema<I, A>,
  type: SchemaError["type"],
): ((input: A) => Effect.Effect<never, SchemaError, I>) => {
  const encode = Schema.encodeEffect(schema)

  return input =>
    Effect.mapError(encode(input), _ => SchemaError(type, _.errors))
}
