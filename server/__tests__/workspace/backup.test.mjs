import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import express from "express";
import JSZip from "jszip";
import { applyWorkspaceCommand } from "../../../shared/experiment-workspace/dist/commands.js";
test("real ZIP backup and import preserve disconnected records and their saved positions", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "workspace-backup-"));
  process.env.DB_ROOT = dir;
  process.env.DB_PATH = path.join(dir, "db.json");
  const t = (id) => ({
    id,
    name: "Trial " + id,
    parentLoopId: null,
    defaultNextTrialId: null,
    branches: [],
    branchConditions: [],
    parameters: { components: [{ name: "Button", props: { text: "keep" } }] },
  });
  const document = applyWorkspaceCommand(
    {
      experimentID: "backup",
      entryItemId: 1,
      trials: [t(1), t(2)],
      loops: [],
      timeline: [1, 2].map((id) => ({ id, type: "trial" })),
    },
    { kind: "convertWorkspace" },
  ).document;
  document.editorLayout.positionsByItemId["2"] = { x: 1250, y: 350 };
  const data = {
    experiments: [{ experimentID: "backup", name: "Backup" }],
    trials: [document],
    configs: [],
    sessionResults: [],
    sessionCounters: {},
  };
  await writeFile(process.env.DB_PATH, JSON.stringify(data));
  const app = express();
  app.use((await import("../../routes/db/export.js")).default);
  app.use((await import("../../routes/db/import.js")).default);
  const server = await new Promise((resolve) => {
      const s = app.listen(0, "127.0.0.1", () => resolve(s));
    }),
    origin = "http://127.0.0.1:" + server.address().port;
  try {
    const exported = await fetch(origin + "/api/export-experiment/backup");
    assert.equal(exported.status, 200);
    const bytes = await exported.arrayBuffer(),
      zip = await JSZip.loadAsync(bytes),
      saved = JSON.parse(await zip.file("Backup/data.json").async("string"));
    assert.deepEqual(saved.trials, document);
    await writeFile(
      process.env.DB_PATH,
      JSON.stringify({ ...data, trials: [] }),
    );
    const form = new FormData();
    form.set(
      "zipfile",
      new Blob([bytes], { type: "application/zip" }),
      "backup.zip",
    );
    const imported = await fetch(origin + "/api/import-experiments", {
      method: "POST",
      body: form,
    });
    assert.equal(imported.status, 200);
    const restored = JSON.parse(await readFile(process.env.DB_PATH, "utf8"));
    assert.deepEqual(restored.trials[0], document);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
