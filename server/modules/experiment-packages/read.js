import JSZip from "jszip";
import {
  digest,
  packageError,
  readZipEntry,
  validateEntryID,
  validateKind,
  validateLogicalPath,
  validateZipPath,
  MAX_ARCHIVE_BYTES,
  MAX_MANIFEST_BYTES,
  MAX_METADATA_BYTES,
} from "./format.js";
import { assertAssetFilename } from "../experiment-assets/paths.js";
import { assertExperimentNavigation } from "../../routes/timeline/branchContract.js";
import { migrateLegacyNavigation } from "../../routes/db/legacy/migrateLegacyNavigation.js";
import { normalizeImportedExperiment } from "../../utils/dynamicConfigModel.js";

function parseJSON(bytes) {
  try {
    return JSON.parse(bytes.toString("utf8"));
  } catch {
    throw packageError(
      "PACKAGE_INVALID",
      400,
      "A package JSON document is invalid",
    );
  }
}
function checkHash(bytes, descriptor) {
  if (descriptor.size !== bytes.length || descriptor.sha256 !== digest(bytes))
    throw packageError(
      "PACKAGE_HASH_MISMATCH",
      400,
      "A package file does not match its declared size or SHA-256",
    );
}
function assertObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw packageError("PACKAGE_INVALID", 400, "Invalid package document");
}
function validateHistory(data, id) {
  for (const field of ["sessionResults", "participantFiles"]) {
    if (data[field] === undefined) continue;
    if (!Array.isArray(data[field]))
      throw packageError("PACKAGE_INVALID", 400, "Invalid historical records");
    for (const record of data[field]) {
      assertObject(record);
      if (record.experimentID !== id)
        throw packageError(
          "PACKAGE_INVALID",
          400,
          "Historical record identity does not match its experiment",
        );
      if (field === "participantFiles") assertAssetFilename(record.filename);
    }
  }
  if (
    data.sessionCounter !== undefined &&
    (!Number.isSafeInteger(data.sessionCounter) || data.sessionCounter < 0)
  )
    throw packageError("PACKAGE_INVALID", 400, "Invalid participant counter");
}
export async function readPackage(buffer) {
  if (buffer.length > MAX_ARCHIVE_BYTES)
    throw packageError(
      "PACKAGE_TOO_LARGE",
      413,
      "The compressed package exceeds the ZIP size limit",
    );
  let zip;
  try {
    zip = await JSZip.loadAsync(buffer);
  } catch {
    throw packageError(
      "PACKAGE_INVALID",
      400,
      "Choose a valid experiment ZIP package",
    );
  }
  const all = Object.values(zip.files);
  if (all.length > 10000)
    throw packageError("PACKAGE_TOO_LARGE", 413, "Too many files in package");
  for (const file of all) validateZipPath(file.unsafeOriginalName || file.name);
  const budget = { used: 0 };
  let manifest,
    version = 1,
    kind = "backup";
  if (zip.file("manifest.json")) {
    manifest = parseJSON(
      await readZipEntry(zip.file("manifest.json"), budget, MAX_MANIFEST_BYTES),
    );
    assertObject(manifest);
    if (manifest.format !== "expbuilder" || manifest.schemaVersion !== 2)
      throw packageError(
        "PACKAGE_VERSION_UNSUPPORTED",
        400,
        "This package version is not supported",
      );
    version = 2;
    kind = validateKind(manifest.kind);
    if (!Array.isArray(manifest.entries))
      throw packageError("PACKAGE_INVALID", 400, "Package entries are missing");
  } else {
    const folders = [...new Set(all.map((file) => file.name.split("/")[0]))];
    manifest = {
      entries: folders
        .filter((folder) => zip.file(`${folder}/data.json`))
        .map((folder, index) => ({
          entryId: `legacy-${index}`,
          path: `${folder}/data.json`,
          folder,
        })),
    };
  }
  if (!manifest.entries.length || manifest.entries.length > 1000)
    throw packageError(
      "PACKAGE_EMPTY",
      400,
      "The package contains no recognized experiments",
    );
  const entries = [],
    identities = new Set(),
    entryIds = new Set();
  for (const descriptor of manifest.entries) {
    assertObject(descriptor);
    validateEntryID(descriptor.entryId);
    validateZipPath(descriptor.path);
    if (entryIds.has(descriptor.entryId))
      throw packageError("PACKAGE_INVALID", 400, "Duplicate package entry");
    entryIds.add(descriptor.entryId);
    if (
      version === 2 &&
      descriptor.path !== `experiments/${descriptor.entryId}/data.json`
    )
      throw packageError(
        "PACKAGE_PATH_INVALID",
        400,
        "Invalid package data path",
      );
    const dataBytes = await readZipEntry(
      zip.file(descriptor.path),
      budget,
      MAX_METADATA_BYTES,
    );
    if (version === 2) checkHash(dataBytes, descriptor);
    let data = parseJSON(dataBytes);
    if (
      !data?.experiment ||
      typeof data.experiment.name !== "string" ||
      !data.experiment.name.trim()
    )
      throw packageError(
        "PACKAGE_INVALID",
        400,
        "An experiment is missing its name",
      );
    const id = data.experiment.experimentID;
    validateEntryID(id);
    validateHistory(data, id);
    if (identities.has(id))
      throw packageError(
        "PACKAGE_INVALID",
        400,
        "Duplicate experiment identity",
      );
    identities.add(id);
    if (version === 2 && descriptor.experimentID !== id)
      throw packageError(
        "PACKAGE_INVALID",
        400,
        "The manifest identity does not match the experiment",
      );
    if (data.trials) {
      if (version === 1 && data.trials.experimentID === undefined)
        data.trials.experimentID = id;
      if (data.trials.experimentID !== id)
        throw packageError(
          "PACKAGE_INVALID",
          400,
          "Trial identity differs from the experiment",
        );
      if (version === 1) data.trials = migrateLegacyNavigation(data.trials);
    }
    data = normalizeImportedExperiment(data);
    if (data.trials) assertExperimentNavigation(data.trials);
    if (
      descriptor.warnings !== undefined &&
      (!Array.isArray(descriptor.warnings) ||
        descriptor.warnings.some((w) => typeof w !== "string"))
    )
      throw packageError("PACKAGE_INVALID", 400, "Invalid package warnings");
    const files = [],
      warnings = [...(descriptor.warnings || [])],
      seen = new Set();
    const add = async (logicalPath, archivePath, declared) => {
      validateLogicalPath(logicalPath, true);
      validateZipPath(archivePath);
      if (seen.has(logicalPath))
        throw packageError("PACKAGE_INVALID", 400, "Duplicate media path");
      seen.add(logicalPath);
      const bytes = await readZipEntry(zip.file(archivePath), budget);
      if (declared) checkHash(bytes, declared);
      files.push({ logicalPath, bytes });
    };
    if (version === 2) {
      for (const [list, participant] of [
        [descriptor.media, false],
        [descriptor.participantFiles, true],
      ]) {
        if (!Array.isArray(list))
          throw packageError(
            "PACKAGE_INVALID",
            400,
            "Package file manifest is incomplete",
          );
        for (const item of list) {
          assertObject(item);
          validateLogicalPath(item.logicalPath, participant);
          const expected = participant
            ? `experiments/${descriptor.entryId}/${item.logicalPath}`
            : `experiments/${descriptor.entryId}/media/${item.logicalPath}`;
          if (item.path !== expected)
            throw packageError(
              "PACKAGE_PATH_INVALID",
              400,
              "Invalid media manifest path",
            );
          if (participant && !item.logicalPath.startsWith("participant-files/"))
            throw packageError(
              "PACKAGE_PATH_INVALID",
              400,
              "Invalid participant file path",
            );
          await add(item.logicalPath, item.path, item);
        }
      }
    } else {
      for (const file of all) {
        if (file.dir || !file.name.startsWith(`${descriptor.folder}/`))
          continue;
        const relative = file.name.slice(descriptor.folder.length + 1),
          parts = relative.split("/");
        if (
          parts.length !== 2 ||
          !["img", "aud", "vid", "others"].includes(parts[0]) ||
          parts[1].startsWith(".")
        )
          continue;
        await add(relative, file.name);
      }
      if (data.sessionResults?.length)
        warnings.push(
          "Legacy backups may contain participant file references without the files themselves.",
        );
    }
    entries.push({ entryId: descriptor.entryId, data, files, warnings });
  }
  return { version, kind, entries };
}
