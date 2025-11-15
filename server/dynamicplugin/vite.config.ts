import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, "index.ts"),
      name: "DynamicPlugin",
      fileName: "index",
      formats: ["iife"],
    },
    rollupOptions: {
      external: ["jspsych"],
      output: {
        globals: {
          jspsych: "jsPsychModule",
        },
      },
    },
  },
});
