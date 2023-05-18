import * as Debug from "@effect/data/Debug"
import * as Equal from "@effect/data/Equal"
import { identity } from "@effect/data/Function"
import * as Hash from "@effect/data/Hash"
import * as Effect from "@effect/io/Effect"
import type { Connection, Row } from "@sqlfx/sql/Connection"
import type { SqlError } from "@sqlfx/sql/Error"
import type * as _ from "@sqlfx/sql/Statement"

/** @internal */
export const FragmentId: _.FragmentId = Symbol.for(
  "pgfx/Fragment",
) as _.FragmentId

/** @internal */
export function isFragment(u: unknown): u is _.Fragment {
  return typeof u === "object" && u !== null && FragmentId in u
}

/** @internal */
export class StatementPrimitive<A> implements _.Statement<A> {
  get [FragmentId]() {
    return identity
  }

  constructor(
    readonly i0: ReadonlyArray<_.Segment>,
    readonly i1: Connection.Acquirer,
  ) {}

  get segments(): ReadonlyArray<_.Segment> {
    return this.i0
  }

  get values(): Effect.Effect<
    never,
    SqlError,
    ReadonlyArray<ReadonlyArray<_.Primitive>>
  > {
    return Debug.untraced(() =>
      Effect.scoped(Effect.flatMap(this.i1, _ => _.executeValues(this as any))),
    )
  }

  // Make it a valid effect
  public _tag = "Commit" // OP_COMMIT
  public i2: any = undefined
  public trace: Debug.Trace = undefined;
  [Effect.EffectTypeId] = undefined as any

  commit(): Effect.Effect<never, SqlError, ReadonlyArray<A>> {
    return Debug.untraced(() =>
      Effect.scoped(
        Effect.flatMap(this.i1, _ => _.execute(this as any) as any),
      ),
    )
  }

  [Equal.symbol](
    this: StatementPrimitive<Row>,
    that: StatementPrimitive<Row>,
  ): boolean {
    return this === that
  }
  [Hash.symbol](this: StatementPrimitive<Row>): number {
    return Hash.random(this)
  }

  traced(trace: Debug.Trace): _.Statement<A> {
    if (trace) {
      return new StatementTraced(this, this, trace)
    }
    return this
  }
}

class StatementTraced<A> implements _.Statement<A> {
  get [FragmentId]() {
    return identity
  }

  constructor(
    readonly i0: StatementPrimitive<A> | StatementTraced<A>,
    readonly i1: StatementPrimitive<A>,
    readonly trace: Debug.Trace,
  ) {}

  get segments(): ReadonlyArray<_.Segment> {
    return this.i1.segments
  }

  get values() {
    return this.i1.values
  }

  // Make it a valid effect
  public _tag = "Traced" // OP_TRACED
  public i2: any = undefined;
  [Effect.EffectTypeId] = undefined as any;

  [Equal.symbol](
    this: StatementPrimitive<Row>,
    that: StatementPrimitive<Row>,
  ): boolean {
    return this === that
  }
  [Hash.symbol](this: StatementPrimitive<Row>): number {
    return Hash.random(this)
  }

  traced(trace: Debug.Trace): _.Statement<A> {
    if (trace) {
      return new StatementTraced(this, this.i1, trace)
    }
    return this
  }
}

class Fragment implements _.Fragment {
  get [FragmentId]() {
    return identity
  }
  constructor(readonly segments: ReadonlyArray<_.Segment>) {}
}

