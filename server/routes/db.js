/**
 * @fileoverview Manages database export and import.
 * Supports legacy full-db export and the new per-experiment ZIP format.
 * @module routes/db
 */

import { Router } from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import JSZip from "jszip";
import { __dirname } from "../utils/paths.js";
import { db, dbPath, dbDir, userDataRoot } from "../utils/db.js";

const router = Router();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Sanitize a string to be safe as a ZIP folder/filename component. */
function sanitizeName(name) {
  return (
    String(name)
      .replace(/\.\./g, "_")
      .replace(/[^a-zA-Z0-9\-_. ]/g, "_")
      .trim() || "experiment"
  );
}

const ALLOWED_MEDIA_TYPES = new Set(["img", "aud", "vid", "others"]);

/**
 * Builds and returns a nodebuffer ZIP for the given array of experiment objects.
 * Each experiment gets a top-level folder containing:
 *   data.json  – experiment record + its trials / config / sessionResults
 *   img/, aud/, vid/, others/  – multimedia files from disk
 */
async function buildExperimentsZip(experiments) {
  const zip = new JSZip();

  for (const experiment of experiments) {
    const experimentName = experiment.name || experiment.experimentID;
    const folderName = sanitizeName(experimentName);
    const folder = zip.folder(folderName);

    const trialsDoc =
      db.data.trials.find((t) => t.experimentID === experiment.experimentID) ||
      null;
    const configDoc =
      db.data.configs.find((c) => c.experimentID === experiment.experimentID) ||
      null;
    const sessionResults = db.data.sessionResults.filter(
      (s) => s.experimentID === experiment.experimentID,
    );

    folder.file(
      "data.json",
      JSON.stringify(
        { experiment, trials: trialsDoc, config: configDoc, sessionResults },
        null,
        2,
      ),
    );

    // Add multimedia files
    const mediaDir = path.join(userDataRoot, experimentName);
    if (fs.existsSync(mediaDir)) {
      for (const type of ALLOWED_MEDIA_TYPES) {
        const typeDir = path.join(mediaDir, type);
        if (!fs.existsSync(typeDir)) continue;
        for (const filename of fs.readdirSync(typeDir)) {
          const filePath = path.join(typeDir, filename);
          if (fs.statSync(filePath).isFile()) {
            folder.folder(type).file(filename, fs.readFileSync(filePath));
          }
        }
      }
    }
  }

  return zip.generateAsync({ type: "nodebuffer" });
}

/**
 * Exports all experiments as a structured ZIP.
 * Each experiment gets a folder with data.json + multimedia subdirs.
 * @route GET /api/export-all-experiments
 * @returns {Buffer} 200 - ZIP file
 */
