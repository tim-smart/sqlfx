import * as Data from "@effect/data/Data"
import type { NonEmptyReadonlyArray } from "@effect/data/ReadonlyArray"
import type { ParseErrors } from "@effect/schema/ParseResult"
import postgres from "postgres"

export const PgFxErrorId = Symbol.for("pgfx/PgFxErrorId")
export type PgFxErrorId = typeof PgFxErrorId

export interface PostgresError extends Data.Case {
  readonly [PgFxErrorId]: PgFxErrorId
  readonly _tag: "PostgresError"
  readonly code: string
  readonly message: string

  readonly detail?: string | undefined
  readonly hint?: string | undefined
  readonly internal_position?: string | undefined
  readonly internal_query?: string | undefined
  readonly where?: string | undefined
  readonly schema_name?: string | undefined
  readonly table_name?: string | undefined
  readonly column_name?: string | undefined
  readonly data?: string | undefined
  readonly type_name?: string | undefined
  readonly constraint_name?: string | undefined
}
export const PostgresError = (error: postgres.Error) =>
  Data.tagged<PostgresError>("PostgresError")({
    [PgFxErrorId]: PgFxErrorId,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ...(error as any).__proto__,
    message: error.message,
  })

export interface ResultLengthMismatch extends Data.Case {
  readonly [PgFxErrorId]: PgFxErrorId
  readonly _tag: "ResultLengthMismatch"
  readonly expected: number
  readonly actual: number
}
export const ResultLengthMismatch = (expected: number, actual: number) =>
  Data.tagged<ResultLengthMismatch>("ResultLengthMismatch")({
    [PgFxErrorId]: PgFxErrorId,
    expected,
    actual,
  })

export interface SchemaError extends Data.Case {
  readonly [PgFxErrorId]: PgFxErrorId
  readonly _tag: "SchemaError"
  readonly type: "request" | "result"
  readonly errors: NonEmptyReadonlyArray<ParseErrors>
}
export const SchemaError = (
  type: SchemaError["type"],
  errors: NonEmptyReadonlyArray<ParseErrors>,
) =>
  Data.tagged<SchemaError>("SchemaError")({
    [PgFxErrorId]: PgFxErrorId,
    type,
    errors,
  })

export type RequestError = SchemaError | PostgresError
