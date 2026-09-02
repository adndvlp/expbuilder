/**
 * @fileoverview Manages trials and loops with normalized architecture.
 * @module routes/trials
 */

import { Router } from "express";
import coreRouter from "./core.js";
import graphRouter from "./graph/index.js";
import loopBranchingRouter from "./loopBranching/index.js";
import loopsRouter from "./loops.js";
import trialsRouter from "./trials.js";
import validationRouter from "./validation.js";

const router = Router();

router.use(trialsRouter);
router.use(graphRouter);
router.use(loopBranchingRouter);
router.use(loopsRouter);
router.use(coreRouter);
router.use(validationRouter);

export default router;
