import express, { Router } from "express";
import fs from "fs";
import path from "path";
import { componentsMetadataPath, metadataPath } from "./paths.js";

const router = Router();

router.use("/api/metadata", express.static(metadataPath));
router.use("/api/components-metadata", express.static(componentsMetadataPath));

router.get("/api/component-metadata/:componentType", (req, res) => {
  try {
    const { componentType } = req.params;
    const metadataPathFile = path.join(
      componentsMetadataPath,
      `${componentType}-component.json`,
    );

    if (!fs.existsSync(metadataPathFile)) {
      return res.status(404).json({
        error: `Metadata not found for component: ${componentType}`,
      });
    }

    const metadata = JSON.parse(fs.readFileSync(metadataPathFile, "utf-8"));
    res.json(metadata);
  } catch (error) {
    console.error("Error loading component metadata:", error);
    res.status(500).json({ error: error.message });
  }
});

router.get("/api/plugins-list", (req, res) => {
  fs.readdir(metadataPath, (err, files) => {
    if (err) return res.status(500).json({ error: "No metadata dir" });
    const plugins = files
      .filter((f) => f.endsWith(".json"))
      .map((f) => f.replace(/\.json$/, ""));
    res.json({ plugins });
  });
});

export default router;
