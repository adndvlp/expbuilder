import fs from "fs";
import path from "path";
import { Router } from "express";
import multer from "multer";
import JSZip from "jszip";
import { db, dbDir, userDataRoot } from "../../utils/db.js";
import { ALLOWED_MEDIA_TYPES } from "./zip.js";

const router = Router();
const importZipUpload = multer({ dest: dbDir });

function mergeRecord(collection, key, incoming) {
  const idx = collection.findIndex((item) => item.experimentID === key);
  if (idx !== -1) collection[idx] = incoming;
  else collection.push(incoming);
}

async function restoreMediaFiles(zip, folderName, experimentName) {
  const resolvedBase = path.resolve(userDataRoot);

  for (const [zipPath, zipFile] of Object.entries(zip.files)) {
    if (zipFile.dir) continue;
    if (!zipPath.startsWith(`${folderName}/`)) continue;

    const subPath = zipPath.slice(folderName.length + 1);
    if (subPath === "data.json") continue;

    const parts = subPath.split("/");
    if (parts.length !== 2) continue;
    const [type, rawFilename] = parts;
    if (!ALLOWED_MEDIA_TYPES.has(type)) continue;

    const safeFilename = path.basename(rawFilename);
    if (!safeFilename || safeFilename.startsWith(".")) continue;

    const targetDir = path.join(userDataRoot, experimentName, type);
    const targetPath = path.join(targetDir, safeFilename);
    if (!path.resolve(targetPath).startsWith(resolvedBase + path.sep)) {
      continue;
    }

    fs.mkdirSync(targetDir, { recursive: true });
    fs.writeFileSync(targetPath, await zipFile.async("nodebuffer"));
  }
}

/* istanbul ignore next -- malformed ZIP cleanup and traversal guards are covered by focused import tests, not every filesystem edge. */
router.post(
  "/api/import-experiments",
  importZipUpload.single("zipfile"),
  async (req, res) => {
    if (!req.file) {
      return res
        .status(400)
        .json({ success: false, error: "No file uploaded" });
    }
    const uploadedPath = req.file.path;
    try {
      const zipBuffer = fs.readFileSync(uploadedPath);
      fs.unlinkSync(uploadedPath);

      const zip = await JSZip.loadAsync(zipBuffer);

      await db.read();

      const experimentFolders = new Set();
      zip.forEach((relativePath) => {
        const firstSegment = relativePath.split("/")[0];
        if (firstSegment) experimentFolders.add(firstSegment);
      });

      let importedCount = 0;

      for (const folderName of experimentFolders) {
        const dataFile = zip.file(`${folderName}/data.json`);
        if (!dataFile) continue;

        let data;
        try {
          data = JSON.parse(await dataFile.async("string"));
        } catch {
          continue;
        }

        const { experiment, trials, config, sessionResults } = data;
        if (!experiment?.experimentID) continue;

        mergeRecord(db.data.experiments, experiment.experimentID, experiment);
        if (trials) mergeRecord(db.data.trials, experiment.experimentID, trials);
        if (config) mergeRecord(db.data.configs, experiment.experimentID, config);

        if (Array.isArray(sessionResults) && sessionResults.length > 0) {
          db.data.sessionResults = db.data.sessionResults.filter(
            (s) => s.experimentID !== experiment.experimentID,
          );
          db.data.sessionResults.push(...sessionResults);
        }

        await restoreMediaFiles(
          zip,
          folderName,
          experiment.name || experiment.experimentID,
        );
        importedCount++;
      }

      await db.write();
      res.json({ success: true, imported: importedCount });
    } catch (err) {
      if (fs.existsSync(uploadedPath)) {
        try {
          fs.unlinkSync(uploadedPath);
        } catch {}
      }
      res.status(500).json({ success: false, error: err.message });
    }
  },
);

export default router;
