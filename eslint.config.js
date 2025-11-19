import js from "@eslint/js";
import importPlugin from "eslint-plugin-import";

export default [
  js.configs.recommended,

  {
    plugins: { import: importPlugin },
    rules: {
      "no-unused-vars": "warn",
      "import/no-unresolved": "error",
      "import/no-unused-modules": [1, { unusedExports: true }],
    },
  },
];
