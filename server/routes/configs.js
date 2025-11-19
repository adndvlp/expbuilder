import { Router } from "express";
import { db } from "../utils/db.js";

const router = Router();
router.get("/api/load-config/:experimentID", async (req, res) => {
  try {
    await db.read();
    const configDoc = db.data.configs.find(
      (c) => c.experimentID === req.params.experimentID
    );
    if (!configDoc) return res.json({ config: null, isDevMode: false });
    res.json({ config: configDoc.data, isDevMode: configDoc.isDevMode });
  } catch (error) {
    res
      .status(500)
      .json({ config: null, isDevMode: false, error: error.message });
  }
});

// API endpoint to save configuration and generated code
router.post("/api/save-config/:experimentID", async (req, res) => {
  try {
    const { config, isDevMode } = req.body;

    await db.read();
    const existingIndex = db.data.configs.findIndex(
      (c) => c.experimentID === req.params.experimentID
    );

    const configDoc = {
      experimentID: req.params.experimentID,
      data: config,
      isDevMode: isDevMode,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (existingIndex !== -1) {
      configDoc.createdAt = db.data.configs[existingIndex].createdAt;
      db.data.configs[existingIndex] = configDoc;
    } else {
      db.data.configs.push(configDoc);
    }

    await db.write();
    res.json({ success: true, config: configDoc });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
