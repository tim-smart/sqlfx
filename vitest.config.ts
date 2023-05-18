/// <reference types="vitest" />

import babel from "@vitejs/plugin-react"
import path from "path"
import { defineConfig } from "vite"

// eslint-disable-next-line @typescript-eslint/no-var-requires
const babelConfig = require("./.babel.mjs.json")

export default defineConfig({
  plugins: [babel({ babel: babelConfig })],
  test: {
    include: ["packages/*/test/**/*.test.ts"],
    globals: true,
  },
  resolve: {
    alias: {
      "@sqlfx/sql/test": path.join(__dirname, "packages/sql/test"),
      "@sqlfx/sql": path.join(__dirname, "packages/sql/src"),

      "@sqlfx/pg/test": path.join(__dirname, "packages/pg/test"),
      "@sqlfx/pg": path.join(__dirname, "packages/pg/src"),
    },
  },
})
