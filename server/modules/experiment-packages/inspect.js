import fs from "node:fs";
import { randomUUID } from "node:crypto";
import { db } from "../../utils/db.js";
import { withDbLock } from "../session-persistence/dbQueue.js";
import {
  assetRelativeDirectory,
  canonicalAssetDirectory,
  assertSafePath,
} from "../experiment-assets/paths.js";
import { assertAssetIdle } from "../experiment-assets/activity.js";
import { readPackage } from "./read.js";
import { validateFunctionalSettings } from "../../utils/functionalSettings.js";
import { digest, packageError, treeFingerprint, writeJson } from "./format.js";

export function importDirectory(id) {
  if (typeof id !== "string" || !/^[a-f0-9-]{36}$/i.test(id))
    throw packageError("IMPORT_NOT_FOUND", 404, "Import preview not found");
  return assertSafePath(`.imports/${id}`);
}
export function readImport(id) {
  const directory = importDirectory(id),
    file = assertSafePath(`.imports/${id}/journal.json`);
  if (!fs.existsSync(file))
    throw packageError("IMPORT_NOT_FOUND", 404, "Import preview not found");
  return { directory, journal: JSON.parse(fs.readFileSync(file, "utf8")) };
}
export function currentFingerprint(data, id) {
  const experiment = data.experiments.find((e) => e.experimentID === id);
  const relative = experiment
    ? assetRelativeDirectory(experiment)
    : canonicalAssetDirectory(id);
  assertAssetIdle(relative);
  return digest(
    JSON.stringify({
      experiment: experiment || null,
      trials: data.trials.find((t) => t.experimentID === id) || null,
      config: data.configs.find((c) => c.experimentID === id) || null,
      sessions: data.sessionResults.filter((s) => s.experimentID === id),
      files: data.participantFiles.filter((f) => f.experimentID === id),
      counter: data.sessionCounters[id],
      receipts: (data.mutationReceipts || []).filter(
        (r) => r.experimentId === id || r.experimentID === id,
      ),
      media: treeFingerprint(relative),
      canonicalMedia:
        relative === canonicalAssetDirectory(id)
          ? null
          : treeFingerprint(canonicalAssetDirectory(id)),
    }),
  );
}
export async function inspectImport(buffer) {
  const parsed = await readPackage(buffer),
    importID = randomUUID(),
    directory = importDirectory(importID);
  try {
    const journal = {
      schemaVersion: 1,
      importID,
      phase: "prepared",
      version: parsed.version,
      kind: parsed.kind,
      expiresAt: Date.now() + 24 * 60 * 60 * 1000,
      entries: [],
    };
    for (const entry of parsed.entries) {
      const files = [];
      for (const file of entry.files) {
        const relative = `.imports/${importID}/entries/${entry.entryId}/${file.logicalPath}`;
        const target = assertSafePath(relative);
        fs.mkdirSync(target.slice(0, target.lastIndexOf("/")), {
          recursive: true,
        });
        fs.writeFileSync(target, file.bytes);
        files.push({
          logicalPath: file.logicalPath,
          sha256: digest(file.bytes),
          size: file.bytes.length,
        });
      }
      journal.entries.push({
        entryId: entry.entryId,
        data: entry.data,
        files,
        warnings: entry.warnings,
      });
    }
    await withDbLock(async () => {
      await db.read();
      for (const entry of journal.entries) {
        const id = entry.data.experiment.experimentID;
        const existing = db.data.experiments.find((e) => e.experimentID === id);
        entry.collision = Boolean(existing);
        entry.existingName = existing?.name;
        entry.fingerprint = currentFingerprint(db.data, id);
      }
      writeJson(`${directory}/journal.json`, journal);
    });
    return preview(journal);
  } catch (error) {
    if (fs.existsSync(directory))
      fs.rmSync(directory, { recursive: true, force: true });
    throw error;
  }
}
export function preview(journal) {
  const settingsState = (entry) => {
    try {
      validateFunctionalSettings(entry.data.config?.functionalSettings);
      return "complete";
    } catch {
      return "needs_review";
    }
  };
  return {
    success: true,
    importID: journal.importID,
    formatVersion: journal.version,
    kind: journal.kind,
    expiresAt: journal.expiresAt,
    modes: journal.kind === "portable" ? ["copy"] : ["copy", "restore"],
    entries: journal.entries.map((entry) => ({
      entryId: entry.entryId,
      experimentID: entry.data.experiment.experimentID,
      name: entry.data.experiment.name,
      collision: entry.collision,
      existingName: entry.existingName,
      warnings: entry.warnings,
      mediaCount: entry.files.length,
      settingsState: settingsState(entry),
    })),
  };
}
