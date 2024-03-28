import * as path from "path"
import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    include: ["./test/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@sqlfx/sql": path.join(__dirname, "../sql/src"),
      "@sqlfx/mysql2/test": path.join(__dirname, "test"),
      "@sqlfx/mysql2": path.join(__dirname, "src"),
    },
  },
})
