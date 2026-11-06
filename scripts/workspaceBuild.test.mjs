import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mkdtemp,
  mkdir,
  writeFile,
  readFile,
  rm,
  access,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildWorkspace } from "./workspaceBuild.mjs";

const compiler = fileURLToPath(
  new URL("../node_modules/typescript/bin/tsc", import.meta.url),
);
async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), "workspace-build-contract-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const source = join(root, "shared/experiment-workspace");
  await mkdir(source, { recursive: true });
  await writeFile(join(root, "package.json"), '{"type":"module"}');
  await writeFile(
    join(source, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: {
        module: "NodeNext",
        moduleResolution: "NodeNext",
        target: "ES2020",
        strict: true,
        types: [],
        declaration: true,
        noEmitOnError: true,
        outDir: "dist",
      },
      include: ["*.ts"],
      exclude: ["dist"],
    }),
  );
  await writeFile(
    join(source, "entry.ts"),
    "export const value: number = 7;\n",
  );
  return {
    root,
    source,
    options: { root, compiler },
    output: join(source, "dist/entry.js"),
  };
}
test("a clean build emits runnable ESM and declarations, and verifies missing or modified output", async (t) => {
  const f = await fixture(t);
  assert.equal(await buildWorkspace(f.options), true);
  assert.match(await readFile(f.output, "utf8"), /value = 7/);
  assert.match(
    await readFile(join(f.source, "dist/entry.d.ts"), "utf8"),
    /value: number/,
  );
  assert.equal(await buildWorkspace(f.options), false);
  await rm(f.output);
  assert.equal(await buildWorkspace(f.options), true);
  await writeFile(f.output, "export const value = 99;\n");
  assert.equal(await buildWorkspace(f.options), true);
  assert.match(await readFile(f.output, "utf8"), /value = 7/);
});
test("deleting a source removes its obsolete emitted module", async (t) => {
  const f = await fixture(t);
  await writeFile(join(f.source, "removed.ts"), "export const old = 1;\n");
  await buildWorkspace(f.options);
  await rm(join(f.source, "removed.ts"));
  await buildWorkspace(f.options);
  await assert.rejects(access(join(f.source, "dist/removed.js")));
});
test("a failed compilation removes the old output and prevents a consumer from continuing", async (t) => {
  const f = await fixture(t);
  await buildWorkspace(f.options);
  await writeFile(
    join(f.source, "entry.ts"),
    "export const value: number = 'invalid';\n",
  );
  let consumed = false;
  await assert.rejects(
    (async () => {
      await buildWorkspace(f.options);
      consumed = true;
    })(),
    /compilation failed/i,
  );
  assert.equal(consumed, false);
  await assert.rejects(access(f.output));
});
test("concurrent preparation compiles once and never clears another consumer's completed output", async (t) => {
  const f = await fixture(t);
  const results = await Promise.all([
    buildWorkspace(f.options),
    buildWorkspace(f.options),
  ]);
  assert.deepEqual(results.sort(), [false, true]);
  assert.match(await readFile(f.output, "utf8"), /value = 7/);
});
