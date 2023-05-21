declare module "@sqlite.org/sqlite-wasm" {
  export type OpenMode = "c" | "w" | "r" | "t"
  export type RowMode = "object" | "array" | "stmt"

  export class DB {
    constructor(dbName?: string, mode?: OpenMode)
    exec(options: {
      sql: string
      bind?: ReadonlyArray<unknown>
      rowMode?: RowMode
      resultRows?: Array<unknown>
    })
    close(): void
  }
  class OpfsDb extends DB {}

  interface OO1 {
    readonly DB: typeof DB
    readonly OpfsDb?: typeof OpfsDb
  }
  interface SqliteWasm {
    readonly oo1: OO1
  }

  const init: () => Promise<SqliteWasm>
  export default init
}
