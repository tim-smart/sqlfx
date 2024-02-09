/**
 * @since 1.0.0
 */
import * as Effect from "effect/Effect"
import * as Schema from "@effect/schema/Schema"
import { SchemaError } from "./Error.js"

/**
 * @since 1.0.0
 */
export const decodeUnknown = <R, I, A>(
  schema: Schema.Schema<A, I, R>,
  type: SchemaError["type"],
): ((input: unknown) => Effect.Effect<A, SchemaError, R>) => {
  const parse = Schema.decodeUnknown(schema)

  return input => Effect.mapError(parse(input), _ => SchemaError(type, _.error))
}

/**
 * @since 1.0.0
 */
export const encode = <R, I, A>(
  schema: Schema.Schema<A, I, R>,
  type: SchemaError["type"],
): ((input: A) => Effect.Effect<I, SchemaError, R>) => {
  const encode = Schema.encode(schema)

  return input =>
    Effect.mapError(encode(input), _ => SchemaError(type, _.error))
}
