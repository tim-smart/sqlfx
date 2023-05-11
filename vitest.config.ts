/// <reference types="vitest" />
import path from "path"
import { defineConfig } from "vite"

export default defineConfig({
  test: {
    include: ["./test/**/*.test.ts"],
    exclude: ["./src/index.ts"],
    globals: true,
    coverage: {
      provider: "c8",
    },
  },
  resolve: {
    alias: {
      "pgfx/test": path.resolve(__dirname, "/test"),
      pgfx: path.resolve(__dirname, "/src"),
    },
  },
})
