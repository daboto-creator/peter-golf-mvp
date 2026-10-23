import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["experiments/swing-ai/**/*.test.ts"],
  },
});
