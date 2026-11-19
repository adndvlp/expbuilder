import assert from "node:assert/strict";
import { createRequire } from "node:module";
import {
  mkdtemp,
  mkdir,
  writeFile,
  readFile,
  realpath,
} from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import path from "node:path";
const root = fileURLToPath(new URL("../", import.meta.url));
const application = process.argv[2];
assert.ok(
  application,
  "Usage: node scripts/verify-workspace-electron.mjs /absolute/path/ExpBuilder.app",
);
assert.ok(
  path.isAbsolute(application),
  "The application path must be absolute.",
);
const require = createRequire(path.join(root, "client/package.json"));
const { _electron, expect } = require("@playwright/test");
const dir = await realpath(
  await mkdtemp(path.join(tmpdir(), "workspace-packaged-startup-")),
);
const profile = path.join(dir, "profile");
const dbPath = path.join(profile, "database/db.json");
await mkdir(path.dirname(dbPath), { recursive: true });
const id = "packaged-workspace-smoke";
const trial = (id, name, next = null) => ({
  id,
  name,
  type: "Trial",
  plugin: "plugin-dynamic",
  parentLoopId: null,
  defaultNextTrialId: next,
  branches: next === null ? [] : [next],
  branchConditions: [],
  parameters: {},
  trialCode: "",
});
await writeFile(
  dbPath,
  JSON.stringify({
    experiments: [
      {
        experimentID: id,
        name: "Packaged workspace verification",
        createdAt: "2026-11-05T00:00:00.000Z",
        updatedAt: "2026-11-05T00:00:00.000Z",
      },
    ],
    trials: [
      {
        experimentID: id,
        workspaceSchemaVersion: 2,
        entryItemId: 1,
        updatedAt: "seed",
        authoringRevision: "seed",
        trials: [
          trial(1, "Inicio", 2),
          trial(2, "Ensayo A", 3),
          trial(3, "Final"),
          trial(4, "Trial suelto"),
        ],
        loops: [],
        timeline: [1, 2, 3, 4].map((id) => ({ id, type: "trial" })),
      },
    ],
  }),
);
const portServer = createServer();
await new Promise((resolve) => portServer.listen(0, "127.0.0.1", resolve));
const port = portServer.address().port;
await new Promise((resolve) => portServer.close(resolve));
const env = {
  ...process.env,
  PORT: String(port),
  DB_ROOT: profile,
  DB_PATH: dbPath,
};
delete env.ELECTRON_RUN_AS_NODE;
let app;
const errors = [],
  messages = [];
try {
  app = await _electron.launch({
    executablePath: path.join(application, "Contents/MacOS/ExpBuilder"),
    args: [
      "--user-data-dir=" + profile,
      "--enable-logging=file",
      "--log-file=" + path.join(dir, "electron.log"),
    ],
    env,
    timeout: 25000,
  });
  app.process().stderr?.on("data", (data) => messages.push(String(data)));
  app.process().stdout?.on("data", (data) => messages.push(String(data)));
  app
    .process()
    .on("exit", (code, signal) =>
      console.error("Electron exit:", { code, signal }),
    );
  const runtime = await app.evaluate(({ app }) => ({
    userData: app.getPath("userData"),
    appPath: app.getAppPath(),
    resourcesPath: process.resourcesPath,
    dbRoot: process.env.DB_ROOT,
    dbPath: process.env.DB_PATH,
    port: process.env.PORT,
    electron: process.versions.electron,
    node: process.versions.node,
  }));
  console.log("Runtime:", JSON.stringify(runtime));
  assert.equal(runtime.userData, profile);
  assert.equal(runtime.dbRoot, profile);
  assert.equal(runtime.dbPath, dbPath);
  assert.equal(
    runtime.appPath,
    path.join(application, "Contents/Resources/app.asar"),
  );
  const page = await app.firstWindow({ timeout: 25000 });
  console.log("Window acquired:", page.url());
  page.on("pageerror", (error) => errors.push(error.message));
  await page.waitForLoadState("domcontentloaded");
  await expect(page.locator("#root")).not.toBeEmpty();
  const api = await page.evaluate(() => globalThis.electron.getApiBaseUrl());
  assert.equal(api, "http://localhost:" + port);
  const response = await globalThis.fetch(api + "/api/workspace/" + id);
  assert.equal(response.status, 200);
  const snapshot = await response.json();
  assert.equal(snapshot.document.trials.length, 4);
  await page.goto(
    page.url().split("#")[0] + "#/home/experiment/" + id + "/builder",
  );
  await expect(page.getByTestId("item-1")).toBeVisible({ timeout: 20000 });
  await expect(page.getByTestId("item-2")).toBeVisible();
  await expect(page.getByTestId("item-3")).toBeVisible();
  await expect(page.getByTestId("item-4")).toBeVisible();
  await expect(page.locator(".react-flow__edge-path")).toHaveCount(2);
  await page.getByTestId("item-2").click();
  await expect(
    page.locator('.react-flow__node.selected [data-testid="item-2"]'),
  ).toBeVisible();
  await page.screenshot({ path: path.join(dir, "workspace.png") });
  assert.deepEqual(errors, []);
  const persisted = JSON.parse(await readFile(dbPath, "utf8"));
  assert.equal(persisted.trials[0].trials.length, 4);
  const updateConfigPresent = await readFile(
    path.join(runtime.resourcesPath, "app-update.yml"),
  ).then(
    () => true,
    () => false,
  );
  const result = {
    status: "PASS",
    updateConfigPresent,
    scope: "packaged Electron startup, backend and real workspace UI",
    runtime,
    trials: 4,
    edges: 2,
    pageErrors: errors,
    evidence: dir,
  };
  await writeFile(
    path.join(dir, "result.json"),
    JSON.stringify(result, null, 2),
  );
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.error("Packaged startup failed:", error);
  console.error("Page errors:", errors);
  console.error("Process messages:", messages.join("").slice(-6000));
  console.error("Evidence:", dir);
  if (app) {
    const pages = app.windows();
    if (pages[0]) {
      console.error(
        "Page text:",
        (
          await pages[0]
            .locator("body")
            .innerText()
            .catch(() => "")
        ).slice(0, 3000),
      );
      await pages[0]
        .screenshot({ path: path.join(dir, "failure.png") })
        .catch(() => {});
    }
  }
  process.exitCode = 1;
} finally {
  if (app) await app.close();
}
