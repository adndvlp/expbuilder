/**
 * @fileoverview Manages multimedia files (img, aud, vid, others).
 * Handles uploading, listing, and deleting files per experiment.
 * Organizes files into folders by type and experiment.
 * @module routes/files
 */

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
        // Reject the file if it is not of the allowed types
        return cb(new Error("File type not allowed"), null);
      }

      // Get the experiment name
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

/**
 * Uploads multimedia files for an experiment.
 * Automatically classifies by extension: img/aud/vid/others.
 * @route POST /api/upload-files/:experimentID
 * @param {string} experimentID - Experiment ID (path parameter)
 * @param {File[]} req.files - Files to upload (multipart/form-data)
 * @returns {Object} 200 - Files successfully uploaded
 * @returns {string[]} 200.fileUrls - Relative file URLs (e.g. "img/photo.jpg")
 * @returns {number} 200.count - Number of uploaded files
 * @returns {Object} 400 - No files uploaded
 * @returns {Object} 500 - Server error
 */
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

/**
 * Lista archivos de un experimento filtrados por tipo.
 * @route GET /api/list-files/:type/:experimentID
 * @param {string} type - Tipo de archivo: "img"|"aud"|"vid"|"others"|"all"
 * @param {string} experimentID - ID del experimento
 * @returns {Object} 200 - Lista de archivos
 * @returns {Object[]} 200.files - Array de archivos
 * @returns {string} 200.files[].name - Nombre del archivo
 * @returns {string} 200.files[].url - URL relativa (ej: "img/photo.jpg")
 * @returns {string} 200.files[].type - Tipo del archivo
 * @returns {Object} 500 - Error del servidor
 */
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

/**
 * Elimina un archivo específico de un experimento.
 * @route DELETE /api/delete-file/:type/:filename/:experimentID
 * @param {string} type - Tipo de archivo ("img"|"aud"|"vid"|"others")
 * @param {string} filename - Nombre del archivo
 * @param {string} experimentID - ID del experimento
 * @returns {Object} 200 - Archivo eliminado exitosamente
 * @returns {boolean} 200.success - Indica éxito
 * @returns {Object} 404 - Archivo no encontrado
 * @returns {Object} 500 - Error del servidor
 */
router.delete(
  "/api/delete-file/:type/:filename/:experimentID",
  async (req, res) => {
    const { experimentID, type } = req.params;
    const filename = decodeURIComponent(req.params.filename);
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
