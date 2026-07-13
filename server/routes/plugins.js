/**
 * @fileoverview Manages custom jsPsych plugins and metadata routes.
 * @module routes/plugins
 */

import { Router } from "express";
import metadataRouter from "./plugins/metadata.js";
import savedRouter from "./plugins/saved.js";

const router = Router();

router.use(metadataRouter);
router.use(savedRouter);

export default router;
