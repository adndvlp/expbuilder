/**
 * @fileoverview Manages database export and import.
 * Allows backup and restore of the full db.json file.
 * @module routes/db
 */

import { Router } from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import { __dirname } from "../utils/paths.js";
import { db, dbPath, dbDir, userDataRoot } from "../utils/db.js";

const router = Router();

/**
 * Exports the full database (db.json) as a download.
 * @route GET /api/export-db
 * @returns {File} 200 - db.json file
 * @returns {string} 404 - Database not found
 */
router.get("/api/export-db", (req, res) => {
  const dbFilePath = dbPath;
  if (!fs.existsSync(dbFilePath)) {
    return res.status(404).send("No database file found");
  }
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Content-Disposition", "attachment; filename=db.json");
  fs.createReadStream(dbFilePath).pipe(res);
});

/**
 * Imports a database from a db.json file.
 * Completely replaces the current database.
 * @route POST /api/import-db
 * @param {File} req.file - db.json file (multipart/form-data, field: "dbfile")
 * @returns {Object} 200 - Database imported successfully
 * @returns {boolean} 200.success - Indicates success
 * @returns {string} 200.message - Confirmation message
 * @returns {Object} 400 - No file uploaded
 * @returns {Object} 500 - Server error
 */
const importDbUpload = multer({ dest: dbDir });
router.post("/api/import-db", importDbUpload.single("dbfile"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, error: "No file uploaded" });
  }
  const uploadedPath = req.file.path;
  const targetPath = dbPath;
  try {
    fs.renameSync(uploadedPath, targetPath);
    res.json({ success: true, message: "Database imported successfully" });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

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
