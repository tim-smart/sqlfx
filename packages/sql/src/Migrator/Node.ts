/**
 * @since 1.0.0
 */
/// <reference types="node" />

import { pipe } from "effect/Function"
import * as Option from "effect/Option"
import * as Effect from "effect/Effect"
import type { Loader, ResolvedMigration } from "../Migrator.js"

/**
 * @since 1.0.0
 */
export const fromDisk = (directory: string): Loader =>
  pipe(
    Effect.promise(() => import("node:fs")),
    Effect.map(NFS =>
      NFS.readdirSync(directory)
        .map(_ =>
          Option.fromNullable(_.match(/^(?:.*\/)?(\d+)_([^.]+)\.(js|ts)$/)),
        )
        .flatMap(
          Option.match({
            onNone: () => [],
            onSome: ([basename, id, name]): ReadonlyArray<ResolvedMigration> =>
              [
                [
                  Number(id),
                  name,
                  Effect.promise(
                    () =>
                      import(
                        /* @vite-ignore */
                        `${directory}/${basename}`
                      ),
                  ),
                ],
              ] as const,
          }),
        )
        .sort(([a], [b]) => a - b),
    ),
    Effect.catchAllDefect(_ =>
      Effect.as(
        Effect.logDebug(`Could not load migrations from disk: ${_}`),
        [],
      ),
    ),
  )
