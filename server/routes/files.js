/**
 * @fileoverview Manages multimedia files and participant-uploaded files.
 * @module routes/files
 */

import { Router } from "express";
import libraryRouter from "./files/library.js";
import participantRouter from "./files/participant.js";
import uploadRouter from "./files/upload.js";
import memoryRouter from "./files/memory.js";

const router = Router();

router.use(uploadRouter);
router.use(libraryRouter);
router.use(participantRouter);
router.use(memoryRouter);

export default router;
