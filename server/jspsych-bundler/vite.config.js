import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  publicDir: "public",
  build: {
    rollupOptions: {
      input: resolve(__dirname, "./wrapper.js"),
      output: {
        format: "iife",
        name: "jsPsychExports",
        entryFileNames: "index.js",
        assetFileNames: "index.[ext]",
      },
    },
    cssCodeSplit: false,
    outDir: "../jspsych-bundle",
    emptyOutDir: false,
  },
});
