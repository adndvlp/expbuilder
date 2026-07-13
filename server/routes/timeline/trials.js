import { Router } from "express";
import crudRouter from "./trials/crud.js";
import metadataRouter from "./trials/metadata.js";

const router = Router();

router.use(metadataRouter);
router.use(crudRouter);

export default router;
