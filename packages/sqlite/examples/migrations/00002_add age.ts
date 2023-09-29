import * as Effect from "effect/Effect"
import * as Sql from "@sqlfx/sqlite/Client"

export default Effect.flatMap(
  Sql.tag,
  sql => sql`ALTER TABLE people ADD COLUMN age INTEGER`,
)
