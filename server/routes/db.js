import { Router } from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import { __dirname } from "../utils/paths.js";

const router = Router();
// Endpoint para exportar el archivo db.json
router.get("/api/export-db", (req, res) => {
  const dbFilePath = path.join(__dirname, "database", "db.json");
  if (!fs.existsSync(dbFilePath)) {
    return res.status(404).send("No database file found");
  }
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Content-Disposition", "attachment; filename=db.json");
  fs.createReadStream(dbFilePath).pipe(res);
});

// Endpoint para importar el archivo db.json
const importDbUpload = multer({ dest: path.join(__dirname, "database") });
router.post("/api/import-db", importDbUpload.single("dbfile"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, error: "No file uploaded" });
  }
  const uploadedPath = req.file.path;
  const targetPath = path.join(__dirname, "database", "db.json");
  try {
    fs.renameSync(uploadedPath, targetPath);
    res.json({ success: true, message: "Database imported successfully" });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
export default router;
