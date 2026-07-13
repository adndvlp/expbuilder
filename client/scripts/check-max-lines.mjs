import { readdir, readFile } from "node:fs/promises";
import { extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const MAX_LINES = 300;
const CLIENT_ROOT = fileURLToPath(new URL("..", import.meta.url));
const INCLUDED_EXTENSIONS = new Set([
  ".css",
  ".html",
  ".js",
  ".json",
  ".md",
  ".mjs",
  ".svg",
  ".ts",
  ".tsx",
]);
const IGNORED_DIRECTORIES = new Set([
  "coverage",
  "dist",
  "node_modules",
  "playwright-report",
  "test-results",
]);
const IGNORED_FILES = new Set(["package-lock.json"]);

async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (!IGNORED_DIRECTORIES.has(entry.name)) {
        files.push(...(await collectFiles(join(directory, entry.name))));
      }
      continue;
    }

    if (
      entry.isFile() &&
      !IGNORED_FILES.has(entry.name) &&
      INCLUDED_EXTENSIONS.has(extname(entry.name))
    ) {
      files.push(join(directory, entry.name));
    }
  }

  return files;
}

function countLines(content) {
  if (content.length === 0) return 0;
  const newlineCount = content.match(/\n/g)?.length ?? 0;
  return newlineCount + (content.endsWith("\n") ? 0 : 1);
}

const files = await collectFiles(CLIENT_ROOT);
const violations = [];

for (const file of files) {
  const lines = countLines(await readFile(file, "utf8"));
  if (lines > MAX_LINES) {
    violations.push({ file: relative(CLIENT_ROOT, file), lines });
  }
}

violations.sort((left, right) => right.lines - left.lines);

if (violations.length > 0) {
  console.error(`Files exceeding ${MAX_LINES} lines:`);
  for (const { file, lines } of violations) {
    console.error(`${String(lines).padStart(5)} ${file}`);
  }
  process.exitCode = 1;
} else {
  console.log(
    `All maintained client files contain at most ${MAX_LINES} lines.`,
  );
}
