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
      "effect-schema-class/test": path.resolve(__dirname, "/test"),
      "effect-schema-class": path.resolve(__dirname, "/src"),
    },
  },
})
