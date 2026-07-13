/**
 * @fileoverview Manages experiment session results.
 * @module routes/results
 */

import { Router } from "express";
import downloadRouter from "./results/downloads.js";
import manageRouter from "./results/manage.js";
import sessionsRouter from "./results/sessions.js";

const router = Router();

router.use(sessionsRouter);
router.use(downloadRouter);
router.use(manageRouter);

export default router;
