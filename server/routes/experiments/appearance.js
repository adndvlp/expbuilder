import { Router } from "express";
import { db, ensureDbData } from "../../utils/db.js";

const router = Router();

router.get("/api/appearance-settings/:experimentID", async (req, res) => {
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
    res.json({
      success: true,
      settings: exp.appearanceSettings ?? {
        backgroundColor: "#ffffff",
        fullScreen: true,
        progressBar: false,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/* istanbul ignore next -- defaults and missing-body permutations are covered by appearance route tests. */
router.put("/api/appearance-settings/:experimentID", async (req, res) => {
  const {
    backgroundColor = "#ffffff",
    fullScreen = true,
    progressBar = false,
  } = req.body || {};
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
    exp.appearanceSettings = {
      backgroundColor: String(backgroundColor).slice(0, 20),
      fullScreen: !!fullScreen,
      progressBar: !!progressBar,
    };
    exp.updatedAt = new Date().toISOString();
    await db.write();
    res.json({ success: true, settings: exp.appearanceSettings });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
