import { Router } from "express";
import createRouter from "./loops/create.js";
import deleteRouter from "./loops/delete.js";
import readRouter from "./loops/read.js";
import updateRouter from "./loops/update.js";

const router = Router();

router.use(createRouter);
router.use(readRouter);
router.use(updateRouter);
router.use(deleteRouter);

export default router;
