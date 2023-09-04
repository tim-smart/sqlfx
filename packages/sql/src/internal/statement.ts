import * as Equal from "@effect/data/Equal"
import { identity } from "@effect/data/Function"
import * as Hash from "@effect/data/Hash"
import { pipeArguments } from "@effect/data/Pipeable"
import * as Effect from "@effect/io/Effect"
import { ChannelTypeId } from "@effect/stream/Channel"
import { SinkTypeId } from "@effect/stream/Sink"
import * as Stream from "@effect/stream/Stream"
import type { Connection, Row } from "@sqlfx/sql/Connection"
import type { SqlError } from "@sqlfx/sql/Error"
import type {
  Argument,
  ArrayHelper,
  Compiler,
  Constructor,
  Custom,
  Fragment,
  FragmentId as _FragmentId,
  Helper,
  Identifier,
  Literal,
  Parameter,
  Primitive,
  PrimitiveKind,
  RecordInsertHelper,
  RecordUpdateHelper,
  Segment,
  Statement,
} from "@sqlfx/sql/Statement"

/** @internal */
export const FragmentId: _FragmentId = Symbol.for(
  "pgfx/Fragment",
) as _FragmentId

/** @internal */
export function isFragment(u: unknown): u is Fragment {
  return typeof u === "object" && u !== null && FragmentId in u
}

/** @internal */
export function isCustom<A extends Custom<any, any, any, any>>(
  kind: A["kind"],
) {
  return (u: unknown): u is A => {
    return u instanceof CustomImpl && u.kind === kind
  }
}

/** @internal */
export class StatementPrimitive<A> implements Statement<A> {
  get [FragmentId]() {
    return identity
  }

  constructor(
    readonly i0: ReadonlyArray<Segment>,
    readonly i1: Connection.Acquirer,
  ) {}

  get segments(): ReadonlyArray<Segment> {
    return this.i0
  }

  get withoutTransform(): Effect.Effect<never, SqlError, ReadonlyArray<A>> {
    return Effect.scoped(
      Effect.flatMap(this.i1, _ => _.executeWithoutTransform<any>(this)),
    )
  }

  get stream(): Stream.Stream<never, SqlError, A> {
    return Stream.unwrapScoped(
      Effect.map(this.i1, _ => _.executeStream<any>(this)),
    )
  }

  get values(): Effect.Effect<
    never,
    SqlError,
    ReadonlyArray<ReadonlyArray<Primitive>>
  > {
    return Effect.scoped(
      Effect.flatMap(this.i1, _ => _.executeValues<any>(this)),
    )
  }

  get compile(): Effect.Effect<
    never,
    SqlError,
    readonly [sql: string, params: ReadonlyArray<Primitive>]
  > {
    return Effect.scoped(Effect.flatMap(this.i1, _ => _.compile(this as any)))
  }

  // Make it a valid effect
  public _tag = "Commit" // OP_COMMIT
  public i2: any = undefined;
  [Effect.EffectTypeId] = undefined as any;
  [Stream.StreamTypeId] = undefined as any;
  [SinkTypeId] = undefined as any;
  [ChannelTypeId] = undefined as any

  commit(): Effect.Effect<never, SqlError, ReadonlyArray<A>> {
    return Effect.scoped(
      Effect.flatMap(this.i1, _ => _.execute(this as any) as any),
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

  pipe() {
    return pipeArguments(this, arguments)
  }
}

class FragmentImpl implements Fragment {
  get [FragmentId]() {
    return identity
  }
  constructor(readonly segments: ReadonlyArray<Segment>) {}
}

class LiteralImpl implements Literal {
  readonly _tag = "Literal"
  constructor(
    readonly value: string,
    readonly params?: ReadonlyArray<Primitive>,
  ) {}
}

class IdentifierImpl implements Identifier {
  readonly _tag = "Identifier"
  constructor(readonly value: string) {}
}

class ParameterImpl implements Parameter {
  readonly _tag = "Parameter"
  constructor(readonly value: Primitive) {}
}

class ArrayHelperImpl implements ArrayHelper {
  readonly _tag = "ArrayHelper"
  constructor(readonly value: Array<Primitive>) {}
}

class RecordInsertHelperImpl implements RecordInsertHelper {
  readonly _tag = "RecordInsertHelper"
  constructor(readonly value: ReadonlyArray<Record<string, Primitive>>) {}
}

class RecordUpdateHelperImpl implements RecordUpdateHelper {
  readonly _tag = "RecordUpdateHelper"
  constructor(
    readonly value: ReadonlyArray<Record<string, Primitive>>,
    readonly alias: string,
  ) {}
}

class CustomImpl<T extends string, A, B, C> implements Custom<T, A, B, C> {
  readonly _tag = "Custom"
  constructor(
    readonly kind: T,
    readonly i0: A,
    readonly i1: B,
    readonly i2: C,
  ) {}
}

/** @internal */
export const custom =
  <C extends Custom<any, any, any, any>>(kind: C["kind"]) =>
  (i0: C["i0"], i1: C["i1"], i2: C["i2"]): Fragment =>
    new FragmentImpl([new CustomImpl(kind, i0, i1, i2)])

const isHelper = (u: unknown): u is Helper =>
  u instanceof ArrayHelperImpl ||
  u instanceof RecordInsertHelperImpl ||
  u instanceof RecordUpdateHelperImpl ||
  u instanceof IdentifierImpl

const isPrimitive = (u: unknown): u is Primitive =>
  typeof u === "string" ||
  typeof u === "number" ||
  typeof u === "boolean" ||
  u instanceof Date ||
  u === null ||
  u === undefined ||
  u instanceof Uint8Array ||
  u instanceof Int8Array

/** @internal */
export const make = (acquirer: Connection.Acquirer): Constructor =>
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
          return new RecordUpdateHelperImpl(strings, args[0])
        }

