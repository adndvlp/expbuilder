import { Router } from "express";
import multer from "multer";
import path from "path";
import { __dirname } from "../utils/paths.js";
import { db } from "../utils/db.js";
import fs from "fs";

const router = Router();

const storage = multer.diskStorage({
  destination: async function (req, file, cb) {
    try {
      const experimentID = req.body.experimentID || req.params.experimentID;
      const ext = path.extname(file.originalname).toLowerCase();
      let type = null;
      if (/\.(png|jpg|jpeg|gif)$/i.test(ext)) type = "img";
      else if (/\.(mp3|wav|ogg|m4a)$/i.test(ext)) type = "aud";
      else if (/\.(mp4|webm|mov|avi)$/i.test(ext)) type = "vid";

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
        experimentName = `${experiment.name}-experiment`;
      }

      const folder = path.join(__dirname, experimentName, type);
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
  "/api/upload-file/:experimentID",
  upload.single("file"),
  async (req, res) => {
    if (!req.file || !req.file.path) {
      return res.status(400).json({ error: "No file uploaded" });
    }
    const experimentID = req.params.experimentID;
    const type = path.basename(path.dirname(req.file.path));
    let experimentName = experimentID;
    await db.read();
    const experiment = db.data.experiments.find(
      (e) => e.experimentID === experimentID
    );
    if (experiment && experiment.name) {
      experimentName = `${experiment.name}-experiment`;
    }
    res.json({
      fileUrl: `${experimentName}/${type}/${req.file.filename}`,
      folder: type,
    });
  }
);

router.post(
  "/api/upload-files-folder/:experimentID",
  upload.array("files"),
  async (req, res) => {
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
      experimentName = `${experiment.name}-experiment`;
    }
    const fileUrls = req.files.map((file) => {
      const type = path.basename(path.dirname(file.path));
      return `${experimentName}/${type}/${file.filename}`;
    });
    res.json({
      fileUrls,
      info: "Archivos subidos localmente.",
    });
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
      experimentName = `${experiment.name}-experiment`;
    }
    if (type === "all") {
      const types = ["img", "aud", "vid", "others"];
      types.forEach((t) => {
        const dir = path.join(__dirname, experimentName, t);
        if (fs.existsSync(dir)) {
          const typeFiles = fs.readdirSync(dir).map((filename) => ({
            name: filename,
            url: `${experimentName}/${t}/${filename}`,
            type: t,
          }));
          files = files.concat(typeFiles);
        }
      });
    } else {
      const dir = path.join(__dirname, experimentName, type);
      if (fs.existsSync(dir)) {
        files = fs.readdirSync(dir).map((filename) => ({
          name: filename,
          url: `${experimentName}/${type}/${filename}`,
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
      experimentName = `${experiment.name}-experiment`;
    }
    const filePath = path.join(__dirname, experimentName, type, filename);
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
