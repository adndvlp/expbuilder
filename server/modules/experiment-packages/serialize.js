import fs from "node:fs";
import { randomUUID } from "node:crypto";
import JSZip from "jszip";
import { db } from "../../utils/db.js";
import {
  assetDirectoryFor,
  assetFilePath,
  MEDIA_TYPES,
} from "../experiment-assets/paths.js";
import { assertAssetIdle } from "../experiment-assets/activity.js";
import {
  digest,
  pick,
  validateKind,
  packageError,
  MAX_FILE_BYTES,
  MAX_PACKAGE_BYTES,
  MAX_ARCHIVE_BYTES,
  MAX_METADATA_BYTES,
  MAX_MANIFEST_BYTES,
} from "./format.js";

export const experimentFields = [
  "experimentID",
  "name",
  "description",
  "author",
  "credits",
  "createdAt",
  "updatedAt",
  "appearanceSettings",
];
export const configFields = [
  "experimentID",
  "isDevMode",
  "isSaveMode",
  "functionalSettings",
  "settingsMigration",
  "sessionNameConfig",
  "createdAt",
  "updatedAt",
  "deploymentReview",
];
export const codeFields = [
  "generatedCode",
  "customCode",
  "customInitJsPsychParams",
  "customPreInitCode",
];
export const trialFields = [
  "experimentID",
  "entryItemId",
  "trials",
  "loops",
  "timeline",
];
export function associationHints(experiment) {
  const primitiveFields = (object, fields) =>
    Object.fromEntries(
      fields
        .filter((field) =>
          ["string", "number"].includes(typeof object?.[field]),
        )
        .map((field) => [field, object[field]]),
    );
  const hints = primitiveFields(experiment, ["storage", "pagesUrl"]);
  const fields = {
    cloudBinding: [
      "projectId",
      "experimentID",
      "verifiedOwnerUid",
      "verifiedAt",
    ],
    storageBinding: ["provider", "accountId", "folderId", "rootFolderId"],
    githubBinding: [
      "repositoryId",
      "accountId",
      "ownerLogin",
      "repoName",
      "branch",
    ],
  };
  for (const [field, keys] of Object.entries(fields)) {
    const binding = primitiveFields(experiment?.[field], keys);
    if (Object.keys(binding).length) hints[field] = binding;
  }
  return hints;
}
export function serializeDesign(data, experiment, kind) {
  const id = experiment.experimentID;
  const original = data.configs.find((c) => c.experimentID === id);
  const config = original
    ? { ...pick(original, configFields), data: pick(original.data, codeFields) }
    : null;
  if (config && !config.isDevMode) config.data.generatedCode = "";
  const trials = data.trials.find((t) => t.experimentID === id);
  const value = {
    experiment: pick(experiment, experimentFields),
    trials: trials ? pick(trials, trialFields) : null,
    config,
  };
  if (kind === "backup") {
    value.sessionResults = structuredClone(
      data.sessionResults.filter((s) => s.experimentID === id),
    );
    value.sessionCounter = data.sessionCounters?.[id] ?? 0;
    value.participantFiles = structuredClone(
      data.participantFiles.filter((f) => f.experimentID === id),
    );
    value.remoteHints = associationHints(experiment);
  }
  return value;
}
export async function buildPackage(experiments, { kind = "backup" } = {}) {
  validateKind(kind);
  if (experiments.length > 1000)
    throw packageError(
      "PACKAGE_TOO_LARGE",
      413,
      "Too many experiments in one package",
    );
  let totalBytes = 0;
  const checkSize = (size, limit = MAX_FILE_BYTES) => {
    if (size > limit || totalBytes + size > MAX_PACKAGE_BYTES)
      throw packageError(
        "PACKAGE_TOO_LARGE",
        413,
        "The package exceeds the supported ZIP size limits",
      );
  };
  const charge = (bytes, limit) => {
    checkSize(bytes.length, limit);
    totalBytes += bytes.length;
  };
  const readFile = (file) => {
    checkSize(fs.statSync(file).size);
    return fs.readFileSync(file);
  };
  const zip = new JSZip();
  const manifest = {
    format: "expbuilder",
    schemaVersion: 2,
    kind,
    exportedAt: new Date().toISOString(),
    appVersion: JSON.parse(
      fs.readFileSync(
        new URL("../../../package.json", import.meta.url),
        "utf8",
      ),
    ).version,
    entries: [],
  };
  const used = new Set();
  for (const experiment of experiments) {
    const id = experiment.experimentID;
    if (used.has(id)) throw new Error("Duplicate experiment identity");
    used.add(id);
    const entryId = id || randomUUID();
    assetDirectoryFor(experiment);
    assertAssetIdle(experiment.assetDirectory);
    const value = serializeDesign(db.data, experiment, kind);
    const entry = {
      entryId,
      experimentID: id,
      path: `experiments/${entryId}/data.json`,
      media: [],
      participantFiles: [],
      warnings: [],
    };
    const addFile = (logicalPath, bytes, participant = false) => {
      charge(bytes, MAX_FILE_BYTES);
      const type = participant ? "participantFiles" : "media";
      const archivePath = participant
        ? `experiments/${entryId}/${logicalPath}`
        : `experiments/${entryId}/media/${logicalPath}`;
      zip.file(archivePath, bytes);
      entry[type].push({
        logicalPath,
        path: archivePath,
        size: bytes.length,
        sha256: digest(bytes),
      });
    };
    for (const type of MEDIA_TYPES) {
      const folder = assetFilePath(experiment, type);
      if (!fs.existsSync(folder)) continue;
      for (const name of fs.readdirSync(folder).sort()) {
        if (name.startsWith(".")) continue;
        const file = assetFilePath(experiment, type, name);
        if (fs.statSync(file).isFile())
          addFile(`${type}/${name}`, readFile(file));
      }
    }
    if (kind === "backup")
      for (const record of value.participantFiles) {
        const file = assetFilePath(
          experiment,
          "participant-files",
          record.filename,
        );
        if (fs.existsSync(file))
          addFile(`participant-files/${record.filename}`, readFile(file), true);
        else
          entry.warnings.push(
            "Participant file unavailable: " + record.filename,
          );
      }
    const bytes = Buffer.from(JSON.stringify(value));
    charge(bytes, MAX_METADATA_BYTES);
    zip.file(entry.path, bytes);
    entry.size = bytes.length;
    entry.sha256 = digest(bytes);
    manifest.entries.push(entry);
  }
  const manifestBytes = Buffer.from(JSON.stringify(manifest, null, 2));
  charge(manifestBytes, MAX_MANIFEST_BYTES);
  zip.file("manifest.json", manifestBytes);
  if (Object.keys(zip.files).length > 10000)
    throw packageError("PACKAGE_TOO_LARGE", 413, "Too many files in package");
  // Persist one-time legacy bindings together before returning an export.
  await db.write();
  const buffer = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
  });
  if (buffer.length > MAX_ARCHIVE_BYTES)
    throw packageError(
      "PACKAGE_TOO_LARGE",
      413,
      "The compressed package exceeds the ZIP size limit",
    );
  return buffer;
}