        return new RecordInsertHelperImpl(strings)
      }
      return new ArrayHelperImpl(strings)
    } else if (typeof strings === "string") {
      return new IdentifierImpl(strings)
    } else if (typeof strings === "object") {
      if (typeof args[0] === "string") {
        return new RecordUpdateHelperImpl([strings as any], args[0])
      }
      return new RecordInsertHelperImpl([strings as any])
    }

    throw "absurd"
  }

/** @internal */
export function statement(
  acquirer: Connection.Acquirer,
  strings: TemplateStringsArray,
  ...args: Array<Argument>
): Statement<Row> {
  const segments: Array<Segment> =
    strings[0].length > 0 ? [new LiteralImpl(strings[0])] : []

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]

    if (isFragment(arg)) {
      segments.push(...arg.segments)
    } else if (isHelper(arg)) {
      segments.push(arg)
    } else {
      segments.push(new ParameterImpl(arg))
    }

    if (strings[i + 1].length > 0) {
      segments.push(new LiteralImpl(strings[i + 1]))
    }
  }

  return new StatementPrimitive<Row>(segments, acquirer)
}

/** @internal */
export const unsafe =
  (acquirer: Connection.Acquirer) =>
  <A extends object = Row>(
    sql: string,
    params?: ReadonlyArray<Primitive>,
  ): Statement<A> =>
    new StatementPrimitive<A>([new LiteralImpl(sql, params)], acquirer)

/** @internal */
export const unsafeFragment = (
  sql: string,
  params?: ReadonlyArray<Primitive>,
): Fragment => new FragmentImpl([new LiteralImpl(sql, params)])

function convertLiteralOrFragment(clause: string | Fragment): Array<Segment> {
  if (typeof clause === "string") {
    return [new LiteralImpl(clause)]
  }
  return clause.segments as Array<Segment>
}

/** @internal */
export function join(literal: string, addParens = true, fallback = "") {
  const literalSegment = new LiteralImpl(literal)

  return function (clauses: ReadonlyArray<string | Fragment>): Fragment {
    if (clauses.length === 0) {
      return unsafeFragment(fallback)
    } else if (clauses.length === 1) {
      return new FragmentImpl(convertLiteralOrFragment(clauses[0]))
    }

    const segments: Array<Segment> = []

    if (addParens) {
      segments.push(new LiteralImpl("("))
    }

    segments.push.apply(segments, convertLiteralOrFragment(clauses[0]))

    for (let i = 1; i < clauses.length; i++) {
      segments.push(literalSegment)
      segments.push.apply(segments, convertLiteralOrFragment(clauses[i]))
    }

    if (addParens) {
      segments.push(new LiteralImpl(")"))
    }

    return new FragmentImpl(segments)
  }
}

/** @internal */
export const and = join(" AND ", true, "1=1")

/** @internal */
export const or = join(" OR ", true, "1=1")

const csvRaw = join(", ", false)

/** @internal */
export const csv: {
  (values: ReadonlyArray<string | Fragment>): Fragment
  (prefix: string, values: ReadonlyArray<string | Fragment>): Fragment
} = (
  ...args:
    | [values: ReadonlyArray<string | Fragment>]
    | [prefix: string, values: ReadonlyArray<string | Fragment>]
) => {
  if (args[args.length - 1].length === 0) {
    return unsafeFragment("")
  }

  if (args.length === 1) {
    return csvRaw(args[0])
  }

  return new FragmentImpl([
    new LiteralImpl(`${args[0]} `),
    ...csvRaw(args[1]).segments,
  ])
}

