/**
 * @fileoverview Manages database export and import.
 * Allows backup and restore of the full db.json file.
 * @module routes/db
 */

import { Router } from "express";
import multer from "multer";
import fs from "fs";
import { __dirname } from "../utils/paths.js";
import { dbPath, dbDir } from "../utils/db.js";

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
export default router;
