import { Router } from "express";
import multer from "multer";
import path from "path";
import { __dirname } from "../utils/paths.js";
import { db, userDataRoot } from "../utils/db.js";
import fs from "fs";

const router = Router();

const storage = multer.diskStorage({
  destination: async function (req, file, cb) {
    try {
      const experimentID = req.body.experimentID || req.params.experimentID;
      const ext = path.extname(file.originalname).toLowerCase();
      let type = null;
      if (/\.(png|jpg|jpeg|gif|svg|webp|bmp)$/i.test(ext)) type = "img";
      else if (/\.(mp3|wav|ogg|m4a|flac|aac)$/i.test(ext)) type = "aud";
      else if (/\.(mp4|webm|mov|avi|mkv)$/i.test(ext)) type = "vid";
      else type = "others";

      if (!type) {
        // Rechaza el archivo si no es de los tipos permitidos
        return cb(new Error("File type not allowed"), null);
      }

      // Obtener el nombre del experimento
      let experimentName = experimentID;
      await db.read();
      const experiment = db.data.experiments.find(
        (e) => e.experimentID === experimentID
      );
      if (experiment && experiment.name) {
        experimentName = experiment.name;
      }

      const folder = path.join(userDataRoot, experimentName, type);
      fs.mkdirSync(folder, { recursive: true });
      cb(null, folder);
    } catch (err) {
      cb(err, null);
    }
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname);
  },
});

const upload = multer({ storage });

router.post(
  "/api/upload-files/:experimentID",
  upload.array("files"),
  async (req, res) => {
    try {
      const experimentID = req.params.experimentID;
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: "No files uploaded" });
      }
      let experimentName = experimentID;
      await db.read();
      const experiment = db.data.experiments.find(
        (e) => e.experimentID === experimentID
      );
      if (experiment && experiment.name) {
        experimentName = experiment.name;
      }
      const fileUrls = req.files.map((file) => {
        const type = path.basename(path.dirname(file.path));
        return `${type}/${file.filename}`;
      });
      res.json({
        fileUrls,
        count: req.files.length,
      });
    } catch (err) {
      console.error("Error uploading files:", err);
      res.status(500).json({ error: err.message || "Error uploading files" });
    }
  }
);

router.get("/api/list-files/:type/:experimentID", async (req, res) => {
  const { experimentID, type } = req.params;
  try {
    let files = [];
    // Buscar el nombre del experimento
    let experimentName = experimentID;
    await db.read();
    const experiment = db.data.experiments.find(
      (e) => e.experimentID === experimentID
    );
    if (experiment && experiment.name) {
      experimentName = experiment.name;
    }
    if (type === "all") {
      const types = ["img", "aud", "vid", "others"];
      types.forEach((t) => {
        const dir = path.join(userDataRoot, experimentName, t);
        if (fs.existsSync(dir)) {
          const typeFiles = fs.readdirSync(dir).map((filename) => ({
            name: filename,
            url: `${t}/${filename}`,
            type: t,
          }));
          files = files.concat(typeFiles);
        }
      });
    } else {
      const dir = path.join(userDataRoot, experimentName, type);
      if (fs.existsSync(dir)) {
        files = fs.readdirSync(dir).map((filename) => ({
          name: filename,
          url: `${type}/${filename}`,
          type,
        }));
      }
    }
    res.json({ files });
  } catch (err) {
    res.status(500).json({ files: [], error: err.message });
  }
});

router.delete(
  "/api/delete-file/:type/:filename/:experimentID",
  async (req, res) => {
    const { experimentID, type, filename } = req.params;
    let experimentName = experimentID;
    await db.read();
    const experiment = db.data.experiments.find(
      (e) => e.experimentID === experimentID
    );
    if (experiment && experiment.name) {
      experimentName = experiment.name;
    }
    const filePath = path.join(userDataRoot, experimentName, type, filename);
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        res.json({ success: true });
      } else {
        res.status(404).json({ success: false, error: "File not found" });
      }
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

export default router;
