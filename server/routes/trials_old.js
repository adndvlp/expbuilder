import { Router } from "express";
import { db } from "../utils/db.js";
const router = Router();

router.get("/api/load-trials/:experimentID", async (req, res) => {
  try {
    await db.read();
    const trialsDoc = db.data.trials.find(
      (t) => t.experimentID === req.params.experimentID
    );
    if (!trialsDoc) return res.json({ trials: null });
    res.json({ trials: trialsDoc.data });
  } catch (error) {
    res.status(500).json({ trials: null, error: error.message });
  }
});

router.post("/api/save-trials/:experimentID", async (req, res) => {
  try {
    const trials = req.body;
    await db.read();

    const existingIndex = db.data.trials.findIndex(
      (t) => t.experimentID === req.params.experimentID
    );

    const trialsDoc = {
      experimentID: req.params.experimentID,
      data: trials,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (existingIndex !== -1) {
      trialsDoc.createdAt = db.data.trials[existingIndex].createdAt;
      db.data.trials[existingIndex] = trialsDoc;
    } else {
      db.data.trials.push(trialsDoc);
    }

    await db.write();
    res.json({ success: true, trials: trialsDoc });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete("/api/trials/:id/:experimentID", async (req, res) => {
  try {
    // Convierte el id a número para que coincida con el tipo en la base de datos
    const idToDelete = Number(req.params.id);

    await db.read();
    const trialsDoc = db.data.trials.find(
      (t) => t.experimentID === req.params.experimentID
    );

    if (!trialsDoc || !trialsDoc.data || !trialsDoc.data.trials) {
      return res
        .status(404)
        .json({ success: false, error: "Trials not found." });
    }

    // Elimina el trial del array trials
    trialsDoc.data.trials = trialsDoc.data.trials.filter(
      (trial) => trial.id !== idToDelete
    );

    trialsDoc.updatedAt = new Date().toISOString();
    await db.write();

    res.json({ success: true, trials: trialsDoc.data.trials });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
