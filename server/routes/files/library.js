import fs from "fs";
import { Router } from "express";
import {
  assertMediaType,
  assertAssetFilename,
  assertSafePath,
} from "../../modules/experiment-assets/paths.js";
import {
  getExperimentAssetDirectory,
  isVisibleUploadedFile,
} from "./storage.js";

const router = Router();

router.get("/api/list-files/:type/:experimentID", async (req, res) => {
  const { experimentID, type } = req.params;
  try {
    assertMediaType(type, true);
    let files = [];
    const experimentName = await getExperimentAssetDirectory(experimentID);
    if (type === "all") {
      const types = ["img", "aud", "vid", "others"];
      types.forEach((t) => {
        const dir = assertSafePath(`${experimentName}/${t}`);
        if (fs.existsSync(dir)) {
          const typeFiles = fs
            .readdirSync(dir)
            .filter(isVisibleUploadedFile)
            .filter((filename) =>
              fs
                .statSync(
                  assertSafePath(
                    `${experimentName}/${type === "all" ? t : type}/${filename}`,
                  ),
                )
                .isFile(),
            )
            .map((filename) => ({
              name: filename,
              url: `${t}/${encodeURIComponent(filename)}`,
              type: t,
            }));
          files = files.concat(typeFiles);
        }
      });
    } else {
      const dir = assertSafePath(`${experimentName}/${type}`);
      if (fs.existsSync(dir)) {
        files = fs
          .readdirSync(dir)
          .filter(isVisibleUploadedFile)
          .filter((filename) =>
            fs
              .statSync(assertSafePath(`${experimentName}/${type}/${filename}`))
              .isFile(),
          )
          .map((filename) => ({
            name: filename,
            url: `${type}/${encodeURIComponent(filename)}`,
            type,
          }));
      }
    }
    res.json({ files });
  } catch (err) {
    res
      .status(err.status || 500)
      .json({ files: [], code: err.code, error: err.message });
  }
});

router.delete(
  "/api/delete-file/:type/:filename/:experimentID",
  async (req, res) => {
    const { experimentID, type } = req.params;
    try {
      assertMediaType(type);
      const filename = req.params.filename;
      assertAssetFilename(filename);
      const experimentName = await getExperimentAssetDirectory(experimentID, {
        write: true,
      });
      const filePath = assertSafePath(`${experimentName}/${type}/${filename}`);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        res.json({ success: true });
      } else {
        res.status(404).json({ success: false, error: "File not found" });
      }
    } catch (err) {
      res
        .status(err.status || 500)
        .json({ success: false, code: err.code, error: err.message });
    }
  },
);

export default router;
