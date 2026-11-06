import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {
  assetError,
  assertAssetFilename,
  assertAssetID,
  assertSafePath,
  MEDIA_TYPES,
  hasUnsafePathCharacters,
} from "../experiment-assets/paths.js";

export const packageError = (code, status, message) =>
  assetError(code, status, message);
export const digest = (bytes) =>
  createHash("sha256").update(bytes).digest("hex");
export const MAX_PACKAGE_BYTES = 512 * 1024 * 1024;
export const MAX_FILE_BYTES = 256 * 1024 * 1024;
export const MAX_ARCHIVE_BYTES = 256 * 1024 * 1024;
export const MAX_METADATA_BYTES = 32 * 1024 * 1024;
export const MAX_MANIFEST_BYTES = 2 * 1024 * 1024;
export const pick = (object, keys) =>
  Object.fromEntries(
    keys
      .filter((key) => object?.[key] !== undefined)
      .map((key) => [key, structuredClone(object[key])]),
  );
export function validateKind(kind) {
  if (!["portable", "backup"].includes(kind))
    throw packageError(
      "PACKAGE_KIND_INVALID",
      400,
      "Choose portable or backup",
    );
  return kind;
}
export function validateZipPath(value) {
  if (
    typeof value !== "string" ||
    !value ||
    value.startsWith("/") ||
    hasUnsafePathCharacters(value) ||
    value
      .replace(/\/$/, "")
      .split("/")
      .some((p) => !p || p === "." || p === "..")
  )
    throw packageError(
      "PACKAGE_PATH_INVALID",
      400,
      "The package contains an unsafe path",
    );
  return value;
}
export function validateLogicalPath(value, participant = false) {
  validateZipPath(value);
  const parts = value.split("/");
  if (
    parts.length !== 2 ||
    !(
      MEDIA_TYPES.has(parts[0]) ||
      (participant && parts[0] === "participant-files")
    )
  )
    throw packageError(
      "PACKAGE_PATH_INVALID",
      400,
      "Unsupported file path in package",
    );
  assertAssetFilename(parts[1]);
  return value;
}
export function validateEntryID(value) {
  assertAssetID(value);
  return value;
}
export function treeFingerprint(relative) {
  const absolute = assertSafePath(relative);
  if (!fs.existsSync(absolute)) return null;
  const files = [];
  function walk(directory, prefix = "") {
    for (const entry of fs
      .readdirSync(directory, { withFileTypes: true })
      .sort((a, b) => a.name.localeCompare(b.name))) {
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      const full = assertSafePath(`${relative}/${rel}`);
      if (entry.isDirectory()) walk(full, rel);
      else if (entry.isFile()) files.push([rel, digest(fs.readFileSync(full))]);
      else
        throw packageError(
          "ASSET_PATH_UNSAFE",
          409,
          "The media directory contains an unsupported filesystem entry",
        );
    }
  }
  walk(absolute);
  return digest(JSON.stringify(files));
}
export function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = file + ".tmp";
  fs.writeFileSync(temporary, JSON.stringify(value));
  const fd = fs.openSync(temporary, "r");
  try {
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  fs.renameSync(temporary, file);
}
export async function readZipEntry(entry, budget, limit = MAX_FILE_BYTES) {
  if (!entry || entry.dir)
    throw packageError(
      "PACKAGE_INVALID",
      400,
      "A declared package file is missing",
    );
  const declared = entry._data?.uncompressedSize;
  if (
    Number.isFinite(declared) &&
    (declared > limit || budget.used + declared > MAX_PACKAGE_BYTES)
  )
    throw packageError(
      "PACKAGE_TOO_LARGE",
      413,
      "The uncompressed package exceeds the import limit",
    );
  return new Promise((resolve, reject) => {
    let size = 0,
      done = false;
    const chunks = [];
    const stream = entry.internalStream("nodebuffer");
    const fail = (error) => {
      if (done) return;
      done = true;
      stream.pause();
      reject(error);
    };
    stream
      .on("data", (bytes) => {
        if (done) return;
        size += bytes.length;
        budget.used += bytes.length;
        if (size > limit || budget.used > MAX_PACKAGE_BYTES)
          return fail(
            packageError(
              "PACKAGE_TOO_LARGE",
              413,
              "The uncompressed package exceeds the import limit",
            ),
          );
        chunks.push(bytes);
      })
      .on("error", (error) =>
        fail(
          packageError(
            "PACKAGE_INVALID",
            400,
            "Could not decompress package: " + error.message,
          ),
        ),
      )
      .on("end", () => {
        if (!done) {
          done = true;
          resolve(Buffer.concat(chunks));
        }
      })
      .resume();
  });
}
