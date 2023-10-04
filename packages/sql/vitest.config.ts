/// <reference types="vitest" />
import * as path from "path"
import { defineConfig } from "vite"

export default defineConfig({
  test: {
    include: ["./test/**/*.test.ts"],
    globals: true,
  },
  resolve: {
    alias: {
      "@sqlfx/sql/test": path.join(__dirname, "test"),
      "@sqlfx/sql": path.join(__dirname, "src"),
    },
  },
})
