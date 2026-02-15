import { Router } from "express";
import { db } from "../../utils/db.js";

const router = Router();

/**
 * Gets metadata for all trials/loops for Canvas rendering.
 * Returns only id, type, name, and branches (does not include full code).
 * @route GET /api/trials-metadata/:experimentID
 * @param {string} experimentID - Experiment ID (path parameter)
 * @returns {Object} 200 - Timeline with metadata
 * @returns {Object[]} 200.timeline - Array with item metadata
 * @returns {number|string} 200.timeline[].id - Trial or Loop ID
 * @returns {string} 200.timeline[].type - "trial" | "loop"
 * @returns {string} 200.timeline[].name - Item name
 * @returns {Array} 200.timeline[].branches - Branch IDs (connections)
 * @returns {Array} [200.timeline[].trials] - Trial IDs (loops only)
 * @returns {Object} 500 - Server error
 */
router.get("/api/trials-metadata/:experimentID", async (req, res) => {
  try {
    await db.read();
    const { experimentID } = req.params;

    // Find experiment document
    const experimentDoc = db.data.trials.find(
      (t) => t.experimentID === experimentID,
    );

    if (!experimentDoc) {
      return res.json({ timeline: [] });
    }

    // Build timeline with necessary metadata for render (id, type, name, branches)
    const timelineWithBranches = experimentDoc.timeline.map((item) => {
      if (item.type === "trial") {
        const trial = experimentDoc.trials.find((t) => t.id === item.id);
        return {
          id: item.id,
          type: item.type,
          name: item.name,
          branches: trial?.branches || [],
        };
      } else {
        const loop = experimentDoc.loops.find((l) => l.id === item.id);
        return {
          id: item.id,
          type: item.type,
          name: item.name,
          branches: loop?.branches || [],
          trials: loop?.trials || [],
        };
      }
    });

    // Retornar timeline con branches
    res.json({
      timeline: timelineWithBranches,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Gets only the extensions from all trials in an experiment.
 * Returns a compact array with only extension information.
 * @route GET /api/trials-extensions/:experimentID
 * @param {string} experimentID - Experiment ID (path parameter)
 * @returns {Object} 200 - Extensions data
 * @returns {Array<string>} 200.extensions - Unique array of all extensions used
 * @returns {Object} 500 - Server error
 */
router.get("/api/trials-extensions/:experimentID", async (req, res) => {
  try {
    await db.read();
    const { experimentID } = req.params;

    const experimentDoc = db.data.trials.find(
      (t) => t.experimentID === experimentID,
    );

    if (!experimentDoc) {
      return res.status(404).json({ error: "Experiment not found" });
    }

    // Collect all unique extensions from trials
    const extensionsSet = new Set();

    experimentDoc.trials.forEach((trial) => {
      // Check for includesExtensions (boolean) and extensionType (string)
      if (
        trial.parameters?.includesExtensions &&
        trial.parameters?.extensionType
      ) {
        extensionsSet.add(trial.parameters.extensionType);
      }
    });

    const extensions = Array.from(extensionsSet);

    res.json({ extensions });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Crea un nuevo trial en el experimento.
 * Genera un ID único basado en timestamp y lo agrega al documento normalizado.
 * @route POST /api/trial/:experimentID
 * @param {string} experimentID - ID del experimento (path parameter)
 * @param {Object} req.body - Datos del trial
 * @param {string} req.body.name - Nombre del trial
 * @param {string} req.body.plugin - Plugin jsPsych utilizado
 * @param {Object} req.body.parameters - Parámetros del plugin
 * @param {string} [req.body.trialCode] - Código JavaScript generado
 * @param {Array} [req.body.branches] - IDs de branches
 * @param {string} [req.body.parentLoopId] - ID del loop padre (si aplica)
 * @returns {Object} 200 - Trial creado
 * @returns {boolean} 200.success - Indica éxito
 * @returns {Object} 200.trial - Datos del trial creado con ID generado
 * @returns {Object} 500 - Error del servidor
 */
router.post("/api/trial/:experimentID", async (req, res) => {
  try {
    const { experimentID } = req.params;
    const trialData = req.body;

    // Generar ID único
    const id = Date.now();
    const newTrial = {
      ...trialData,
      id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await db.read();

    // Buscar o crear el documento del experimento
    let experimentDoc = db.data.trials.find(
      (t) => t.experimentID === experimentID,
    );

    if (!experimentDoc) {
      experimentDoc = {
        experimentID,
        trials: [],
        loops: [],
        timeline: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      db.data.trials.push(experimentDoc);
    }

    // Agregar trial al array de trials
    experimentDoc.trials.push(newTrial);

    // Solo agregar al timeline si NO tiene parentLoopId
    // (trials con parentLoopId están dentro de loops y se manejan ahí)
    if (!newTrial.parentLoopId) {
      experimentDoc.timeline.push({
        id: newTrial.id,
        type: "trial",
        name: newTrial.name,
        branches: newTrial.branches || [],
      });
    }

    experimentDoc.updatedAt = new Date().toISOString();

    await db.write();

    res.json({ success: true, trial: newTrial });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Obtiene un trial específico por su ID.
 * @route GET /api/trial/:experimentID/:id
 * @param {string} experimentID - ID del experimento
 * @param {number} id - ID del trial
 * @returns {Object} 200 - Trial encontrado
 * @returns {Object} 404 - Trial o experimento no encontrado
 * @returns {Object} 500 - Error del servidor
 */
router.get("/api/trial/:experimentID/:id", async (req, res) => {
  try {
    const { experimentID, id } = req.params;
    const trialId = Number(id);

    await db.read();

    const experimentDoc = db.data.trials.find(
      (t) => t.experimentID === experimentID,
    );

    if (!experimentDoc) {
      return res
        .status(404)
        .json({ success: false, error: "Experiment not found" });
    }

    const trial = experimentDoc.trials.find((t) => t.id === trialId);

    if (!trial) {
      return res.status(404).json({ success: false, error: "Trial not found" });
    }

    res.json({ success: true, trial });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Actualiza un trial existente (PATCH parcial).
 * Permite actualizaciones incrementales, actualiza automáticamente el timeline si cambia nombre/branches.
 * @route PATCH /api/trial/:experimentID/:id
 * @param {string} experimentID - ID del experimento
 * @param {number} id - ID del trial
 * @param {Object} req.body - Campos a actualizar
 * @returns {Object} 200 - Trial actualizado
 * @returns {Object} 404 - Trial o experimento no encontrado
 * @returns {Object} 500 - Error del servidor
 */
router.patch("/api/trial/:experimentID/:id", async (req, res) => {
  try {
    const { experimentID, id } = req.params;
    const trialId = Number(id);
    const updates = req.body;

    await db.read();

    const experimentDoc = db.data.trials.find(
      (t) => t.experimentID === experimentID,
    );

    if (!experimentDoc) {
      return res
        .status(404)
        .json({ success: false, error: "Experiment not found" });
    }

    const trialIndex = experimentDoc.trials.findIndex((t) => t.id === trialId);

    if (trialIndex === -1) {
      return res.status(404).json({ success: false, error: "Trial not found" });
    }

    // Actualizar trial
    experimentDoc.trials[trialIndex] = {
      ...experimentDoc.trials[trialIndex],
      ...updates,
      id: trialId, // Preservar ID
      updatedAt: new Date().toISOString(),
    };

    // Si cambió el nombre o branches, actualizar timeline
    if (updates.name || updates.branches !== undefined) {
      const timelineIndex = experimentDoc.timeline.findIndex(
        (item) => item.id === trialId && item.type === "trial",
      );
      if (timelineIndex !== -1) {
        if (updates.name) {
          experimentDoc.timeline[timelineIndex].name = updates.name;
        }
        if (updates.branches !== undefined) {
          experimentDoc.timeline[timelineIndex].branches = updates.branches;
        }
      }
    }

    experimentDoc.updatedAt = new Date().toISOString();

    await db.write();

    res.json({ success: true, trial: experimentDoc.trials[trialIndex] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Elimina un trial y todas sus referencias.
 * Limpia el trial del timeline, de loops que lo contengan, y de branches.
 * @route DELETE /api/trial/:experimentID/:id
 * @param {string} experimentID - ID del experimento
 * @param {number} id - ID del trial
 * @returns {Object} 200 - Trial eliminado
 * @returns {Object} 404 - Experimento no encontrado
 * @returns {Object} 500 - Error del servidor
 */
router.delete("/api/trial/:experimentID/:id", async (req, res) => {
  try {
    const { experimentID, id } = req.params;
    const trialId = Number(id);

    await db.read();

    const experimentDoc = db.data.trials.find(
      (t) => t.experimentID === experimentID,
    );

    if (!experimentDoc) {
      return res
        .status(404)
        .json({ success: false, error: "Experiment not found" });
    }

    // ========== BORRADO INTELIGENTE: RECONECTAR PADRES CON HIJOS ==========
    // 1. Encontrar el trial antes de eliminarlo para obtener sus branches (hijos)
    const trialToDelete = experimentDoc.trials.find((t) => t.id === trialId);
    const childrenBranches = trialToDelete?.branches || [];

    // 2. Reconectar: Buscar todos los padres (trials/loops que tienen este trial en sus branches)
    //    y reemplazar la referencia al trial eliminado con TODOS sus hijos
    //    Esto asegura que si Trial1 tiene [Trial2, Trial3] y Trial0→Trial1,
    //    al borrar Trial1, Trial0 quedará con [Trial2, Trial3]
    experimentDoc.trials.forEach((trial) => {
      if (trial.branches && trial.branches.includes(trialId)) {
        // Remover el trial eliminado y agregar TODOS sus hijos
        const newBranches = trial.branches.filter(
          (branchId) => branchId !== trialId,
        );
        // Agregar TODOS los hijos del trial eliminado (evitar duplicados)
        childrenBranches.forEach((childId) => {
          if (!newBranches.includes(childId)) {
            newBranches.push(childId);
          }
        });
        trial.branches = newBranches;
      }
    });

    experimentDoc.loops.forEach((loop) => {
      if (loop.branches && loop.branches.includes(trialId)) {
        // Remover el trial eliminado y agregar TODOS sus hijos
        const newBranches = loop.branches.filter(
          (branchId) => branchId !== trialId,
        );
        // Agregar TODOS los hijos del trial eliminado (evitar duplicados)
        childrenBranches.forEach((childId) => {
          if (!newBranches.includes(childId)) {
            newBranches.push(childId);
          }
        });
        loop.branches = newBranches;
      }
    });
    // ========== FIN BORRADO INTELIGENTE ==========

    // Eliminar trial del array
    experimentDoc.trials = experimentDoc.trials.filter((t) => t.id !== trialId);

    // Eliminar del timeline
    experimentDoc.timeline = experimentDoc.timeline.filter(
      (item) => !(item.id === trialId && item.type === "trial"),
    );

    // Eliminar referencias en loops (trials contenidos)
    experimentDoc.loops = experimentDoc.loops.map((loop) => ({
      ...loop,
      trials: loop.trials?.filter((tid) => tid !== trialId) || [],
    }));

    // Actualizar branches en el timeline con los nuevos valores
    experimentDoc.timeline = experimentDoc.timeline.map((item) => {
      if (item.type === "trial") {
        const trial = experimentDoc.trials.find((t) => t.id === item.id);
        return {
          ...item,
          branches: trial?.branches || [],
        };
      } else if (item.type === "loop") {
        const loop = experimentDoc.loops.find((l) => l.id === item.id);
        return {
          ...item,
          branches: loop?.branches || [],
          trials: loop?.trials || [],
        };
      }
      return item;
    });

    experimentDoc.updatedAt = new Date().toISOString();

    await db.write();

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Elimina todos los trials de un experimento (usado al borrar experimento).
 * @route DELETE /api/trials/:experimentID
 * @param {string} experimentID - ID del experimento
 * @returns {Object} 200 - Trials eliminados
 * @returns {Object} 500 - Error del servidor
 */
router.delete("/api/trials/:experimentID", async (req, res) => {
  try {
    const { experimentID } = req.params;

    await db.read();

    // Eliminar el documento completo del experimento
    db.data.trials = db.data.trials.filter(
      (t) => t.experimentID !== experimentID,
    );

    await db.write();

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
