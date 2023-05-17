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

class Identifier implements _.Identifier {
  readonly _tag = "Identifier"
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

const isHelper = (u: unknown): u is _.Helper =>
  u instanceof ArrayHelper ||
  u instanceof ArrayOfRecordsHelper ||
  u instanceof RecordHelper ||
  u instanceof Identifier

const isPrimitive = (u: unknown): u is _.Primitive =>
  typeof u === "string" ||
  typeof u === "number" ||
  typeof u === "boolean" ||
  u instanceof Date ||
  u === null ||
  u === undefined

/** @internal */
export const make: {
  (value: Array<_.Primitive | Record<string, _.Primitive>>): _.ArrayHelper
  (value: Array<Record<string, _.Primitive>>): _.ArrayOfRecordsHelper
  (value: Record<string, _.Primitive>): _.RecordHelper
  (value: string): _.Identifier
  (strings: TemplateStringsArray, ...args: Array<_.Argument>): _.Statement
} = function sql(strings: unknown, ...args: Array<_.Argument>): any {
  if (Array.isArray(strings) && "raw" in strings) {
    return statement(strings as TemplateStringsArray, ...args)
  } else if (Array.isArray(strings)) {
    if (
      strings.length > 0 &&
      !isPrimitive(strings[0]) &&
      typeof strings[0] === "object"
    ) {
      return new ArrayOfRecordsHelper(strings)
    }
    return new ArrayHelper(strings)
  } else if (typeof strings === "string") {
    return new Identifier(strings)
  } else if (typeof strings === "object") {
    return new RecordHelper(strings as Record<string, _.Primitive>)
  }

  throw "absurd"
}

/** @internal */
export function statement(
  strings: TemplateStringsArray,
  ...args: Array<_.Argument>
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

/** @internal */
class Compiler implements _.Compiler {
  constructor(
    readonly parameterPlaceholder: string,
    readonly onIdentifier: (value: string) => string,
    readonly onRecord: (
      columns: ReadonlyArray<string>,
      identifiers: ReadonlyArray<string>,
      placeholder: string,
      values: ReadonlyArray<ReadonlyArray<_.Primitive>>,
    ) => readonly [sql: string, binds: ReadonlyArray<_.Primitive>],
    readonly onArray: (
      placeholder: string,
      values: ReadonlyArray<_.Primitive>,
    ) => readonly [sql: string, binds: ReadonlyArray<_.Primitive>],
  ) {}

  compile(
    statement: _.Statement,
  ): readonly [sql: string, binds: ReadonlyArray<_.Primitive>] {
    if ((statement as any).__compiled) {
      return (statement as any).__compiled
    }

    const segments = statement.segments
    const len = segments.length

    let sql = ""
    const binds: Array<_.Primitive> = []

    for (let i = 0; i < len; i++) {
      const segment = segments[i]

      switch (segment._tag) {
        case "Literal": {
          sql += segment.value
          break
        }

        case "Identifier": {
          sql += this.onIdentifier(segment.value)
          break
        }

        case "Parameter": {
          sql += this.parameterPlaceholder
          binds.push(segment.value)
          break
        }

        case "ArrayHelper": {
          const [s, b] = this.onArray(
            placeholders(this.parameterPlaceholder, segment.value.length),
            segment.value,
          )
          sql += s
          binds.push.apply(binds, b as any)
          break
        }

        case "RecordHelper": {
          const keys = Object.keys(segment.value)
          const [s, b] = this.onRecord(
            keys,
            keys.map(this.onIdentifier),
            placeholders(this.parameterPlaceholder, keys.length),
            [Object.values(segment.value)],
          )
          sql += s
          binds.push.apply(binds, b as any)
          break
        }

        case "ArrayOfRecordsHelper": {
          const keys = Object.keys(segment.value[0])
          const [s, b] = this.onRecord(
            keys,
            keys.map(this.onIdentifier),
            placeholders(this.parameterPlaceholder, keys.length),
            segment.value.map(record => keys.map(key => record?.[key])),
          )
          sql += s
          binds.push.apply(binds, b as any)
          break
        }
      }
    }

    return ((statement as any).__compiled = [sql, binds] as const)
  }
}

/** @internal */
export const makeCompiler = (
  parameterPlaceholder: string,
  onIdentifier: (value: string) => string,
  onRecord: (
    columns: ReadonlyArray<string>,
    identifiers: ReadonlyArray<string>,
    placeholder: string,
    values: ReadonlyArray<ReadonlyArray<_.Primitive>>,
  ) => readonly [sql: string, binds: ReadonlyArray<_.Primitive>],
  onArray: (
    placeholder: string,
    values: ReadonlyArray<_.Primitive>,
  ) => readonly [sql: string, binds: ReadonlyArray<_.Primitive>],
) => new Compiler(parameterPlaceholder, onIdentifier, onRecord, onArray)

const placeholders = (text: string, len: number) => {
  if (len === 0) {
    return ""
  } else if (len === 1) {
    return text
  }

  let result = text
  for (let i = 1; i < len; i++) {
    result += `,${text}`
  }

  return result
}

/** @internal */
export const defaultEscape = function escape(str: string) {
  return '"' + str.replace(/"/g, '""').replace(/\./g, '"."') + '"'
}

/** @internal */
export const defaultCompiler = makeCompiler(
  "?",
  defaultEscape,
  (_columns, ids, placeholder, values) => {
    return [
      `(${ids.join(",")})VALUES${values
        .map(() => `(${placeholder})`)
        .join(",")}`,
      values.flat(),
    ]
  },
  (placeholder, values) => [`(${placeholder})`, values],
)
