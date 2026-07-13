/**
 * @fileoverview Manages multimedia files and participant-uploaded files.
 * @module routes/files
 */

import { Router } from "express";
import libraryRouter from "./files/library.js";
import participantRouter from "./files/participant.js";
import uploadRouter from "./files/upload.js";

const router = Router();

router.use(uploadRouter);
router.use(libraryRouter);
router.use(participantRouter);

export default router;
