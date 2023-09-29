import * as Effect from "effect/Effect"
import * as Sql from "@sqlfx/mysql"

export default Effect.flatMap(
  Sql.tag,
  sql =>
    sql`
      CREATE TABLE people (
        id INT NOT NULL AUTO_INCREMENT,
        name VARCHAR(255) NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id)
      )
    `,
)
