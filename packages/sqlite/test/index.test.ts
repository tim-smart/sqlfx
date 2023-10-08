import * as Effect from "effect/Effect"
import * as _ from "@sqlfx/sqlite/node"
import { describe, expect, it } from "vitest"

const sql = Effect.runSync(Effect.scoped(_.make({ filename: "" })))
const compiler = _.makeCompiler()

describe("sqlite", () => {
  it("insert helper", () => {
    const [query, params] = compiler.compile(
      sql`INSERT INTO people ${sql.insert({ name: "Tim", age: 10 })}`,
    )
    expect(query).toEqual(`INSERT INTO people ("name","age") VALUES (?,?)`)
    expect(params).toEqual(["Tim", 10])
  })

  it("update helper", () => {
    const [query, params] = compiler.compile(
      sql`UPDATE people SET ${sql.update({ id: 1, name: "Tim", age: 30 }, [
        "id",
      ])}`,
    )
    expect(query).toEqual(`UPDATE people SET "name" = ?, "age" = ?`)
    expect(params).toEqual(["Tim", 30])
  })

  it("array helper", () => {
    const [query, params] = compiler.compile(
      sql`SELECT * FROM ${sql("people")} WHERE id IN ${sql([1, 2, "string"])}`,
    )
    expect(query).toEqual(`SELECT * FROM "people" WHERE id IN (?,?,?)`)
    expect(params).toEqual([1, 2, "string"])
  })
})
