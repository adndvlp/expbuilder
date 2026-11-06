import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import JSZip from "jszip";
import { jest } from "@jest/globals";

let db, directory, inspectImport, applyImport, recoverPendingImports;
const oldRoot = process.env.DB_ROOT,
  oldPath = process.env.DB_PATH;
beforeEach(async () => {
  directory = fs.mkdtempSync(path.join(os.tmpdir(), "import-recovery-m03-"));
  process.env.DB_ROOT = directory;
  delete process.env.DB_PATH;
  jest.resetModules();
  const mod = await import("../../utils/db.js");
  db = mod.db;
  db.data = {};
  mod.ensureDbData();
  db.data.experiments.push({
    experimentID: "origin",
    name: "Before",
    assetDirectory: "experiments/origin/media",
  });
  await db.write();
  fs.mkdirSync(path.join(directory, "experiments/origin/media/img"), {
    recursive: true,
  });
  fs.writeFileSync(
    path.join(directory, "experiments/origin/media/img/x.png"),
    "before",
  );
  ({ inspectImport } = await import(
    "../../modules/experiment-packages/inspect.js"
  ));
  ({ applyImport, recoverPendingImports } = await import(
    "../../modules/experiment-packages/apply.js"
  ));
});
afterEach(() => {
  if (oldRoot === undefined) delete process.env.DB_ROOT;
  else process.env.DB_ROOT = oldRoot;
  if (oldPath === undefined) delete process.env.DB_PATH;
  else process.env.DB_PATH = oldPath;
  fs.rmSync(directory, { recursive: true, force: true });
});
async function plan() {
  const zip = new JSZip();
  zip.file(
    "Backup/data.json",
    JSON.stringify({
      experiment: { experimentID: "origin", name: "After" },
      sessionResults: [],
    }),
  );
  zip.file("Backup/img/x.png", "after");
  return inspectImport(await zip.generateAsync({ type: "nodebuffer" }));
}
for (const committed of [false, true])
  test(`restart ${committed ? "finishes a committed import" : "rolls back an import interrupted before the database commit"}`, async () => {
    const preview = await plan();
    const dbUrl = new URL("../../utils/db.js", import.meta.url).href,
      applyUrl = new URL(
        "../../modules/experiment-packages/apply.js",
        import.meta.url,
      ).href;
    const script = `const {db}=await import(${JSON.stringify(dbUrl)}); const original=db.write.bind(db); db.write=async()=>{${committed ? "await original();" : ""}process.exit(86);}; const {applyImport}=await import(${JSON.stringify(applyUrl)});await applyImport(${JSON.stringify(preview.importID)},{mode:'restore',replaceExisting:true});`;
    const env = { ...process.env, DB_ROOT: directory };
    delete env.DB_PATH;
    const child = spawnSync(
      process.execPath,
      ["--input-type=module", "-e", script],
      { env, encoding: "utf8", timeout: 30000 },
    );
    expect(child.error).toBeUndefined();
    expect(child.status).toBe(86);
    expect(
      fs.readFileSync(
        path.join(directory, "experiments/origin/media/img/x.png"),
        "utf8",
      ),
    ).toBe("after");
    await recoverPendingImports();
    await db.read();
    expect(db.data.experiments[0].name).toBe(committed ? "After" : "Before");
    expect(
      fs.readFileSync(
        path.join(directory, "experiments/origin/media/img/x.png"),
        "utf8",
      ),
    ).toBe(committed ? "after" : "before");
    const journal = JSON.parse(
      fs.readFileSync(
        path.join(directory, ".imports", preview.importID, "journal.json"),
        "utf8",
      ),
    );
    expect(journal.phase).toBe(committed ? "complete" : "rolled_back");
    if (committed) {
      expect(
        (
          await applyImport(preview.importID, {
            mode: "restore",
            replaceExisting: true,
          })
        ).imported,
      ).toBe(1);
      expect(db.data.experiments).toHaveLength(1);
    }
  });
test("a path-traversal archive is rejected before staging or database mutation", async () => {
  const zip = new JSZip();
  zip.file(
    "Safe/data.json",
    JSON.stringify({ experiment: { experimentID: "other", name: "Other" } }),
  );
  zip.file("Safe/../../escape.txt", "escape");
  await expect(
    inspectImport(await zip.generateAsync({ type: "nodebuffer" })),
  ).rejects.toMatchObject({ code: "PACKAGE_PATH_INVALID", status: 400 });
  await db.read();
  expect(db.data.experiments).toHaveLength(1);
  expect(fs.existsSync(path.join(directory, "escape.txt"))).toBe(false);
});
test("cancelling an inspection removes its staging without modifying any experiment", async () => {
  const preview = await plan();
  const { cancelImport } = await import(
    "../../modules/experiment-packages/apply.js"
  );
  await cancelImport(preview.importID);
  expect(
    fs.existsSync(path.join(directory, ".imports", preview.importID)),
  ).toBe(false);
  await db.read();
  expect(db.data.experiments[0].name).toBe("Before");
});
test("startup removes expired inspections and abandoned staging while preserving experiments", async () => {
  const preview = await plan();
  const journalFile = path.join(
    directory,
    ".imports",
    preview.importID,
    "journal.json",
  );
  const journal = JSON.parse(fs.readFileSync(journalFile, "utf8"));
  journal.expiresAt = Date.now() - 1;
  fs.writeFileSync(journalFile, JSON.stringify(journal));
  const abandoned = path.join(
    directory,
    ".imports",
    "00000000-0000-0000-0000-000000000000",
  );
  fs.mkdirSync(abandoned);
  const old = new Date(Date.now() - 48 * 60 * 60 * 1000);
  fs.utimesSync(abandoned, old, old);
  await recoverPendingImports();
  expect(fs.existsSync(path.dirname(journalFile))).toBe(false);
  expect(fs.existsSync(abandoned)).toBe(false);
  await db.read();
  expect(db.data.experiments[0].name).toBe("Before");
});
