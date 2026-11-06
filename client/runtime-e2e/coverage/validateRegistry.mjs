import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import ts from "typescript";

function declaredTags(file, source) {
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const tags = [];
  const visit = (node) => {
    if (ts.isCallExpression(node)) {
      const call = node.expression.getText(ast);
      if (call === "test.describe.skip" || call === "test.describe.fixme")
        return;
      if (call === "test" || call === "test.only") {
        const title = node.arguments[0];
        const callback = node.arguments[node.arguments.length - 1];
        if (
          title &&
          callback &&
          (ts.isArrowFunction(callback) || ts.isFunctionExpression(callback))
        ) {
          const text = ts.isStringLiteralLike(title)
            ? title.text
            : ts.isTemplateExpression(title)
              ? title.head.text
              : "";
          tags.push(
            ...[...text.matchAll(/\[(RUNTIME-[A-Z-]+)]/g)].map(
              (match) => match[1],
            ),
          );
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(ast);
  return tags;
}

/** Validate registered test declarations without consulting design documents. */
export async function validateRuntimeRegistry(scenarioRoot, registry) {
  const errors = [];
  const found = new Map();
  const taggedFiles = new Set();
  const entries = Object.entries(registry);
  if (entries.length === 0)
    errors.push("the runtime scenario registry is empty");

  for (const file of (await readdir(scenarioRoot)).sort()) {
    if (!file.endsWith(".spec.ts")) continue;
    const tags = declaredTags(
      file,
      await readFile(resolve(scenarioRoot, file), "utf8"),
    );
    for (const id of tags) {
      if (found.has(id)) errors.push(`${id}: duplicate runtime scenario tag`);
      found.set(id, file);
      taggedFiles.add(file);
    }
  }

  for (const [id, expectedFile] of entries) {
    if (found.get(id) !== expectedFile) {
      errors.push(
        `${id}: expected a test in ${expectedFile}, found ${found.get(id) ?? "nothing"}`,
      );
    }
  }
  for (const [id, file] of found) {
    if (!Object.hasOwn(registry, id))
      errors.push(`${id}: ${file} is not registered`);
  }
  return { errors, registered: entries.length, taggedFiles: taggedFiles.size };
}
