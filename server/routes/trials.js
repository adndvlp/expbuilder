import { Router } from "express";
import { db } from "../utils/db.js";
import { normalize, denormalize } from "../utils/trialsNormalizer.js";

const router = Router();

// Cargar trials - devuelve estructura normalizada
router.get("/api/load-trials/:experimentID", async (req, res) => {
  try {
    await db.read();
    const trialsDoc = db.data.trials.find(
      (t) => t.experimentID === req.params.experimentID
    );
    if (!trialsDoc) return res.json({ trials: null });

    // DB siempre guarda formato normalizado
    res.json({ trials: trialsDoc.data });
  } catch (error) {
    res.status(500).json({ trials: null, error: error.message });
  }
});

// Guardar trials - recibe estructura anidada del frontend, guarda normalizada
router.post("/api/save-trials/:experimentID", async (req, res) => {
  try {
    const nestedTrials = req.body;
    await db.read();

    // Normalizar para guardar en DB
    const normalizedData = normalize(nestedTrials.trials || nestedTrials);

    const existingIndex = db.data.trials.findIndex(
      (t) => t.experimentID === req.params.experimentID
    );

    const trialsDoc = {
      experimentID: req.params.experimentID,
      data: normalizedData, // Guardar normalizado
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
    res.json({ success: true, trials: normalizedData });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Actualizar UN SOLO trial (optimizado)
router.patch("/api/trials/:id/:experimentID", async (req, res) => {
  try {
    const trialId = Number(req.params.id);
    const updatedTrialData = req.body;

    await db.read();
    const trialsDoc = db.data.trials.find(
      (t) => t.experimentID === req.params.experimentID
    );

    if (!trialsDoc || !trialsDoc.data) {
      return res
        .status(404)
        .json({ success: false, error: "Trials not found." });
    }

    // Actualizar solo este trial en el registro
    trialsDoc.data.trials[trialId] = updatedTrialData;
    trialsDoc.updatedAt = new Date().toISOString();

    await db.write();

    console.log(`[UPDATE TRIAL] ${req.params.experimentID}/${trialId}`);
    res.json({ success: true, trial: updatedTrialData });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Actualizar UN SOLO loop (optimizado)
router.patch("/api/loops/:id/:experimentID", async (req, res) => {
  try {
    const loopId = req.params.id;
    const updatedLoopData = req.body;

    await db.read();
    const trialsDoc = db.data.trials.find(
      (t) => t.experimentID === req.params.experimentID
    );

    if (!trialsDoc || !trialsDoc.data) {
      return res
        .status(404)
        .json({ success: false, error: "Trials not found." });
    }

    // Actualizar solo este loop en el registro
    trialsDoc.data.loops[loopId] = updatedLoopData;
    trialsDoc.updatedAt = new Date().toISOString();

    await db.write();

    console.log(`[UPDATE LOOP] ${req.params.experimentID}/${loopId}`);
    res.json({ success: true, loop: updatedLoopData });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Eliminar trial - busca en estructura normalizada
router.delete("/api/trials/:id/:experimentID", async (req, res) => {
  try {
    const idToDelete = Number(req.params.id);

    await db.read();
    const trialsDoc = db.data.trials.find(
      (t) => t.experimentID === req.params.experimentID
    );

    if (!trialsDoc || !trialsDoc.data) {
      return res
        .status(404)
        .json({ success: false, error: "Trials not found." });
    }

    const { trials, loops, timeline } = trialsDoc.data;

    // Eliminar del registro de trials
    if (trials[idToDelete]) {
      delete trials[idToDelete];
    }

    // Eliminar de todos los timelines
    function removeFromTimeline(timelineItems) {
      return timelineItems.filter((item) => item.id !== idToDelete);
    }

    // Limpiar timeline root
    timeline.root = removeFromTimeline(timeline.root);

    // Limpiar timelines de loops
    Object.keys(timeline).forEach((loopId) => {
      if (loopId !== "root" && Array.isArray(timeline[loopId])) {
        timeline[loopId] = removeFromTimeline(timeline[loopId]);
      }
    });

    trialsDoc.data = { trials, loops, timeline };
    trialsDoc.updatedAt = new Date().toISOString();
    await db.write();

    res.json({ success: true, trials: trialsDoc.data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
