import { Tag } from "effect/Context"
import * as Statement from "@sqlfx/sql/Statement"
import type { SqliteClient } from "../Client.js"

/** @internal */
export const tag = Tag<SqliteClient>()

const escape = Statement.defaultEscape('"')

/** @internal */
export const makeCompiler = (transform?: (_: string) => string) =>
  Statement.makeCompiler(
    _ => `?`,
    transform ? _ => escape(transform(_)) : escape,
    () => ["", []],
    () => ["", []],
  )
