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
) => {
  const decode = Schema.decodeEffect(schema)

  return (input: I) =>
    Effect.mapError(decode(input), (_) => SchemaError(type, _.errors))
}

/**
 * @since 1.0.0
 */
export const encode = <I, A>(
  schema: Schema.Schema<I, A>,
  type: SchemaError["type"],
) => {
  const encode = Schema.encodeEffect(schema)

  return (input: A) =>
    Effect.mapError(encode(input), (_) => SchemaError(type, _.errors))
}
