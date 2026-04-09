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
      (c) => c.experimentID === req.params.experimentID,
    );
    if (!configDoc)
      return res.json({ config: null, isDevMode: false, isSaveMode: false });
    res.json({
      config: configDoc.data,
      isDevMode: configDoc.isDevMode,
      isSaveMode: configDoc.isSaveMode ?? false,
    });
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
    const { config, isDevMode, isSaveMode } = req.body;

    await db.read();
    const existingIndex = db.data.configs.findIndex(
      (c) => c.experimentID === req.params.experimentID,
    );

    const configDoc = {
      experimentID: req.params.experimentID,
      data: config,
      isDevMode: isDevMode,
      isSaveMode: isSaveMode ?? false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (existingIndex !== -1) {
      configDoc.createdAt = db.data.configs[existingIndex].createdAt;
      // Preserve sessionNameConfig — only copy if it's actual data (not null/undefined)
      const existingSnc = db.data.configs[existingIndex].sessionNameConfig;
      if (existingSnc != null && Array.isArray(existingSnc.tokens)) {
        configDoc.sessionNameConfig = existingSnc;
      }
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

/**
 * Gets the session name configuration for a local experiment.
 * @route GET /api/session-name-config/:experimentID
 */
router.get("/api/session-name-config/:experimentID", async (req, res) => {
  try {
    await db.read();
    const configDoc = db.data.configs.find(
      (c) => c.experimentID === req.params.experimentID,
    );
    const cfg = configDoc?.sessionNameConfig ?? { tokens: [], separator: "_" };
    res.json(cfg);
  } catch (error) {
    res.status(500).json({ tokens: [], separator: "_", error: error.message });
  }
});

/**
 * Saves the session name configuration for a local experiment.
 * @route POST /api/session-name-config/:experimentID
 * @param {Object[]} req.body.tokens - Session name tokens
 * @param {string} req.body.separator - Separator string
 */
router.post("/api/session-name-config/:experimentID", async (req, res) => {
  try {
    const { tokens, separator } = req.body;
    await db.read();
    let configDoc = db.data.configs.find(
      (c) => c.experimentID === req.params.experimentID,
    );
    if (!configDoc) {
      configDoc = {
        experimentID: req.params.experimentID,
        data: {},
        isDevMode: false,
        isSaveMode: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      db.data.configs.push(configDoc);
    }
    configDoc.sessionNameConfig = {
      tokens: tokens ?? [],
      separator: separator ?? "_",
    };
    configDoc.updatedAt = new Date().toISOString();
    await db.write();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
