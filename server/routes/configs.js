/**
 * @fileoverview Manages experiment configurations.
 * Saves/loads generated code and Development Mode status.
 * @module routes/configs
 */

import { Router } from "express";
import { db } from "../utils/db.js";

const router = Router();

/**
 * Loads the saved configuration of an experiment.
 * @route GET /api/load-config/:experimentID
 * @param {string} experimentID - Experiment ID
 * @returns {Object} 200 - Configuration found
 * @returns {Object|null} 200.config - Configuration data (generatedCode, etc.)
 * @returns {boolean} 200.isDevMode - Whether it's in development mode
 * @returns {Object} 500 - Server error
 */
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

/**
 * Saves or updates an experiment's configuration.
 * Includes generated code and Dev Mode state.
 * @route POST /api/save-config/:experimentID
 * @param {string} experimentID - Experiment ID
 * @param {Object} req.body - Configuration data
 * @param {Object} req.body.config - Configuration to save (generatedCode, etc.)
 * @param {boolean} req.body.isDevMode - Whether it's in development mode
 * @returns {Object} 200 - Configuration saved
 * @returns {boolean} 200.success - Indicates success
 * @returns {Object} 200.config - Saved configuration with timestamps
 * @returns {Object} 500 - Server error
 */
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
