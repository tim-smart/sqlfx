import * as Debug from "@effect/data/Debug"
import * as Equal from "@effect/data/Equal"
import { identity } from "@effect/data/Function"
import * as Hash from "@effect/data/Hash"
import * as Effect from "@effect/io/Effect"
import { Connection } from "pgfx/Connection"
import type { Row } from "pgfx/Connection"
import type { SqlError } from "pgfx/Error"
import type * as _ from "pgfx/Statement"

/** @internal */
export const StatementId: _.StatementId = Symbol.for(
  "pgfx/Statement",
) as _.StatementId

/** @internal */
export function isStatement(u: unknown): u is _.Statement {
  return typeof u === "object" && u !== null && StatementId in u
}

/** @internal */
export class StatementPrimitive implements _.Statement {
  constructor(readonly i0: ReadonlyArray<_.Segment>) {}
  get segments(): ReadonlyArray<_.Segment> {
    return this.i0
  }

  // Make it a valid effect
  public _tag = "Commit" // OP_COMMIT
  public i1: any = undefined
  public i2: any = undefined
  public trace: Debug.Trace = undefined;
  [StatementId] = identity;
  [Effect.EffectTypeId] = undefined as any

  commit(): Effect.Effect<Connection, SqlError, ReadonlyArray<Row>> {
    return Debug.untraced(() =>
      Effect.flatMap(Connection, _ => _.execute(this)),
    )
  }

  [Equal.symbol](this: StatementPrimitive, that: StatementPrimitive): boolean {
    return this === that
  }
  [Hash.symbol](this: StatementPrimitive): number {
    return Hash.random(this)
  }

  traced(
    trace: Debug.Trace,
  ): Effect.Effect<Connection, SqlError, ReadonlyArray<Row>> {
    if (trace) {
      return new StatementTraced(this, trace)
    }
    return this
  }
}

class StatementTraced
  implements Effect.Effect<Connection, SqlError, ReadonlyArray<Row>>
{
  constructor(
    readonly i0: StatementPrimitive | StatementTraced,
    readonly trace: Debug.Trace,
  ) {}

  // Make it a valid effect
  public _tag = "Traced" // OP_TRACED
  public i1: any = undefined
  public i2: any = undefined;
  [Effect.EffectTypeId] = undefined as any;

  [Equal.symbol](this: StatementPrimitive, that: StatementPrimitive): boolean {
    return this === that
  }
  [Hash.symbol](this: StatementPrimitive): number {
    return Hash.random(this)
  }

  traced(
    trace: Debug.Trace,
  ): Effect.Effect<Connection, SqlError, ReadonlyArray<Row>> {
    if (trace) {
      return new StatementTraced(this, trace)
    }
    return this
  }
}

class Literal implements _.Literal {
  readonly _tag = "Literal"
  constructor(readonly value: string) {}
}

class Parameter implements _.Parameter {
  readonly _tag = "Parameter"
  constructor(readonly value: _.Primitive) {}
}

class ArrayHelper implements _.ArrayHelper {
  readonly _tag = "ArrayHelper"
  constructor(readonly value: Array<_.Primitive>) {}
}

class RecordHelper implements _.RecordHelper {
  readonly _tag = "RecordHelper"
  constructor(readonly value: Record<string, _.Primitive>) {}
}

class ArrayOfRecordsHelper implements _.ArrayOfRecordsHelper {
  readonly _tag = "ArrayOfRecordsHelper"
  constructor(readonly value: ReadonlyArray<Record<string, _.Primitive>>) {}
}

const isHelper = (
  u: unknown,
): u is _.ArrayHelper | _.ArrayOfRecordsHelper | _.RecordHelper =>
  u instanceof ArrayHelper ||
  u instanceof ArrayOfRecordsHelper ||
  u instanceof RecordHelper

const isPrimitive = (u: unknown): u is _.Primitive =>
  typeof u === "string" ||
  typeof u === "number" ||
  typeof u === "boolean" ||
  u instanceof Date ||
  u === null ||
  u === undefined

/** @internal */
export const sql: {
  (value: Array<_.Primitive | Record<string, _.Primitive>>): _.ArrayHelper
  (value: Array<Record<string, _.Primitive>>): _.ArrayOfRecordsHelper
  (value: Record<string, _.Primitive>): _.RecordHelper
  (
    strings: TemplateStringsArray,
    ...args: Array<_.Statement | _.Argument>
  ): _.Statement
} = function sql(
  strings: unknown,
  ...args: Array<_.Statement | _.Argument>
): any {
  if (Array.isArray(strings) && "raw" in strings) {
    return statement(strings as TemplateStringsArray, ...args)
  } else if (Array.isArray(strings)) {
    if (isPrimitive(strings[0])) {
      return new ArrayHelper(args as Array<_.Primitive>)
    }
    return new ArrayOfRecordsHelper(strings)
  } else if (typeof strings === "object") {
    return new RecordHelper(strings as Record<string, _.Primitive>)
  }

  throw "absurd"
}

/** @internal */
export function statement(
  strings: TemplateStringsArray,
  ...args: Array<_.Statement | _.Argument>
): _.Statement {
  const segments: Array<_.Segment> =
    strings[0].length > 0 ? [new Literal(strings[0])] : []

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]

    if (isStatement(arg)) {
      segments.push(...arg.segments)
    } else if (isHelper(arg)) {
      segments.push(arg)
    } else {
      segments.push(new Parameter(arg))
    }

    if (strings[i + 1].length > 0) {
      segments.push(new Literal(strings[i + 1]))
    }
  }

  return new StatementPrimitive(segments)
}

/** @internal */
export function unsafe(sql: string): _.Statement {
  return new StatementPrimitive([new Literal(sql)])
}
