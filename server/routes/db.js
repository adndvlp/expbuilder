import { Router } from "express";
import multer from "multer";
import fs from "fs";
import { __dirname } from "../utils/paths.js";
import { dbPath, dbDir } from "../utils/db.js";

const router = Router();
// Endpoint para exportar el archivo db.json
router.get("/api/export-db", (req, res) => {
  const dbFilePath = dbPath;
  if (!fs.existsSync(dbFilePath)) {
    return res.status(404).send("No database file found");
  }
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Content-Disposition", "attachment; filename=db.json");
  fs.createReadStream(dbFilePath).pipe(res);
});

// Endpoint para importar el archivo db.json
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