class Literal implements _.Literal {
  readonly _tag = "Literal"
  constructor(
    readonly value: string,
    readonly params?: ReadonlyArray<_.Primitive>,
  ) {}
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

class RecordInsertHelper implements _.RecordInsertHelper {
  readonly _tag = "RecordInsertHelper"
  constructor(readonly value: ReadonlyArray<Record<string, _.Primitive>>) {}
}

class RecordUpdateHelper implements _.RecordUpdateHelper {
  readonly _tag = "RecordUpdateHelper"
  constructor(
    readonly value: ReadonlyArray<Record<string, _.Primitive>>,
    readonly idColumn: string,
    readonly alias: string,
  ) {}
}

const isHelper = (u: unknown): u is _.Helper =>
  u instanceof ArrayHelper ||
  u instanceof RecordInsertHelper ||
  u instanceof RecordUpdateHelper ||
  u instanceof Identifier

const isPrimitive = (u: unknown): u is _.Primitive =>
  typeof u === "string" ||
  typeof u === "number" ||
  typeof u === "boolean" ||
  u instanceof Date ||
  u === null ||
  u === undefined

/** @internal */
export const make = (acquirer: Connection.Acquirer): _.Constructor =>
  function sql(strings: unknown, ...args: Array<any>): any {
    if (Array.isArray(strings) && "raw" in strings) {
      return statement(acquirer, strings as TemplateStringsArray, ...args)
    } else if (Array.isArray(strings)) {
      if (
        strings.length > 0 &&
        !isPrimitive(strings[0]) &&
        typeof strings[0] === "object"
      ) {
        if (typeof args[0] === "string") {
          return new RecordUpdateHelper(strings, args[0], args[1])
        }

        return new RecordInsertHelper(strings)
      }
      return new ArrayHelper(strings)
    } else if (typeof strings === "string") {
      return new Identifier(strings)
    } else if (typeof strings === "object") {
      if (typeof args[0] === "string") {
        return new RecordUpdateHelper([strings as any], args[0], args[1])
      }
      return new RecordInsertHelper([strings as any])
    }

    throw "absurd"
  }

/** @internal */
export const statement = Debug.methodWithTrace(
  trace =>
    function statement(
      acquirer: Connection.Acquirer,
      strings: TemplateStringsArray,
      ...args: Array<_.Argument>
    ): _.Statement<Row> {
      const segments: Array<_.Segment> =
        strings[0].length > 0 ? [new Literal(strings[0])] : []

      for (let i = 0; i < args.length; i++) {
        const arg = args[i]

        if (isFragment(arg)) {
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

      return new StatementPrimitive<Row>(segments, acquirer).traced(trace)
    },
)

/** @internal */
export const unsafe =
  (acquirer: Connection.Acquirer) =>
  <A extends object = Row>(
    sql: string,
    params?: ReadonlyArray<_.Primitive>,
  ): _.Statement<A> =>
    new StatementPrimitive([new Literal(sql, params)], acquirer)

/** @internal */
export const unsafeFragment = (
  sql: string,
  params?: ReadonlyArray<_.Primitive>,
): _.Fragment => new Fragment([new Literal(sql, params)])

function convertLiteralOrFragment(
  clause: string | _.Fragment,
): Array<_.Segment> {
  if (typeof clause === "string") {
    return [new Literal(clause)]
  }
  return clause.segments as Array<_.Segment>
}

/** @internal */
export function join(literal: string, addParens = true, fallback = "") {
  const literalSegment = new Literal(literal)

  return function (clauses: ReadonlyArray<string | _.Fragment>): _.Fragment {
    if (clauses.length === 0) {
      return unsafeFragment(fallback)
    } else if (clauses.length === 1) {
      return new Fragment(convertLiteralOrFragment(clauses[0]))
    }

    const segments: Array<_.Segment> = []

    if (addParens) {
      segments.push(new Literal("("))
    }

    segments.push.apply(segments, convertLiteralOrFragment(clauses[0]))

    for (let i = 1; i < clauses.length; i++) {
      segments.push(literalSegment)
      segments.push.apply(segments, convertLiteralOrFragment(clauses[i]))
    }

    if (addParens) {
      segments.push(new Literal(")"))
    }

    return new Fragment(segments)
  }
}

/** @internal */
export const and = join(" AND ", true, "1=1")

/** @internal */
export const or = join(" OR ", true, "1=1")

const csvRaw = join(", ", false)

/** @internal */
export const csv: {
  (values: ReadonlyArray<string | _.Fragment>): _.Fragment
  (prefix: string, values: ReadonlyArray<string | _.Fragment>): _.Fragment
} = (
  ...args:
    | [values: ReadonlyArray<string | _.Fragment>]
    | [prefix: string, values: ReadonlyArray<string | _.Fragment>]
) => {
  if (args[args.length - 1].length === 0) {
    return unsafeFragment("")
  }

  if (args.length === 1) {
    return csvRaw(args[0])
  }

  return new Fragment([new Literal(`${args[0]} `), ...csvRaw(args[1]).segments])
}

/** @internal */
class Compiler implements _.Compiler {
  constructor(
    readonly parameterPlaceholder: (index: number) => string,
    readonly onIdentifier: (value: string) => string,
    readonly onArray: (
      placeholders: ReadonlyArray<string>,
      values: ReadonlyArray<_.Primitive>,
    ) => readonly [sql: string, binds: ReadonlyArray<_.Primitive>],
    readonly onRecordInsert: (
      columns: ReadonlyArray<string>,
      placeholders: ReadonlyArray<string>,
      values: ReadonlyArray<ReadonlyArray<_.Primitive>>,
    ) => readonly [sql: string, binds: ReadonlyArray<_.Primitive>],
    readonly onRecordUpdate: (
      columns: ReadonlyArray<readonly [table: string, value: string]>,
      placeholders: ReadonlyArray<string>,
      alias: string,
      valueColumns: ReadonlyArray<string>,
      values: ReadonlyArray<ReadonlyArray<_.Primitive>>,
    ) => readonly [sql: string, binds: ReadonlyArray<_.Primitive>],
    readonly onCustom: (
      kind: string,
      i0: unknown,
      i1: unknown,
    ) => readonly [sql: string, binds: ReadonlyArray<_.Primitive>],
  ) {}

  compile(
    statement: _.Fragment,
  ): readonly [sql: string, binds: ReadonlyArray<_.Primitive>] {
    if ((statement as any).__compiled) {
      return (statement as any).__compiled
    }

    const segments = statement.segments
    const len = segments.length

    let sql = ""
    const binds: Array<_.Primitive> = []
    let placeholderCount = 0
    const placeholder = () => this.parameterPlaceholder(++placeholderCount)

    for (let i = 0; i < len; i++) {
      const segment = segments[i]

      switch (segment._tag) {
        case "Literal": {
          sql += segment.value
          if (segment.params) {
            binds.push.apply(binds, segment.params as any)
          }
          break
        }

        case "Identifier": {
          sql += this.onIdentifier(segment.value)
          break
        }

        case "Parameter": {
          sql += placeholder()
          binds.push(segment.value)
          break
        }

        case "ArrayHelper": {
          const [s, b] = this.onArray(
            placeholders(placeholder, segment.value.length),
            segment.value,
          )
          sql += s
          binds.push.apply(binds, b as any)
          break
        }

        case "RecordInsertHelper": {
          const keys = Object.keys(segment.value[0])
          const [s, b] = this.onRecordInsert(
            keys.map(this.onIdentifier),
            placeholders(
              generatePlaceholder(placeholder, keys.length),
              segment.value.length,
            ),
            segment.value.map(record => keys.map(key => record?.[key])),
          )
          sql += s
          binds.push.apply(binds, b as any)
          break
        }

        case "RecordUpdateHelper": {
          const keys = Object.keys(segment.value[0])
          const keysWithoutId = keys.filter(_ => _ !== segment.idColumn)
          const [s, b] = this.onRecordUpdate(
            keysWithoutId.map(_ => [
              this.onIdentifier(_),
              this.onIdentifier(`${segment.alias}.${_}`),
            ]),
            placeholders(
              generatePlaceholder(placeholder, keys.length),
              segment.value.length,
            ),
            segment.alias,
            keys.map(this.onIdentifier),
            segment.value.map(record => keys.map(key => record?.[key])),
          )
          sql += s
          binds.push.apply(binds, b as any)
          break
        }

        case "Custom": {
          const [s, b] = this.onCustom(segment.kind, segment.i0, segment.i1)
          sql += s
          binds.push.apply(binds, b as any)
          break
        }
      }
    }

    return ((statement as any).__compiled = [sql.trim(), binds] as const)
  }
}

/** @internal */
export const makeCompiler = (
  parameterPlaceholder: (index: number) => string,
  onIdentifier: (value: string) => string,
  onArray: (
    placeholders: ReadonlyArray<string>,
    values: ReadonlyArray<_.Primitive>,
  ) => readonly [sql: string, params: ReadonlyArray<_.Primitive>],
  onRecordInsert: (
    columns: ReadonlyArray<string>,
    placeholders: ReadonlyArray<string>,
    values: ReadonlyArray<ReadonlyArray<_.Primitive>>,
  ) => readonly [sql: string, params: ReadonlyArray<_.Primitive>],
  onRecordUpdate: (
    columns: ReadonlyArray<readonly [table: string, value: string]>,
    placeholders: ReadonlyArray<string>,
    valueAlias: string,
    valueColumns: ReadonlyArray<string>,
    values: ReadonlyArray<ReadonlyArray<_.Primitive>>,
  ) => readonly [sql: string, params: ReadonlyArray<_.Primitive>],
  onCustom: (
    kind: string,
    i0: unknown,
    i1: unknown,
  ) => readonly [sql: string, params: ReadonlyArray<_.Primitive>],
) =>
  new Compiler(
    parameterPlaceholder,
    onIdentifier,
    onArray,
    onRecordInsert,
    onRecordUpdate,
    onCustom,
  )

const placeholders = (
  evaluate: () => string,
  count: number,
): ReadonlyArray<string> => {
  if (count === 0) {
    return []
  }

  const result: Array<string> = []
  for (let i = 0; i < count; i++) {
    result.push(evaluate())
  }

  return result
}

const generatePlaceholder = (evaluate: () => string, len: number) => {
  if (len === 0) {
    return () => ""
  } else if (len === 1) {
    return evaluate
  }

  return () => {
    let result = evaluate()
    for (let i = 1; i < len; i++) {
      result += `,${evaluate()}`
    }

    return result
  }
}

/** @internal */
export const defaultEscape = function escape(str: string) {
  return '"' + str.replace(/"/g, '""').replace(/\./g, '"."') + '"'
}
