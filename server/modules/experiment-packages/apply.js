import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { db } from "../../utils/db.js";
import { withDbLock } from "../session-persistence/dbQueue.js";
import {
  canonicalAssetDirectory,
  assertSafePath,
} from "../experiment-assets/paths.js";
import { assertAssetIdle } from "../experiment-assets/activity.js";
import { digest, packageError, treeFingerprint, writeJson } from "./format.js";
import { currentFingerprint, importDirectory, readImport } from "./inspect.js";
import { materializeEntry } from "./identity.js";

const journalFile = (id) => assertSafePath(`.imports/${id}/journal.json`);
function saveJournal(journal) {
  writeJson(journalFile(journal.importID), journal);
}
function receiptMatches(record, id) {
  if (record.experimentId !== undefined || record.experimentID !== undefined)
    return (record.experimentId ?? record.experimentID) === id;
  try {
    return JSON.parse(record.payload || "{}").experimentId === id;
  } catch {
    return false;
  }
}
function replaceRecord(collection, id, value) {
  const next = collection.filter((record) => record.experimentID !== id);
  if (value) next.push(value);
  return next;
}
function installMetadata(data, record) {
  const id = record.experiment.experimentID;
  data.experiments = replaceRecord(data.experiments, id, record.experiment);
  data.trials = replaceRecord(data.trials, id, record.trials);
  data.configs = replaceRecord(data.configs, id, record.config);
  data.sessionResults = data.sessionResults
    .filter((s) => s.experimentID !== id)
    .concat(record.sessionResults);
  data.participantFiles = data.participantFiles
    .filter((s) => s.experimentID !== id)
    .concat(record.participantFiles);
  data.sessionCounters[id] = record.sessionCounter;
  data.mutationReceipts = (data.mutationReceipts || []).filter(
    (record) => !receiptMatches(record, id),
  );
}
function cleanupCommitted(journal) {
  for (const name of ["rollback", "incoming", "entries"]) {
    const dir = assertSafePath(`.imports/${journal.importID}/${name}`);
    if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
  }
  const complete = {
    schemaVersion: 1,
    importID: journal.importID,
    phase: "complete",
    completedAt: new Date().toISOString(),
    result: journal.result,
  };
  saveJournal(complete);
}
export function rollbackFiles(journal) {
  for (const operation of [...(journal.operations || [])].reverse()) {
    const id = operation.target?.split("/")[1];
    if (
      operation.target !== canonicalAssetDirectory(id) ||
      operation.backup !== `.imports/${journal.importID}/rollback/${id}` ||
      operation.incoming !== `.imports/${journal.importID}/incoming/${id}`
    )
      throw packageError(
        "IMPORT_RECOVERY_REQUIRED",
        503,
        "Unsafe import recovery paths",
      );
    const target = assertSafePath(operation.target),
      backup = assertSafePath(operation.backup);
    const targetHash = treeFingerprint(operation.target);
    if (operation.priorExists) {
      if (fs.existsSync(backup)) {
        if (treeFingerprint(operation.backup) !== operation.priorHash)
          throw packageError(
            "IMPORT_RECOVERY_REQUIRED",
            503,
            "The import rollback backup changed. Preserve it for recovery.",
          );
        if (targetHash !== null && targetHash !== operation.incomingHash)
          throw packageError(
            "IMPORT_RECOVERY_REQUIRED",
            503,
            "The import destination changed unexpectedly. Recovery requires review.",
          );
        if (fs.existsSync(target))
          fs.rmSync(target, { recursive: true, force: true });
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.renameSync(backup, target);
      } else if (targetHash !== operation.priorHash)
        throw packageError(
          "IMPORT_RECOVERY_REQUIRED",
          503,
          "The previous media directory could not be restored.",
        );
    } else if (targetHash !== null) {
      if (targetHash !== operation.incomingHash)
        throw packageError(
          "IMPORT_RECOVERY_REQUIRED",
          503,
          "Unexpected files appeared in the import destination.",
        );
      fs.rmSync(target, { recursive: true, force: true });
    }
  }
  journal.phase = "rolled_back";
  saveJournal(journal);
}
export async function recoverPendingImports() {
  return withDbLock(async () => {
    await db.read();
    const root = assertSafePath(".imports");
    if (!fs.existsSync(root)) return;
    for (const name of fs.readdirSync(root)) {
      if (!/^[a-f0-9-]{36}$/i.test(name)) continue;
      const file = assertSafePath(`.imports/${name}/journal.json`);
      if (!fs.existsSync(file)) {
        const directory = importDirectory(name),
          stat = fs.statSync(directory);
        if (
          stat.isDirectory() &&
          stat.mtimeMs < Date.now() - 24 * 60 * 60 * 1000
        )
          fs.rmSync(directory, { recursive: true, force: true });
        continue;
      }
      const { journal } = readImport(name);
      if (journal.importID !== name || journal.schemaVersion !== 1)
        throw packageError(
          "IMPORT_RECOVERY_REQUIRED",
          503,
          "Invalid import recovery record",
        );
      if (journal.phase === "applying") {
        if (db.data.importCommits?.[name]) cleanupCommitted(journal);
        else rollbackFiles(journal);
      } else if (
        ["prepared", "rolled_back"].includes(journal.phase) &&
        journal.expiresAt < Date.now()
      )
        fs.rmSync(importDirectory(name), { recursive: true, force: true });
    }
  });
}
export async function applyImport(
  importID,
  { mode, replaceExisting = false } = {},
) {
  return withDbLock(async () => {
    importDirectory(importID);
    await db.read();
    if (db.data.importCommits?.[importID]) {
      const result = db.data.importCommits[importID].result;
      if (mode !== result.mode)
        throw packageError(
          "IMPORT_ALREADY_APPLIED",
          409,
          "This import was already applied with a different mode",
        );
      try {
        const { journal } = readImport(importID);
        if (journal.phase === "applying") cleanupCommitted(journal);
      } catch {
        /* The durable receipt remains authoritative; startup can finish cleanup. */
      }
      return result;
    }
    const { journal } = readImport(importID);
    if (!["copy", "restore"].includes(mode))
      throw packageError(
        "IMPORT_MODE_REQUIRED",
        400,
        "Choose copy or restore explicitly",
      );
    if (mode === "restore" && journal.kind === "portable")
      throw packageError(
        "IMPORT_RESTORE_UNAVAILABLE",
        400,
        "Portable packages can only create independent copies",
      );
    if (journal.phase === "applying") {
      await recoverPendingImports();
      throw packageError(
        "IMPORT_RECOVERED",
        409,
        "The interrupted import was recovered. Inspect the package again.",
      );
    }
    if (journal.phase !== "prepared" || journal.expiresAt < Date.now())
      throw packageError(
        "IMPORT_PREVIEW_EXPIRED",
        410,
        "Inspect the package again before importing",
      );
    if (mode === "restore")
      for (const entry of journal.entries) {
        const id = entry.data.experiment.experimentID;
        if (currentFingerprint(db.data, id) !== entry.fingerprint)
          throw packageError(
            "IMPORT_PREVIEW_STALE",
            409,
            "The local experiment changed after inspection. Inspect the package again.",
          );
        if (entry.collision && replaceExisting !== true)
          throw packageError(
            "IMPORT_REPLACEMENT_REQUIRED",
            409,
            "Confirm replacement of existing local experiments before restoring",
          );
      }
    const next = structuredClone(db.data),
      operations = [],
      idMap = {},
      entryMap = {};
    try {
      for (const entry of journal.entries) {
        const sourceID = entry.data.experiment.experimentID;
        let id = mode === "copy" ? randomUUID() : sourceID;
        for (
          let tries = 0;
          mode === "copy" &&
          (next.experiments.some((e) => e.experimentID === id) ||
            fs.existsSync(assertSafePath(canonicalAssetDirectory(id))));
          tries++
        ) {
          if (tries > 5)
            throw packageError(
              "IMPORT_ID_COLLISION",
              409,
              "Could not allocate an independent experiment identity",
            );
          id = randomUUID();
        }
        const target = canonicalAssetDirectory(id),
          incoming = `.imports/${importID}/incoming/${id}`,
          backup = `.imports/${importID}/rollback/${id}`;
        assertAssetIdle(target);
        if (
          mode === "restore" &&
          fs.existsSync(assertSafePath(target)) &&
          !next.experiments.some(
            (e) => e.experimentID === id && e.assetDirectory === target,
          )
        )
          throw packageError(
            "ASSET_DIRECTORY_COLLISION",
            409,
            "The restore destination already contains unassociated files",
          );
        const staged = assertSafePath(incoming);
        fs.mkdirSync(staged, { recursive: true });
        for (const file of entry.files) {
          if (
            mode === "copy" &&
            file.logicalPath.startsWith("participant-files/")
          )
            continue;
          const source = assertSafePath(
              `.imports/${importID}/entries/${entry.entryId}/${file.logicalPath}`,
            ),
            bytes = fs.readFileSync(source);
          if (bytes.length !== file.size || digest(bytes) !== file.sha256)
            throw packageError(
              "PACKAGE_HASH_MISMATCH",
              400,
              "The inspected package changed before applying",
            );
          const destination = assertSafePath(`${incoming}/${file.logicalPath}`);
          fs.mkdirSync(path.dirname(destination), { recursive: true });
          fs.writeFileSync(destination, bytes);
        }
        const previousConfig = next.configs.find((c) => c.experimentID === id);
        const record = materializeEntry(entry, mode, id, previousConfig);
        installMetadata(next, record);
        operations.push({
          target,
          incoming,
          backup,
          priorExists: fs.existsSync(assertSafePath(target)),
          priorHash: treeFingerprint(target),
          incomingHash: treeFingerprint(incoming),
        });
        idMap[sourceID] = id;
        entryMap[entry.entryId] = id;
      }
      const result = {
        success: true,
        imported: journal.entries.length,
        mode,
        idMap,
        entryMap,
        warnings: journal.entries.flatMap((e) => e.warnings),
      };
      journal.operations = operations;
      journal.phase = "applying";
      journal.mode = mode;
      journal.result = result;
      saveJournal(journal);
      for (const operation of operations) {
        const target = assertSafePath(operation.target),
          incoming = assertSafePath(operation.incoming),
          backup = assertSafePath(operation.backup);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        if (operation.priorExists) {
          fs.mkdirSync(path.dirname(backup), { recursive: true });
          fs.renameSync(target, backup);
        }
        fs.renameSync(incoming, target);
      }
      next.importCommits ||= {};
      next.importCommits[importID] = {
        committedAt: new Date().toISOString(),
        result,
      };
      db.data = next;
      try {
        await db.write();
      } catch (error) {
        await db.read();
        if (!db.data.importCommits?.[importID]) throw error;
      }
      // A durable database receipt disambiguates a crash after the atomic database write.
      try {
        cleanupCommitted(journal);
      } catch {
        /* Startup or an idempotent retry can finish cleanup. */
      }
      return result;
    } catch (error) {
      await db.read();
      if (db.data.importCommits?.[importID])
        return db.data.importCommits[importID].result;
      if (journal.phase !== "applying") {
        const incoming = assertSafePath(`.imports/${importID}/incoming`);
        if (fs.existsSync(incoming))
          fs.rmSync(incoming, { recursive: true, force: true });
      }
      if (journal.phase === "applying") {
        rollbackFiles(journal);
        throw Object.assign(
          packageError(
            "IMPORT_ROLLED_BACK",
            error.status || 500,
            "Local changes were rolled back. Inspect the package again before retrying.",
          ),
          { cause: error },
        );
      }
      throw error;
    }
  });
}
export async function cancelImport(importID) {
  return withDbLock(async () => {
    const { directory, journal } = readImport(importID);
    if (journal.phase === "applying")
      throw packageError(
        "IMPORT_RECOVERY_REQUIRED",
        409,
        "Recover the interrupted import before removing its files",
      );
    fs.rmSync(directory, { recursive: true, force: true });
    return { success: true };
  });
}
