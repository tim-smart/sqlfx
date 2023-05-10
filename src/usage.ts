import { pipe } from "@effect/data/Function"
import * as Config from "@effect/io/Config"
import * as Effect from "@effect/io/Effect"
import * as Request from "@effect/io/Request"
import { ParseError } from "@effect/schema/ParseResult"
import * as Schema from "@effect/schema/Schema"
import * as EffectPg from "effect-pg"
import { SchemaClass } from "effect-schema-class"
import postgres from "postgres"

// === Person schema
const PersonId = pipe(
  Schema.number,
  Schema.int(),
  Schema.positive(),
  Schema.brand("PersonId"),
)
type PersonId = Schema.To<typeof PersonId>

class Person extends SchemaClass({
  id: PersonId,
  name: Schema.string,
}) {}

// === CreatePersonSchema
const CreatePersonSchema = pipe(Person.structSchema(), Schema.omit("id"))

// === Requests
interface GetPersonById
  extends Request.Request<EffectPg.EffectPgError | ParseError, Person> {
  readonly _tag: "GetById"
  readonly id: PersonId
}
const GetPersonById = Request.tagged<GetPersonById>("GetById")

interface CreatePerson extends Request.Request<EffectPg.EffectPgError, Person> {
  readonly _tag: "CreatePerson"
  readonly person: Schema.From<typeof CreatePersonSchema>
}
const CreatePerson = Request.tagged<CreatePerson>("CreatePerson")

// === main
const program = Effect.gen(function* (_) {
  const sql = yield* _(EffectPg.tag)

  // CreatePerson
  const createResolver = sql.resolver(
    (requests: CreatePerson[]) =>
      sql<{ id: number; name: string }[]>`INSERT INTO people ${sql(
        requests.map(_ => _.person),
      )} RETURNING id, name`,
    Person.schema(),
  )
  const decodeCreate = Schema.decodeEffect(CreatePersonSchema)
  const create = (params: CreatePerson["person"]) =>
    pipe(
      decodeCreate(params),
      Effect.flatMap(person =>
        Effect.request(CreatePerson({ person }), createResolver),
      ),
    )

  // GetPersonById
  const getByIdResolver = sql.idResolver(
    (requests: GetPersonById[]) =>
      sql<
        { id: number; name: string }[]
      >`SELECT * FROM people WHERE id IN ${sql(requests.map(_ => _.id))}`,
    Person.schema(),
    request => request.id,
    result => result.id,
  )
  const getById = (id: PersonId) =>
    Effect.request(GetPersonById({ id }), getByIdResolver)

  // === usage

  yield* _(sql`TRUNCATE people RESTART IDENTITY CASCADE`)

  const createResults = yield* _(
    sql.withTransaction(
      Effect.allPar(
        create({ name: "Tim" }),
        create({ name: "Joe" }),
        create({ name: "John" }),
      ),
    ),
  )
  console.log("CREATE", createResults)

  const people = yield* _(
    Effect.allPar(
      [
        getById(PersonId(1)),
        getById(PersonId(2)),
        getById(PersonId(3)),
        getById(PersonId(4)),
      ].map(Effect.option),
    ),
  )

  console.log("GET", people)
})

const EffectPgLive = EffectPg.makeLayer({
  database: Config.succeed("effect_pg_dev"),
  transform: Config.succeed(postgres.toCamel),
})

pipe(
  program,
  Effect.provideLayer(EffectPgLive),
  Effect.tapErrorCause(Effect.logErrorCause),
  Effect.runFork,
)
