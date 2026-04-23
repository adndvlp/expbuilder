import path from "path";
import fs from "fs";
import os from "os";
import { jest } from "@jest/globals";

describe("ensureDbData", () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "expbuilder-db-"));
    process.env.DB_ROOT = tmpDir;
    delete process.env.DB_PATH;
    jest.resetModules();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    delete process.env.DB_ROOT;
  });

  test("initializes required array fields when missing", async () => {
    const mod = await import("../../utils/db.js");
    mod.db.data = {};
    mod.ensureDbData();
    expect(mod.db.data.experiments).toEqual([]);
    expect(mod.db.data.trials).toEqual([]);
    expect(mod.db.data.configs).toEqual([]);
    expect(mod.db.data.pluginConfigs).toEqual([]);
    expect(mod.db.data.sessionResults).toEqual([]);
    expect(mod.db.data.participantFiles).toEqual([]);
  });

  test("preserves existing fields (idempotent)", async () => {
    const mod = await import("../../utils/db.js");
    mod.db.data = {
      experiments: [{ id: "E1" }],
      trials: [{ id: 1 }],
    };
    mod.ensureDbData();
    expect(mod.db.data.experiments).toHaveLength(1);
    expect(mod.db.data.trials).toHaveLength(1);
    expect(mod.db.data.configs).toEqual([]);
  });

  test("creates DB directory under DB_ROOT on import", async () => {
    await import("../../utils/db.js");
    const expected = path.join(tmpDir, "database");
    expect(fs.existsSync(expected)).toBe(true);
  });
});