router.get("/api/export-all-experiments", async (req, res) => {
  try {
    await db.read();
    let experiments = db.data.experiments || [];
    if (experiments.length === 0) {
      return res.status(404).json({ error: "No experiments found" });
    }
    // Optional filter: ?ids=id1,id2,...
    if (req.query.ids) {
      const ids = new Set(
        String(req.query.ids)
          .split(",")
          .map((s) => s.trim()),
      );
      experiments = experiments.filter((e) => ids.has(e.experimentID));
      if (experiments.length === 0) {
        return res.status(404).json({ error: "No matching experiments found" });
      }
    }
    const buffer = await buildExperimentsZip(experiments);
    const date = new Date().toISOString().slice(0, 10);
    res.setHeader("Content-Type", "application/zip");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="experiments-backup-${date}.zip"`,
    );
    res.send(buffer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Exports a single experiment as a structured ZIP.
 * @route GET /api/export-experiment/:experimentID
 * @returns {Buffer} 200 - ZIP file
 */
router.get("/api/export-experiment/:experimentID", async (req, res) => {
  try {
    await db.read();
    const experiment = db.data.experiments.find(
      (e) => e.experimentID === req.params.experimentID,
    );
    if (!experiment) {
      return res.status(404).json({ error: "Experiment not found" });
    }
    const buffer = await buildExperimentsZip([experiment]);
    const safeName = sanitizeName(experiment.name || experiment.experimentID);
    res.setHeader("Content-Type", "application/zip");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${safeName}-backup.zip"`,
    );
    res.send(buffer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Imports experiments from a structured ZIP (new format).
 * Merges each experiment folder into the local database.
 * Existing experiments (same experimentID) are overwritten.
 * @route POST /api/import-experiments
 * @param {File} req.file - ZIP file (field: "zipfile")
 * @returns {Object} 200 - { success, imported }
 */
const importZipUpload = multer({ dest: dbDir });
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

      // Collect top-level folder names (each = one experiment)
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

        // Merge experiment
        const expIdx = db.data.experiments.findIndex(
          (e) => e.experimentID === experiment.experimentID,
        );
        if (expIdx !== -1) db.data.experiments[expIdx] = experiment;
        else db.data.experiments.push(experiment);

        // Merge trials
        if (trials) {
          const tIdx = db.data.trials.findIndex(
            (t) => t.experimentID === experiment.experimentID,
          );
          if (tIdx !== -1) db.data.trials[tIdx] = trials;
          else db.data.trials.push(trials);
        }

        // Merge config
        if (config) {
          const cIdx = db.data.configs.findIndex(
            (c) => c.experimentID === experiment.experimentID,
          );
          if (cIdx !== -1) db.data.configs[cIdx] = config;
          else db.data.configs.push(config);
        }

        // Replace session results for this experiment
        if (Array.isArray(sessionResults) && sessionResults.length > 0) {
          db.data.sessionResults = db.data.sessionResults.filter(
            (s) => s.experimentID !== experiment.experimentID,
          );
          db.data.sessionResults.push(...sessionResults);
        }

        // Restore multimedia files
        const experimentName = experiment.name || experiment.experimentID;
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

          // Prevent path traversal
          const safeFilename = path.basename(rawFilename);
          if (!safeFilename || safeFilename.startsWith(".")) continue;

          const targetDir = path.join(userDataRoot, experimentName, type);
          const targetPath = path.join(targetDir, safeFilename);
          if (!path.resolve(targetPath).startsWith(resolvedBase + path.sep))
            continue;

          fs.mkdirSync(targetDir, { recursive: true });
          fs.writeFileSync(targetPath, await zipFile.async("nodebuffer"));
        }

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

/**
 * Factory reset the app: Clear local database, delete multimedia folders,
 * and optionally clear cloud storage and GitHub repositories via Firebase.
 * @route POST /api/app/reset
 */
router.post("/api/app/reset", async (req, res) => {
  try {
    const { uid, deleteRepos } = req.body;

    await db.read();
    const experiments = db.data.experiments || [];

    // 1. Opcional: Eliminar repositorios y datos de Firebase/Nube
    if (uid && process.env.FIREBASE_URL) {
      for (const exp of experiments) {
        try {
          const sanitizedRepoName = exp?.name
            ? exp.name
                .replace(/\s+/g, "-")
                .replace(/[^a-zA-Z0-9-_]/g, "")
                .toLowerCase()
            : exp.experimentID;

          const bodyPayload = {
            experimentID: exp.experimentID,
            uid: uid,
          };

          if (deleteRepos) {
            bodyPayload.repoName = sanitizedRepoName;
          }

          const firebaseUrl = `${process.env.FIREBASE_URL}/apiDeleteExperiment`;
          await fetch(firebaseUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(bodyPayload),
          });
        } catch (err) {
          console.error(
            `Error cleaning up Firebase/Github for exp: ${exp.experimentID}`,
            err,
          );
        }
      }
    }

    // 2. Limpiar la base de datos local
    db.data.experiments = [];
    db.data.trials = [];
    db.data.configs = [];
    db.data.pluginConfigs = [];
    db.data.sessionResults = [];
    await db.write();

    // 3. Carpetas fijas (vienen con la app): vaciar contenido, conservar la carpeta
    for (const d of ["experiments_html", "trials_previews_html"]) {
      const p = path.join(userDataRoot, d);
      if (fs.existsSync(p)) {
        for (const file of fs.readdirSync(p)) {
          fs.rmSync(path.join(p, file), { recursive: true, force: true });
        }
      }
    }

    // 4. Carpetas creadas en runtime: eliminar completas
    const runtimeDirs = ["uploads"];
    for (const exp of experiments) {
      runtimeDirs.push(exp.name || exp.experimentID);
    }
    for (const d of runtimeDirs) {
      const p = path.join(userDataRoot, d);
      if (fs.existsSync(p)) {
        fs.rmSync(p, { recursive: true, force: true });
      }
    }

    res.json({
      success: true,
      message: "Todos los datos de la app han sido borrados.",
    });
  } catch (error) {
    console.error("Error in reset app:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
