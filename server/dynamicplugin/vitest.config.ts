import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

const expbuilderCoreRoot = [
  resolve(__dirname, "../expbuilder-jspsych"),
  resolve(__dirname, "../../../expbuilder-jspsych"),
].find((candidate) => existsSync(candidate));

if (!expbuilderCoreRoot) {
  throw new Error("Unable to locate the ExpBuilder jsPsych source tree.");
}

export default defineConfig({
  resolve: {
    alias: {
      "@expbuilder-jspsych": expbuilderCoreRoot,
    },
  },
  test: {
    environment: "jsdom",
    restoreMocks: true,
    clearMocks: true,
    mockReset: false,
    setupFiles: ["tests/setup.ts"],
    include: ["tests/**/*.test.ts"],
    environmentOptions: {
      jsdom: {
        url: "http://localhost/",
      },
    },
  },
});
