/**
 * @fileoverview Manages trials and loops with normalized architecture.
 * @module routes/trials
 */

import { Router } from "express";
import coreRouter from "./core.js";
import loopsRouter from "./loops.js";
import trialsRouter from "./trials.js";
import validationRouter from "./validation.js";

const router = Router();

router.use(trialsRouter);
router.use(loopsRouter);
router.use(coreRouter);
router.use(validationRouter);

export default router;
