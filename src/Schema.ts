import * as Effect from "@effect/io/Effect"
import * as Schema from "@effect/schema/Schema"
import { SchemaError } from "pgfx/Error"

export const decode = <I, A>(
  schema: Schema.Schema<I, A>,
  type: SchemaError["type"],
) => {
  const decode = Schema.decodeEffect(schema)

  return (input: I) =>
    Effect.mapError(decode(input), _ => SchemaError(type, _.errors))
}
