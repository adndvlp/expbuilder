import js from "@eslint/js";
import tseslint from "typescript-eslint";
import importPlugin from "eslint-plugin-import-x";

export default [
  { ignores: ["shared/experiment-workspace/dist/**"] },
  js.configs.recommended,
  {
    files: ["scripts/**/*.mjs", "docs/demos/*.mjs"],
    languageOptions: {
      globals: {
        process: "readonly",
        console: "readonly",
        setTimeout: "readonly",
        URL: "readonly",
        Buffer: "readonly",
      },
    },
  },

  {
    plugins: { import: importPlugin },
    rules: {
      "no-unused-vars": "warn",
      "import/no-unresolved": "error",
      "import/no-unused-modules": [1, { unusedExports: true }],
    },
  },
  ...tseslint.configs.recommended.map((config) => ({
    ...config,
    files: ["shared/experiment-workspace/**/*.ts"],
  })),
  {
    files: ["shared/experiment-workspace/**/*.ts"],
    rules: { "import/no-unresolved": "off", "import/no-unused-modules": "off" },
  },
  // Preserve the pre-existing plugin payload contracts; converted implementations use strict types.
  {
    files: ["shared/experiment-workspace/records.ts"],
    rules: { "@typescript-eslint/no-explicit-any": "off" },
  },
];
