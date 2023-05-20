import * as Statement from "@sqlfx/sql/Statement"

const escape = Statement.defaultEscape('"')

/** @internal */
export const makeCompiler = (transform?: (_: string) => string) =>
  Statement.makeCompiler(
    _ => `?`,
    transform ? _ => escape(transform(_)) : escape,
    () => ["", []],
    () => ["", []],
  )
