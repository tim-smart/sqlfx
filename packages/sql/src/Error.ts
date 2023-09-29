/**
 * @since 1.0.0
 */
import * as Data from "effect/Data"
import type { NonEmptyReadonlyArray } from "effect/ReadonlyArray"
import type { ParseErrors } from "@effect/schema/ParseResult"

/**
 * @since 1.0.0
 */
export const SqlFxErrorId = Symbol.for("@sqlfx/sql/Error")
/**
 * @since 1.0.0
 */
export type SqlFxErrorId = typeof SqlFxErrorId

/**
 * @since 1.0.0
 */
export interface SqlError extends Data.Case {
  readonly [SqlFxErrorId]: SqlFxErrorId
  readonly _tag: "SqlError"
  readonly message: string
  readonly code?: string
  readonly error: unknown
}

/**
 * @category constructor
 * @since 1.0.0
 */
export const SqlError = (message: string, error: unknown) =>
  Data.tagged<SqlError>("SqlError")({
    [SqlFxErrorId]: SqlFxErrorId,
    message,
    code:
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      typeof error.code === "string"
        ? error["code"]
        : undefined,
    error,
  })

/**
 * @category model
 * @since 1.0.0
 */
export interface ResultLengthMismatch extends Data.Case {
  readonly [SqlFxErrorId]: SqlFxErrorId
  readonly _tag: "ResultLengthMismatch"
  readonly expected: number
  readonly actual: number
}
/**
 * @category constructor
 * @since 1.0.0
 */
export const ResultLengthMismatch = (expected: number, actual: number) =>
  Data.tagged<ResultLengthMismatch>("ResultLengthMismatch")({
    [SqlFxErrorId]: SqlFxErrorId,
    expected,
    actual,
  })

/**
 * @category model
 * @since 1.0.0
 */
export interface SchemaError extends Data.Case {
  readonly [SqlFxErrorId]: SqlFxErrorId
  readonly _tag: "SchemaError"
  readonly type: "request" | "result"
  readonly errors: NonEmptyReadonlyArray<ParseErrors>
}
/**
 * @category constructor
 * @since 1.0.0
 */
export const SchemaError = (
  type: SchemaError["type"],
  errors: NonEmptyReadonlyArray<ParseErrors>,
) =>
  Data.tagged<SchemaError>("SchemaError")({
    [SqlFxErrorId]: SqlFxErrorId,
    type,
    errors,
  })
