import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  build: {
    rollupOptions: {
      input: resolve(__dirname, "./main.js"),
      output: {
        format: "iife",
        entryFileNames: "index.js",
      },
    },
    outDir: "dist",
    emptyOutDir: true,
  },
});
