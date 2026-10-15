import fs from "node:fs/promises";
import path from "node:path";
import { Router } from "express";
import { userDataRoot } from "../../utils/db.js";
import { getExperimentName } from "./storage.js";
import { inspectMediaFile } from "./mediaMetadata.js";

const router = Router();
const inside = (root, value) => value.startsWith(root + path.sep);

router.get("/api/media-memory-metadata/:experimentID", async (req, res) => {
  const controller = new globalThis.AbortController();
  res.once("close", () => controller.abort());
  try {
    const match = /^(img|aud|vid)\/([^/\\]+)$/.exec(
      String(req.query.file || ""),
    );
    if (!match)
      return res.status(400).json({ error: "Invalid media reference" });
    const [, type, encodedName] = match;
    const filename = decodeURIComponent(encodedName);
    if (!filename || /[/\\\0]/.test(filename) || [".", ".."].includes(filename))
      return res.status(400).json({ error: "Invalid media reference" });
    const name = await getExperimentName(req.params.experimentID);
    const root = await fs.realpath(userDataRoot);
    const directory = await fs.realpath(path.join(root, name, type));
    if (!inside(root, directory))
      return res.status(400).json({ error: "Invalid media reference" });
    const filePath = await fs.realpath(path.join(directory, filename));
    if (!inside(directory, filePath))
      return res.status(400).json({ error: "Invalid media reference" });
    const metadata = await inspectMediaFile(filePath, type, controller.signal);
    if (!controller.signal.aborted) res.json(metadata);
  } catch (error) {
    if (controller.signal.aborted) return;
    const status =
      error instanceof URIError ? 400 : error.code === "ENOENT" ? 404 : 500;
    res.status(status).json({ error: "Media metadata unavailable" });
  }
});

export default router;
