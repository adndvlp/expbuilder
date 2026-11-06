import { test } from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL(".", import.meta.url));
async function sources(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const found = await Promise.all(
    entries.map(async (entry) => {
      if (["dist", "type-tests"].includes(entry.name)) return [];
      const file = path.join(directory, entry.name);
      return entry.isDirectory()
        ? sources(file)
        : /(?<!\.d)\.(?:ts|js)$/.test(file)
          ? [file]
          : [];
    }),
  );
  return found.flat();
}
test("the workspace domain has no application or platform imports", async () => {
  const invalid = [];
  for (const file of await sources(root)) {
    const text = await readFile(file, "utf8");
    for (const match of text.matchAll(
      /(?:from\s*|import\s*\()\s*["']([^"']+)["']/g,
    )) {
      const specifier = match[1];
      if (
        !specifier.startsWith(".") ||
        specifier.endsWith(".json") ||
        !path.resolve(path.dirname(file), specifier).startsWith(root)
      )
        invalid.push(path.relative(root, file) + ": " + specifier);
    }
  }
  assert.deepEqual(invalid, []);
});
