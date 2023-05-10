import * as Effect from "@effect/io/Effect"
import * as Schema from "@effect/schema/Schema"
import { SchemaError } from "pgfx/Error"

export const validate = <I, A>(schema: Schema.Schema<I, A>) => {
  const validate = Schema.validateEffect(schema)
  return (input: A) =>
    Effect.mapError(validate(input), _ => SchemaError("validate", _.errors))
}

export const decode = <I, A>(schema: Schema.Schema<I, A>) => {
  const decode = Schema.decodeEffect(schema)

  return (input: I) =>
    Effect.mapError(decode(input), _ => SchemaError("decode", _.errors))
}
