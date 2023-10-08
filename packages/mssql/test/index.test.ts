import * as Effect from "effect/Effect"
import * as _ from "@sqlfx/mssql"
import * as Statement from "@sqlfx/sql/Statement"
import { describe, expect, it } from "vitest"

const sql = Effect.runSync(Effect.scoped(_.make({})))
const compiler = _.makeCompiler()

describe("mssql", () => {
  it("insert helper", () => {
    const [query, params] = compiler.compile(
      sql`INSERT INTO ${sql("people")} ${sql.insert({ name: "Tim", age: 10 })}`,
    )
    expect(query).toEqual(
      `INSERT INTO [people] ([name],[age]) OUTPUT INSERTED.* VALUES (@a,@b)`,
    )
    expect(params).toEqual(["Tim", 10])
  })

  it("update helper", () => {
    const [query, params] = compiler.compile(
      sql`UPDATE people SET name = data.name FROM ${sql.updateValues(
        [{ name: "Tim" }, { name: "John" }],
        "data",
      )}`,
    )
    expect(query).toEqual(
      `UPDATE people SET name = data.name FROM (values (@a),(@b)) AS data([name])`,
    )
    expect(params).toEqual(["Tim", "John"])
  })

  it("array helper", () => {
    const [query, params] = compiler.compile(
      sql`SELECT * FROM ${sql("people")} WHERE id IN ${sql([1, 2, "string"])}`,
    )
    expect(query).toEqual(`SELECT * FROM [people] WHERE id IN (@a,@b,@c)`)
    expect(params).toEqual([1, 2, "string"])
  })

  it("param types", () => {
    const [query, params] = compiler.compile(
      sql`SELECT * FROM ${sql("people")} WHERE id = ${sql.param(
        _.TYPES.BigInt,
        1,
      )}`,
    )
    expect(query).toEqual(`SELECT * FROM [people] WHERE id = @a`)
    expect(Statement.isCustom("MssqlParam")(params[0])).toEqual(true)
    const param = params[0] as unknown as Statement.Custom<
      "MsSqlParam",
      any,
      any,
      any
    >
    expect(param.i0).toEqual(_.TYPES.BigInt)
    expect(param.i1).toEqual(1)
    expect(param.i2).toEqual({})
  })

  it("escape [", () => {
    const [query] = compiler.compile(
      sql`SELECT * FROM ${sql("peo[]ple.te[st]ing")}`,
    )
    expect(query).toEqual(`SELECT * FROM [peo[]]ple].[te[st]]ing]`)
  })
})
