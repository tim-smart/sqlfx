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
      "@sqlfx/sql": path.join(__dirname, "../sql/src"),
      "@sqlfx/mysql/test": path.join(__dirname, "test"),
      "@sqlfx/mysql": path.join(__dirname, "src"),
    },
  },
})
