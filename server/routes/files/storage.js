import { randomUUID } from "crypto";
import fs from "fs";
import path from "path";
import { db, userDataRoot } from "../../utils/db.js";
import { compressFile } from "./compression.js";

export const GITHUB_FILE_LIMIT_BYTES =
  Number(process.env.GITHUB_FILE_LIMIT_BYTES) || 100 * 1024 * 1024;

const mediaExtensionPatterns = {
  img: /\.(png|jpg|jpeg|gif|svg|webp|bmp)$/i,
  aud: /\.(mp3|wav|ogg|m4a|flac|aac)$/i,
  vid: /\.(mp4|webm|mov|avi|mkv)$/i,
};

export function getMediaType(filename) {
  const ext = path.extname(filename).toLowerCase();
  if (mediaExtensionPatterns.img.test(ext)) return "img";
  if (mediaExtensionPatterns.aud.test(ext)) return "aud";
  if (mediaExtensionPatterns.vid.test(ext)) return "vid";
  return "others";
}

export async function getExperimentName(experimentID) {
  let experimentName = experimentID;
  await db.read();
  const experiment = db.data.experiments.find(
    (e) => e.experimentID === experimentID,
  );
  if (experiment && experiment.name) {
    experimentName = experiment.name;
  }
  return experimentName;
}

function getCompressedFilename(originalName, type) {
  const extensionByType = {
    img: ".webp",
    aud: ".ogg",
    vid: ".webm",
  };
  const parsed = path.parse(path.basename(originalName));
  return `${parsed.name}${extensionByType[type]}`;
}

function getUniqueFilename(folder, filename) {
  const parsed = path.parse(filename);
  let candidate = filename;
  let suffix = 1;

  while (fs.existsSync(path.join(folder, candidate))) {
    candidate = `${parsed.name}-${suffix}${parsed.ext}`;
    suffix += 1;
  }

  return candidate;
}

/* istanbul ignore next -- EXDEV fallback depends on cross-device filesystem behavior. */
function moveFile(source, destination) {
  try {
    fs.renameSync(source, destination);
  } catch (err) {
    if (err.code !== "EXDEV") throw err;
    fs.copyFileSync(source, destination);
    fs.unlinkSync(source);
  }
}

function removeFileIfExists(filePath) {
  if (filePath && fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

export function isVisibleUploadedFile(filename) {
  return filename !== ".DS_Store" && !filename.startsWith(".upload-");
}

export function createStoragePlan(file, experimentName, shouldCompress) {
  const originalName = path.basename(file.originalname);
  const originalSizeBytes = file.size;
  const originalType = getMediaType(originalName);
  const compressible = ["img", "aud", "vid"].includes(originalType);
  const compress =
    shouldCompress &&
    compressible &&
    originalSizeBytes > GITHUB_FILE_LIMIT_BYTES;
  const type = originalType;
  const folder = path.join(userDataRoot, experimentName, type);
  fs.mkdirSync(folder, { recursive: true });

  const storedName = getUniqueFilename(
    folder,
    compress ? getCompressedFilename(originalName, type) : originalName,
  );
  const destination = path.join(folder, storedName);

  return {
    originalName,
    originalSizeBytes,
    type,
    compress,
    folder,
    storedName,
    destination,
  };
}

export async function storeUploadedFile(
  file,
  experimentName,
  shouldCompress,
  plan,
  onProgress,
) {
  /* istanbul ignore next -- current route callers precompute a storage plan before storing files. */
  const storagePlan =
    plan || createStoragePlan(file, experimentName, shouldCompress);
  let finalStoredName = storagePlan.storedName;
  let finalDestination = storagePlan.destination;
  let tempDestination = null;

  try {
    if (storagePlan.compress) {
      tempDestination = path.join(
        storagePlan.folder,
        `.upload-${randomUUID()}${path.extname(storagePlan.storedName)}`,
      );
      await compressFile(
        file.path,
        tempDestination,
        storagePlan.type,
        onProgress,
      );
      finalStoredName = getUniqueFilename(
        storagePlan.folder,
        storagePlan.storedName,
      );
      finalDestination = path.join(storagePlan.folder, finalStoredName);
      moveFile(tempDestination, finalDestination);
      removeFileIfExists(file.path);
    } else {
      moveFile(file.path, finalDestination);
    }
  } catch (err) {
    removeFileIfExists(file.path);
    removeFileIfExists(tempDestination);
    removeFileIfExists(finalDestination);
    throw err;
  }

  const storedSizeBytes = fs.statSync(finalDestination).size;
  return {
    originalName: storagePlan.originalName,
    storedName: finalStoredName,
    name: finalStoredName,
    url: `${storagePlan.type}/${encodeURIComponent(finalStoredName)}`,
    type: storagePlan.type,
    originalSizeBytes: storagePlan.originalSizeBytes,
    storedSizeBytes,
    compressed: storagePlan.compress,
  };
}
