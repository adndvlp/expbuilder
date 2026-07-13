/**
 * @fileoverview Manages experiment routes (CRUD, publishing, execution).
 * @module routes/experiments
 */

import { Router } from "express";
import appearanceRouter from "./experiments/appearance.js";
import crudRouter, { serveUploadedMedia } from "./experiments/crud.js";
import htmlRouter from "./experiments/html.js";
import publishRouter from "./experiments/publish.js";

const router = Router();

router.use(crudRouter);
router.use(serveUploadedMedia);
router.use(htmlRouter);
router.use(publishRouter);
router.use(appearanceRouter);

export default router;
