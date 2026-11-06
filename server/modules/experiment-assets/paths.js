import fs from "node:fs";
import path from "node:path";
import { db, ensureDbData, userDataRoot } from "../../utils/db.js";
import { withDbLock } from "../session-persistence/dbQueue.js";

export const MEDIA_TYPES = new Set(["img", "aud", "vid", "others"]);
const reserved = new Set([
  "database",
  "plugins",
  "experiments",
  "experiments_html",
  "trials_previews_html",
  "_tmp_uploads",
  "node_modules",
  "jspsych-bundle",
  "jspsych-bundler",
  "dynamicplugin",
  "icon",
  "templates",
  "routes",
  "modules",
  "utils",
  "runtime",
  "server",
  ".imports",
]);
export const assetError = (code, status, message) =>
  Object.assign(new Error(message), { code, status });
export const hasUnsafePathCharacters = (value) =>
  /[\\:]/.test(value) ||
  Array.from(value).some((character) => character.charCodeAt(0) < 32);
export function assertAssetID(id) {
  if (
    typeof id !== "string" ||
    !id ||
    id !== id.trim() ||
    Buffer.byteLength(id) > 200 ||
    id.includes("/") ||
    hasUnsafePathCharacters(id) ||
    id === "." ||
    id === ".." ||
    ["__proto__", "constructor", "prototype"].includes(id)
  )
    throw assetError(
      "INVALID_EXPERIMENT_ID",
      400,
      "Invalid experiment identity",
    );
}
export function canonicalAssetDirectory(id) {
  assertAssetID(id);
  return `experiments/${id}/media`;
}
export function assertSafePath(relative) {
  const parts = relative.split("/");
  if (
    !relative ||
    path.isAbsolute(relative) ||
    hasUnsafePathCharacters(relative) ||
    parts.some((p) => !p || p === "." || p === "..")
  )
    throw assetError(
      "ASSET_PATH_INVALID",
      409,
      "Invalid media directory association",
    );
  let current = path.resolve(userDataRoot);
  for (const part of parts) {
    current = path.join(current, part);
    if (
      fs.existsSync(current) ||
      (() => {
        try {
          return fs.lstatSync(current).isSymbolicLink();
        } catch {
          return false;
        }
      })()
    ) {
      if (fs.lstatSync(current).isSymbolicLink())
        throw assetError(
          "ASSET_PATH_UNSAFE",
          409,
          "Media paths cannot contain symbolic links",
        );
    }
  }
  return current;
}
export function assetRelativeDirectory(experiment) {
  assertAssetID(experiment.experimentID);
  const relative =
    experiment.assetDirectory ?? experiment.name ?? experiment.experimentID;
  const canonical = canonicalAssetDirectory(experiment.experimentID);
  if (
    typeof relative !== "string" ||
    (relative !== canonical &&
      (relative.includes("/") || reserved.has(relative.toLowerCase())))
  )
    throw assetError(
      "ASSET_PATH_INVALID",
      409,
      "The legacy media association needs review",
    );
  assertSafePath(relative);
  experiment.assetDirectory = relative;
  return relative;
}
export function assetDirectoryFor(experiment) {
  return assertSafePath(assetRelativeDirectory(experiment));
}
export function assertMediaType(type, allowAll = false) {
  if (!MEDIA_TYPES.has(type) && !(allowAll && type === "all"))
    throw assetError("INVALID_MEDIA_TYPE", 400, "Invalid media type");
}
export function assertAssetFilename(name) {
  if (
    typeof name !== "string" ||
    !name ||
    name.startsWith(".") ||
    name.includes("/") ||
    hasUnsafePathCharacters(name) ||
    Buffer.byteLength(name) > 255
  )
    throw assetError("INVALID_MEDIA_FILENAME", 400, "Invalid media filename");
}
export function assetFilePath(experiment, type, filename) {
  if (type !== "participant-files") assertMediaType(type);
  if (filename !== undefined) assertAssetFilename(filename);
  return assertSafePath(
    [
      assetRelativeDirectory(experiment),
      type,
      ...(filename === undefined ? [] : [filename]),
    ].join("/"),
  );
}
export function isAssetDirectoryShared(data, experiment) {
  const relative = assetRelativeDirectory(experiment);
  const physicalDirectory = (directory) => {
    try {
      const stat = fs.statSync(assertSafePath(directory));
      return stat.isDirectory() ? `${stat.dev}:${stat.ino}` : null;
    } catch {
      return null;
    }
  };
  const identity = physicalDirectory(relative);
  return data.experiments.some(
    (other) =>
      other.experimentID !== experiment.experimentID &&
      ((other.assetDirectory ?? other.name ?? other.experimentID) ===
        relative ||
        (identity !== null &&
          physicalDirectory(
            other.assetDirectory ?? other.name ?? other.experimentID,
          ) === identity)),
  );
}
export function bindExistingAssetDirectories(data) {
  for (const experiment of data.experiments) {
    try {
      assetRelativeDirectory(experiment);
    } catch {
      /* Unsafe legacy associations require explicit review when accessed. */
    }
  }
}
export async function getExperimentAssetDirectory(id, { write = false } = {}) {
  return withDbLock(async () => {
    await db.read();
    ensureDbData();
    const experiment = db.data.experiments.find((e) => e.experimentID === id);
    if (!experiment)
      throw assetError("EXPERIMENT_NOT_FOUND", 404, "Experiment not found");
    const previous = experiment.assetDirectory;
    const relative = assetRelativeDirectory(experiment);
    if (write && isAssetDirectoryShared(db.data, experiment))
      throw assetError(
        "ASSET_DIRECTORY_SHARED",
        409,
        "These legacy media files are shared. Import an independent copy before editing them.",
      );
    if (previous !== relative) await db.write();
    return relative;
  });
}
