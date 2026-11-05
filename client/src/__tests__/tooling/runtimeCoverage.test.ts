// @vitest-environment node
import { spawnSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";
import { validateRuntimeRegistry } from "../../../runtime-e2e/coverage/validateRegistry.mjs";

const tag = "RUNTIME-EXAMPLE";
const declaration = `test("[${tag}] checks behavior", async () => {});`;

async function check(
  sources: Record<string, string>,
  registry = { [tag]: "example.spec.ts" },
) {
  const directory = await mkdtemp(join(tmpdir(), "runtime-registry-"));
  try {
    for (const [file, source] of Object.entries(sources)) {
      await writeFile(join(directory, file), source);
    }
    return await validateRuntimeRegistry(directory, registry);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

test("the runtime registry command validates the repository's scenario declarations", () => {
  const checker = fileURLToPath(
    new URL("../../../runtime-e2e/coverage/checkCoverage.mjs", import.meta.url),
  );
  const result = spawnSync(process.execPath, [checker], { encoding: "utf8" });
  expect(result.status, result.stderr).toBe(0);
  expect(result.stdout).toContain("Runtime scenario registry:");
});

test("recognizes literal and parameterized test titles with optional test details", async () => {
  const result = await check(
    {
      "example.spec.ts": declaration,
      "parameterized.spec.ts":
        'for (const value of [1, 2]) { test(`[RUNTIME-PARAMETERIZED] value ${value}`, { tag: "@runtime" }, async () => {}); }',
    },
    {
      [tag]: "example.spec.ts",
      "RUNTIME-PARAMETERIZED": "parameterized.spec.ts",
    },
  );
  expect(result).toEqual({ errors: [], registered: 2, taggedFiles: 2 });
});

test("rejects a missing registered scenario file", async () => {
  const result = await check({});
  expect(result.errors).toContain(
    `${tag}: expected a test in example.spec.ts, found nothing`,
  );
});

test("rejects a tag moved to the wrong file", async () => {
  const result = await check({ "other.spec.ts": declaration });
  expect(result.errors).toContain(
    `${tag}: expected a test in example.spec.ts, found other.spec.ts`,
  );
});

test("rejects duplicate tags across test declarations", async () => {
  const result = await check({ "example.spec.ts": declaration + declaration });
  expect(result.errors).toContain(`${tag}: duplicate runtime scenario tag`);
});

test("rejects an unregistered test tag", async () => {
  const result = await check({
    "example.spec.ts": declaration,
    "new.spec.ts": 'test("[RUNTIME-NEW] behavior", async () => {});',
  });
  expect(result.errors).toContain("RUNTIME-NEW: new.spec.ts is not registered");
});

test.each([
  `// ${declaration}`,
  `const note = "[${tag}]";`,
  `test.describe("[${tag}] suite title", () => {});`,
  `test.skip("[${tag}] skipped", async () => {});`,
  `test.fixme("[${tag}] pending", async () => {});`,
  `test.describe.skip("skipped suite", () => { ${declaration} });`,
  `test.describe.fixme("pending suite", () => { ${declaration} });`,
])(
  "does not count comments, notes, suite titles or disabled tests: %s",
  async (source) => {
    const result = await check({ "example.spec.ts": source });
    expect(result.errors).toContain(
      `${tag}: expected a test in example.spec.ts, found nothing`,
    );
  },
);

test("rejects an empty registry rather than reporting a successful check", async () => {
  const result = await check({}, {});
  expect(result.errors).toContain("the runtime scenario registry is empty");
});
