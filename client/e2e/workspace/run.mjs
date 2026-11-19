import { buildWorkspace } from "../../../scripts/workspaceBuild.mjs";
import { runPanel } from "./panel.mjs";
import { runAdvanced } from "./advanced.mjs";
import { runCases } from "./cases.mjs";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { createRequire } from "node:module";
import express from "express";
await buildWorkspace();
const require = createRequire(new URL("../../package.json", import.meta.url)),
  { build } = require("esbuild"),
  { chromium, expect } = require("@playwright/test");
const root = fileURLToPath(new URL("../../../", import.meta.url)),
  dir = await mkdtemp(path.join(tmpdir(), "workspace-ui-"));
process.env.DB_ROOT = dir;
process.env.DB_PATH = path.join(dir, "db.json");
const trial = (id, name, next = null) => ({
  id,
  name,
  type: "Trial",
  plugin: "plugin-dynamic",
  parentLoopId: null,
  defaultNextTrialId: next,
  branches: next ? [next] : [],
  branchConditions: [],
  parameters: {},
  trialCode: "",
});
const seed = {
  experiments: [],
  trials: [
    {
      experimentID: "test",
      entryItemId: 1,
      updatedAt: "seed",
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
};
await writeFile(process.env.DB_PATH, JSON.stringify(seed));
const bundle = await build({
  entryPoints: [root + "client/e2e/workspace/fixture.tsx"],
  bundle: true,
  write: false,
  jsx: "automatic",
  format: "iife",
  outfile: "fixture.js",
  nodePaths: [root + "client/node_modules"],
  define: { "process.env.NODE_ENV": '"production"', "import.meta.env": "{}" },
  loader: { ".png": "dataurl", ".svg": "dataurl" },
});
const js = bundle.outputFiles.find((f) => f.path.endsWith(".js")).text,
  css = bundle.outputFiles.find((f) => f.path.endsWith(".css"))?.text ?? "";
const app = express();
app.use(express.json({ limit: "20mb" }));
app.use((await import("../../../server/routes/timeline/index.js")).default);
app.use((await import("../../../server/routes/plugins/metadata.js")).default);
const { withDbMutation } = await import(
  "../../../server/modules/session-persistence/dbQueue.js"
);
app.post("/__fixture", async (req, res) => {
  await withDbMutation((data) => {
    data.trials = [req.body];
    data.mutationReceipts = [];
  });
  res.json({ success: true });
});
app.get("/fixture.js", (_, res) => res.type("js").send(js));
app.get("/fixture.css", (_, res) => res.type("css").send(css));
app.get("/test", (_, res) =>
  res
    .type("html")
    .send(
      '<!doctype html><style>:root{--primary-blue:#3d92b4;--gold:#f1c40f;--background:#23272f;--text-light:#fff;--neutral-mid:#444;--dark-gold:#ccac28;--text-dark:#ddd}body{margin:0;background:#23272f;color:#fff;font:14px sans-serif}</style><link rel="stylesheet" href="/fixture.css"><div id="app"></div><script>window.electron={getApiBaseUrl:()=>location.origin}</script><script src="/fixture.js"></script>',
    ),
);
const server = await new Promise((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  }),
  origin = "http://127.0.0.1:" + server.address().port;
const browser = await chromium.launch({
  headless: true,
  ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH
    ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH }
    : {}),
});
const page = await browser.newPage({
    viewport: { width: 1500, height: 1000 },
    colorScheme: "dark",
  }),
  errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const state = async () =>
  JSON.parse(await readFile(process.env.DB_PATH, "utf8")).trials[0];
const run = async (name, fn) => {
  await fn();
  console.log("PASS " + name);
  assert.deepEqual(errors, []);
};
const handles = async (a, b) => {
  const from = await page
      .getByTestId("item-" + a)
      .locator('[data-handleid="flow-source"]')
      .boundingBox(),
    to = await page
      .getByTestId("item-" + b)
      .locator('[data-handleid="flow-target"]')
      .boundingBox();
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, {
    steps: 24,
  });
  await page.mouse.up();
};
const reset = async (document) => {
  await fetch(origin + "/__fixture", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(document),
  });
  await page.goto(origin + "/test");
  await expect(page.getByTestId("item-1")).toBeVisible();
  await page.waitForTimeout(350);
};
const base = () => structuredClone(seed.trials[0]);
const dragTo = async (id, point) => {
  const box = await page.getByTestId("item-" + id).boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(point.x, point.y, { steps: 24 });
};
const firstEdgePoint = () =>
  page
    .locator(".react-flow__edge-path")
    .first()
    .evaluate((p) => {
      const v = p
        .getPointAtLength(p.getTotalLength() / 2)
        .matrixTransform(p.getScreenCTM());
      return { x: v.x, y: v.y };
    });

try {
  await page.goto(origin + "/test");
  await expect(page.getByTestId("item-4")).toBeVisible();
  await page.waitForTimeout(400);
  await runCases({
    page,
    expect,
    assert,
    run,
    state,
    reset,
    base,
    handles,
    firstEdgePoint,
    dragTo,
  });
  await runAdvanced({
    page,
    expect,
    assert,
    run,
    state,
    reset,
    base,
    firstEdgePoint,
  });
  await runPanel({
    page,
    expect,
    assert,
    run,
    state,
    reset,
    base,
    dragTo,
    firstEdgePoint,
  });
} catch (e) {
  console.error("Browser errors:", errors);
  await page.screenshot({
    path: "/private/tmp/workspace-production-failure.png",
  });
  console.error((await page.locator("body").innerText()).slice(0, 2500));
  throw e;
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