/** @internal */
class CompilerImpl implements Compiler {
  constructor(
    readonly parameterPlaceholder: (index: number) => string,
    readonly onIdentifier: (value: string) => string,
    readonly onRecordUpdate: (
      placeholders: string,
      alias: string,
      columns: string,
      values: ReadonlyArray<ReadonlyArray<Primitive>>,
    ) => readonly [sql: string, binds: ReadonlyArray<Primitive>],
    readonly onCustom: (
      type: Custom<string, unknown, unknown>,
      placeholder: () => string,
    ) => readonly [sql: string, binds: ReadonlyArray<Primitive>],
    readonly onInsert?: (
      columns: ReadonlyArray<string>,
      placeholders: string,
      values: ReadonlyArray<ReadonlyArray<Primitive>>,
    ) => readonly [sql: string, binds: ReadonlyArray<Primitive>],
  ) {}

  compile(
    statement: Fragment,
  ): readonly [sql: string, binds: ReadonlyArray<Primitive>] {
    if ((statement as any).__compiled) {
      return (statement as any).__compiled
    }

    const segments = statement.segments
    const len = segments.length

    let sql = ""
    const binds: Array<Primitive> = []
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
          sql += `(${generatePlaceholder(placeholder, segment.value.length)()})`
          binds.push.apply(binds, segment.value as any)
          break
        }

        case "RecordInsertHelper": {
          const keys = Object.keys(segment.value[0])

          if (this.onInsert) {
            const [s, b] = this.onInsert(
              keys.map(this.onIdentifier),
              placeholders(
                generatePlaceholder(placeholder, keys.length),
                segment.value.length,
              ),
              segment.value.map(record => keys.map(key => record[key])),
            )
            sql += s
            binds.push.apply(binds, b as any)
          } else {
            sql += `${generateColumns(
              keys,
              this.onIdentifier,
            )} VALUES ${placeholders(
              generatePlaceholder(placeholder, keys.length),
              segment.value.length,
            )}`

            for (let i = 0, len = segment.value.length; i < len; i++) {
              for (let j = 0, len = keys.length; j < len; j++) {
                binds.push(segment.value[i]?.[keys[j]] ?? null)
              }
            }
          }
          break
        }

        case "RecordUpdateHelper": {
          const keys = Object.keys(segment.value[0])
          const [s, b] = this.onRecordUpdate(
            placeholders(
              generatePlaceholder(placeholder, keys.length),
              segment.value.length,
            ),
            segment.alias,
            generateColumns(keys, this.onIdentifier),
            segment.value.map(record => keys.map(key => record?.[key])),
          )
          sql += s
          binds.push.apply(binds, b as any)
          break
        }

        case "Custom": {
          const [s, b] = this.onCustom(segment, placeholder)
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
export const makeCompiler = <C extends Custom<any, any, any, any> = any>(
  parameterPlaceholder: (index: number) => string,
  onIdentifier: (value: string) => string,
  onRecordUpdate: (
    placeholders: string,
    alias: string,
    columns: string,
    values: ReadonlyArray<ReadonlyArray<Primitive>>,
  ) => readonly [sql: string, params: ReadonlyArray<Primitive>],
  onCustom: (
    type: C,
    placeholder: () => string,
  ) => readonly [sql: string, params: ReadonlyArray<Primitive>],
  onInsert?: (
    columns: ReadonlyArray<string>,
    placeholders: string,
    values: ReadonlyArray<ReadonlyArray<Primitive>>,
  ) => readonly [sql: string, binds: ReadonlyArray<Primitive>],
): Compiler =>
  new CompilerImpl(
    parameterPlaceholder,
    onIdentifier,
    onRecordUpdate,
    onCustom as any,
    onInsert,
  )

const placeholders = (evaluate: () => string, count: number): string => {
  if (count === 0) {
    return ""
  }

  let result = `(${evaluate()})`
  for (let i = 1; i < count; i++) {
    result += `,(${evaluate()})`
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

const generateColumns = (
  keys: ReadonlyArray<string>,
  escape: (_: string) => string,
) => {
  if (keys.length === 0) {
    return "()"
  }

  let str = `(${escape(keys[0])}`
  for (let i = 1; i < keys.length; i++) {
    str += `,${escape(keys[i])}`
  }
  return str + ")"
}

/** @internal */
export const defaultEscape = (c: string) => {
  const re = new RegExp(c, "g")
  const double = c + c
  const dot = c + "." + c
  return (str: string) => c + str.replace(re, double).replace(/\./g, dot) + c
}

/** @internal */
export const primitiveKind = (value: Primitive): PrimitiveKind => {
  switch (typeof value) {
    case "string":
      return "string"
    case "number":
      return "number"
    case "boolean":
      return "boolean"
    case "bigint":
      return "bigint"
    case "undefined":
      return "null"
  }

  if (value === null) {
    return "null"
  } else if (value instanceof Date) {
    return "Date"
  } else if (value instanceof Uint8Array) {
    return "Uint8Array"
  } else if (value instanceof Int8Array) {
    return "Int8Array"
  }

  return "string"
}
