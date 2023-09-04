import * as Effect from "@effect/io/Effect"
import * as _ from "@sqlfx/pg"
import { describe, expect, it } from "vitest"

const sql = Effect.runSync(Effect.scoped(_.make({})))
const compiler = _.makeCompiler()

describe("pg", () => {
  it("insert helper", () => {
    const [query, params] = compiler.compile(
      sql`INSERT INTO people ${sql({ name: "Tim", age: 10 })}`,
    )
    expect(query).toEqual(`INSERT INTO people ("name","age") VALUES ($1,$2)`)
    expect(params).toEqual(["Tim", 10])
  })

  it("update helper", () => {
    const [query, params] = compiler.compile(
      sql`UPDATE people SET name = data.name FROM ${sql(
        [{ name: "Tim" }, { name: "John" }],
        "data",
      )}`,
    )
    expect(query).toEqual(
      `UPDATE people SET name = data.name FROM (values ($1),($2)) AS data("name")`,
    )
    expect(params).toEqual(["Tim", "John"])
  })

  it("array helper", () => {
    const [query, params] = compiler.compile(
      sql`SELECT * FROM ${sql("people")} WHERE id IN ${sql([1, 2, "string"])}`,
    )
    expect(query).toEqual(`SELECT * FROM "people" WHERE id IN ($1,$2,$3)`)
    expect(params).toEqual([1, 2, "string"])
  })

  it("json", () => {
    const [query, params] = compiler.compile(sql`SELECT ${sql.json({ a: 1 })}`)
    expect(query).toEqual(`SELECT $1`)
    expect((params[0] as any).type).toEqual(3802)
  })

  it("array", () => {
    const [query, params] = compiler.compile(
      sql`SELECT ${sql.array([1, 2, 3])}`,
    )
    expect(query).toEqual(`SELECT ARRAY [$1,$2,$3]`)
    expect(params).toEqual([1, 2, 3])
  })
})
