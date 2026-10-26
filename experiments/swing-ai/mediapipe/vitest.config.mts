import { fileURLToPath, URL } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: [fileURLToPath(new URL("./src/**/*.test.ts", import.meta.url))],
  },
});
