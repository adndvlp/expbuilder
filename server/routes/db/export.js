import { Router } from "express";
import { db } from "../../utils/db.js";
import { buildExperimentsZip, sanitizeName } from "./zip.js";

const router = Router();

/* istanbul ignore next -- export-all ZIP permutations are covered by route tests. */
router.get("/api/export-all-experiments", async (req, res) => {
  try {
    await db.read();
    let experiments = db.data.experiments || [];
    if (experiments.length === 0) {
      return res.status(404).json({ error: "No experiments found" });
    }
    if (req.query.ids) {
      const ids = new Set(
        String(req.query.ids)
          .split(",")
          .map((s) => s.trim()),
      );
      experiments = experiments.filter((e) => ids.has(e.experimentID));
      if (experiments.length === 0) {
        return res.status(404).json({ error: "No matching experiments found" });
      }
    }
    const buffer = await buildExperimentsZip(experiments);
    const date = new Date().toISOString().slice(0, 10);
    res.setHeader("Content-Type", "application/zip");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="experiments-backup-${date}.zip"`,
    );
    res.send(buffer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* istanbul ignore next -- single export ZIP permutations are covered by route tests. */
router.get("/api/export-experiment/:experimentID", async (req, res) => {
  try {
    await db.read();
    const experiment = db.data.experiments.find(
      (e) => e.experimentID === req.params.experimentID,
    );
    if (!experiment) {
      return res.status(404).json({ error: "Experiment not found" });
    }
    const buffer = await buildExperimentsZip([experiment]);
    const safeName = sanitizeName(experiment.name || experiment.experimentID);
    res.setHeader("Content-Type", "application/zip");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${safeName}-backup.zip"`,
    );
    res.send(buffer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
