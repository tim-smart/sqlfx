import * as path from "path"
import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    include: ["./test/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@sqlfx/sql/test": path.join(__dirname, "test"),
      "@sqlfx/sql": path.join(__dirname, "src"),
    },
  },
})
