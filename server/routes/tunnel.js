/**
 * @fileoverview Manages Cloudflare tunnels for experiment sharing.
 * @module routes/tunnel
 */

import { Router } from "express";
import { schedulePersistentTunnelAutostart } from "./tunnel/autostart.js";
import lifecycleRouter from "./tunnel/lifecycle.js";
import settingsRouter from "./tunnel/settings.js";

const router = Router();

router.use(settingsRouter);
router.use(lifecycleRouter);
schedulePersistentTunnelAutostart();

export default router;
