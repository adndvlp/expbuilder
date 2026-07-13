/**
 * @fileoverview Manages database export, import, and reset routes.
 * @module routes/db
 */

import { Router } from "express";
import exportRouter from "./db/export.js";
import importRouter from "./db/import.js";
import resetRouter from "./db/reset.js";

const router = Router();

router.use(exportRouter);
router.use(importRouter);
router.use(resetRouter);

export default router;
