import fs from "fs";
import path from "path";
import { Router } from "express";
import { userDataRoot } from "../../utils/db.js";
import { getExperimentName, isVisibleUploadedFile } from "./storage.js";

const router = Router();

router.get("/api/list-files/:type/:experimentID", async (req, res) => {
  const { experimentID, type } = req.params;
  try {
    let files = [];
    const experimentName = await getExperimentName(experimentID);
    if (type === "all") {
      const types = ["img", "aud", "vid", "others"];
      types.forEach((t) => {
        const dir = path.join(userDataRoot, experimentName, t);
        if (fs.existsSync(dir)) {
          const typeFiles = fs
            .readdirSync(dir)
            .filter(isVisibleUploadedFile)
            .map((filename) => ({
              name: filename,
              url: `${t}/${encodeURIComponent(filename)}`,
              type: t,
            }));
          files = files.concat(typeFiles);
        }
      });
    } else {
      const dir = path.join(userDataRoot, experimentName, type);
      if (fs.existsSync(dir)) {
        files = fs
          .readdirSync(dir)
          .filter(isVisibleUploadedFile)
          .map((filename) => ({
            name: filename,
            url: `${type}/${encodeURIComponent(filename)}`,
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
    const { experimentID, type } = req.params;
    const filename = decodeURIComponent(req.params.filename);
    const experimentName = await getExperimentName(experimentID);
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
  },
);

export default router;
