import { Router } from "express";
import { db, ensureDbData } from "../../utils/db.js";

const router = Router();

export async function getTunnelSettings(experimentID) {
  await db.read();
  ensureDbData();
  const exp = db.data.experiments.find((e) => e.experimentID === experimentID);
  if (!exp) return null;
  exp.tunnelSettings ||= {
    hostname: "",
    persistent: false,
  };
  return exp.tunnelSettings;
}

router.get("/api/tunnel-settings/:experimentID", async (req, res) => {
  try {
    const settings = await getTunnelSettings(req.params.experimentID);
    if (!settings) {
      return res
        .status(404)
        .json({ success: false, error: "Experiment not found" });
    }
    res.json({ success: true, settings });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.put("/api/tunnel-settings/:experimentID", async (req, res) => {
  /* istanbul ignore next -- express.json initializes req.body in the mounted API app. */
  const { hostname = "", persistent = false } = req.body || {};
  try {
    await db.read();
    ensureDbData();
    const exp = db.data.experiments.find(
      (e) => e.experimentID === req.params.experimentID,
    );
    if (!exp) {
      return res
        .status(404)
        .json({ success: false, error: "Experiment not found" });
    }
    const norm = hostname
      .replace(/^https?:\/\//, "")
      .replace(/\/$/, "")
      .trim();
    exp.tunnelSettings = {
      hostname: norm,
      persistent: !!persistent,
    };
    exp.updatedAt = new Date().toISOString();
    await db.write();
    res.json({ success: true, settings: exp.tunnelSettings });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
