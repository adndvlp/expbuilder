/**
 * @fileoverview Manages trials and loops with normalized architecture.
 * Implements a flat storage system where trials and loops are stored
 * separately but linked via IDs. Allows CRUD operations on trials,
 * loops, timeline, and branch management (conditional connections).
 * @module routes/trials
 * @see {@link file://CAMBIOS_NORMALIZACION.md} For refactoring details
 */

import { Router } from "express";
import { db } from "../utils/db.js";

const router = Router();

/**
 * Gets all generated JavaScript code (trials + loops) for an experiment.
 * @route GET /api/timeline-code/:experimentID
 * @param {string} experimentID - Experiment ID (path parameter)
 * @returns {Object} 200 - Generated codes
 * @returns {string[]} 200.codes - Array with code for all trials and loops
 * @returns {Object} 500 - Server error
 */
router.get("/api/timeline-code/:experimentID", async (req, res) => {
  try {
    await db.read();
    const { experimentID } = req.params;

    const experimentDoc = db.data.trials.find(
      (t) => t.experimentID === experimentID,
    );

    if (!experimentDoc) {
      return res.json({ codes: [] });
    }

    // Concatenate trial and loop codes
    const trialCodes = experimentDoc.trials
      .map((trial) => trial.trialCode)
      .filter(Boolean);

    const loopCodes = experimentDoc.loops
      .map((loop) => loop.code)
      .filter(Boolean);

    const allCodes = [...trialCodes, ...loopCodes];

    res.json({ codes: allCodes });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

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
 * Crea un nuevo loop que agrupa múltiples trials.
 * Genera ID tipo "loop_{timestamp}", actualiza branches en trials/loops que referencian
 * los trials agrupados, y los remueve del timeline principal.
 * @route POST /api/loop/:experimentID
 * @param {string} experimentID - ID del experimento
 * @param {Object} req.body - Datos del loop
 * @param {string} req.body.name - Nombre del loop
 * @param {Array<number>} req.body.trials - IDs de trials a agrupar
 * @param {Object} req.body.loopConfig - Configuración del loop (repeticiones, etc.)
 * @param {string} [req.body.code] - Código JavaScript del loop
 * @param {Array} [req.body.branches] - IDs de branches
 * @returns {Object} 200 - Loop creado
 * @returns {Object} 500 - Error del servidor
 */
router.post("/api/loop/:experimentID", async (req, res) => {
  try {
    const { experimentID } = req.params;
    const loopData = req.body;

    // Generar ID único
    const id = "loop_" + Date.now();
    const newLoop = {
      ...loopData,
      id,
      trials: loopData.trials || [], // Array de IDs de trials
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

    // Agregar loop al array de loops
    experimentDoc.loops.push(newLoop);

    // Solo agregar al timeline si NO tiene parentLoopId
    // (loops con parentLoopId están dentro de otros loops y se manejan ahí)
    if (!newLoop.parentLoopId) {
      // Remover los trials del timeline que ahora están dentro del loop
      experimentDoc.timeline = experimentDoc.timeline.filter(
        (item) => !(item.type === "trial" && newLoop.trials.includes(item.id)),
      );

      // Agregar loop al timeline
      experimentDoc.timeline.push({
        id: newLoop.id,
        type: "loop",
        name: newLoop.name,
        branches: newLoop.branches || [],
        trials: newLoop.trials || [],
      });
    }

    // Actualizar branches de todos los trials/loops que contenían estos trials
    // Reemplazar los IDs de trials individuales por el ID del loop
    // IMPORTANTE: No actualizar los trials que están DENTRO del loop (evita referencias circulares)
    experimentDoc.trials.forEach((trial) => {
      // Saltar si este trial está dentro del loop que acabamos de crear
      if (newLoop.trials.includes(trial.id)) {
        return;
      }

      if (trial.branches && trial.branches.length > 0) {
        const hasAnyTrialFromLoop = trial.branches.some((branchId) =>
          newLoop.trials.includes(branchId),
        );
        if (hasAnyTrialFromLoop) {
          // Remover todos los trial IDs que están en el loop
          const filteredBranches = trial.branches.filter(
            (branchId) => !newLoop.trials.includes(branchId),
          );
          // Agregar el loop ID si no está ya
          if (!filteredBranches.includes(newLoop.id)) {
            filteredBranches.push(newLoop.id);
          }
          trial.branches = filteredBranches;
        }
      }
    });

    experimentDoc.loops.forEach((loop) => {
      if (loop.id !== newLoop.id && loop.branches && loop.branches.length > 0) {
        const hasAnyTrialFromNewLoop = loop.branches.some((branchId) =>
          newLoop.trials.includes(branchId),
        );
        if (hasAnyTrialFromNewLoop) {
          // Remover todos los trial IDs que están en el nuevo loop
          const filteredBranches = loop.branches.filter(
            (branchId) => !newLoop.trials.includes(branchId),
          );
          // Agregar el nuevo loop ID si no está ya
          if (!filteredBranches.includes(newLoop.id)) {
            filteredBranches.push(newLoop.id);
          }
          loop.branches = filteredBranches;
        }
      }
    });

    // Actualizar timeline con los branches actualizados
    experimentDoc.timeline.forEach((item) => {
      if (item.type === "trial") {
        const trial = experimentDoc.trials.find((t) => t.id === item.id);
        if (trial) {
          item.branches = trial.branches || [];
        }
      } else if (item.type === "loop") {
        const loop = experimentDoc.loops.find((l) => l.id === item.id);
        if (loop) {
          item.branches = loop.branches || [];
        }
      }
    });

    experimentDoc.updatedAt = new Date().toISOString();

    await db.write();

    res.json({ success: true, loop: newLoop });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Obtiene metadata de todos los trials/loops dentro de un loop específico.
 * Recorre recursivamente todos los branches para incluir items referenciados.
 * @route GET /api/loop-trials-metadata/:experimentID/:loopId
 * @param {string} experimentID - ID del experimento
 * @param {string} loopId - ID del loop
 * @returns {Object} 200 - Metadata de trials en el loop
 * @returns {Array} 200.trialsMetadata - Metadata de trials/loops
 * @returns {Object} 404 - Loop o experimento no encontrado
 * @returns {Object} 500 - Error del servidor
 */
router.get(
  "/api/loop-trials-metadata/:experimentID/:loopId",
  async (req, res) => {
    try {
      const { experimentID, loopId } = req.params;

      await db.read();

      const experimentDoc = db.data.trials.find(
        (t) => t.experimentID === experimentID,
      );

      if (!experimentDoc) {
        return res.status(404).json({ error: "Experiment not found" });
      }

      const loop = experimentDoc.loops.find((l) => l.id === loopId);

      if (!loop) {
        return res.status(404).json({ error: "Loop not found" });
      }

      // Función para recopilar todos los IDs que se necesitan (incluyendo branches recursivamente)
      const collectAllItemIds = (itemIds) => {
        const collected = new Set();
        const toProcess = [...itemIds];

        while (toProcess.length > 0) {
          const itemId = toProcess.shift();

          // No incluir el loop padre mismo
          if (itemId === loopId) continue;

          if (collected.has(itemId)) continue;

          collected.add(itemId);

          // Buscar el item y agregar sus branches para procesarlos
          const trial = experimentDoc.trials.find((t) => t.id === itemId);
          if (trial && trial.branches) {
            toProcess.push(...trial.branches.filter((bid) => bid !== loopId));
          }

          const nestedLoop = experimentDoc.loops.find((l) => l.id === itemId);
          if (nestedLoop) {
            if (nestedLoop.branches) {
              toProcess.push(
                ...nestedLoop.branches.filter((bid) => bid !== loopId),
              );
            }
            // NO agregar nestedLoop.trials aquí porque esos se manejan separadamente en su propio loop
          }
        }

        return Array.from(collected);
      };

      // Recopilar todos los IDs necesarios (trials del loop + todos sus branches recursivamente)
      const allItemIds = collectAllItemIds(loop.trials || []);

      // Construir metadata de todos los items
      const trialsMetadata = allItemIds
        .map((itemId) => {
          // Buscar en trials
          const trial = experimentDoc.trials.find((t) => t.id === itemId);
          if (trial) {
            return {
              id: trial.id,
              type: "trial",
              name: trial.name,
              branches: trial.branches || [],
            };
          }

          // Buscar en loops (nested loops)
          const nestedLoop = experimentDoc.loops.find((l) => l.id === itemId);
          if (nestedLoop) {
            return {
              id: nestedLoop.id,
              type: "loop",
              name: nestedLoop.name,
              branches: nestedLoop.branches || [],
              trials: nestedLoop.trials || [],
            };
          }

          return null;
        })
        .filter(Boolean); // Filtrar nulls

      res.json({
        trialsMetadata,
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
);

/**
 * Obtiene un loop específico con metadata de sus trials.
 * @route GET /api/loop/:experimentID/:id
 * @param {string} experimentID - ID del experimento
 * @param {string} id - ID del loop
 * @returns {Object} 200 - Loop encontrado con trialsMetadata
 * @returns {Object} 404 - Loop o experimento no encontrado
 * @returns {Object} 500 - Error del servidor
 */
router.get("/api/loop/:experimentID/:id", async (req, res) => {
  try {
    const { experimentID, id } = req.params;

    await db.read();

    const experimentDoc = db.data.trials.find(
      (t) => t.experimentID === experimentID,
    );

    if (!experimentDoc) {
      return res
        .status(404)
        .json({ success: false, error: "Experiment not found" });
    }

    const loop = experimentDoc.loops.find((l) => l.id === id);

    if (!loop) {
      return res.status(404).json({ success: false, error: "Loop not found" });
    }

    // Agregar metadata de los trials del loop (solo id y nombre)
    const trialsMetadata = loop.trials
      .map((trialId) => {
        const trial = experimentDoc.trials.find((t) => t.id === trialId);
        return trial ? { id: trial.id, name: trial.name } : null;
      })
      .filter(Boolean);

    res.json({
      success: true,
      loop: {
        ...loop,
        trialsMetadata, // Incluir metadata de trials
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Actualiza un loop existente.
 * Si cambian los trials, actualiza el timeline removiendo trials que entran al loop.
 * @route PATCH /api/loop/:experimentID/:id
 * @param {string} experimentID - ID del experimento
 * @param {string} id - ID del loop
 * @param {Object} req.body - Campos a actualizar
 * @returns {Object} 200 - Loop actualizado
 * @returns {Object} 404 - Loop o experimento no encontrado
 * @returns {Object} 500 - Error del servidor
 */
router.patch("/api/loop/:experimentID/:id", async (req, res) => {
  try {
    const { experimentID, id } = req.params;
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

    const loopIndex = experimentDoc.loops.findIndex((l) => l.id === id);

    if (loopIndex === -1) {
      return res.status(404).json({ success: false, error: "Loop not found" });
    }

    // Actualizar loop
    experimentDoc.loops[loopIndex] = {
      ...experimentDoc.loops[loopIndex],
      ...updates,
      id, // Preservar ID
      updatedAt: new Date().toISOString(),
    };

    // Si cambió el nombre, branches o trials, actualizar timeline
    if (
      updates.name ||
      updates.branches !== undefined ||
      updates.trials !== undefined
    ) {
      const timelineIndex = experimentDoc.timeline.findIndex(
        (item) => item.id === id && item.type === "loop",
      );
      if (timelineIndex !== -1) {
        if (updates.name) {
          experimentDoc.timeline[timelineIndex].name = updates.name;
        }
        if (updates.branches !== undefined) {
          experimentDoc.timeline[timelineIndex].branches = updates.branches;
        }
        if (updates.trials !== undefined) {
          // Actualizar el array de trials del loop en el timeline
          experimentDoc.timeline[timelineIndex].trials = updates.trials;

          // Remover trials del timeline que ahora están en el loop
          const loopTrialIds = updates.trials;
          experimentDoc.timeline = experimentDoc.timeline.filter(
            (item) =>
              !(item.type === "trial" && loopTrialIds.includes(item.id)),
          );
        }
      }
    }

    experimentDoc.updatedAt = new Date().toISOString();

    await db.write();

    res.json({ success: true, loop: experimentDoc.loops[loopIndex] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Elimina un loop y restaura sus trials al timeline.
 * Los trials se reinsertan en la posición donde estaba el loop.
 * Actualiza branches que referencian al loop.
 * @route DELETE /api/loop/:experimentID/:id
 * @param {string} experimentID - ID del experimento
 * @param {string} id - ID del loop
 * @returns {Object} 200 - Loop eliminado
 * @returns {Object} 404 - Experimento no encontrado
 * @returns {Object} 500 - Error del servidor
 */
router.delete("/api/loop/:experimentID/:id", async (req, res) => {
  try {
    const { experimentID, id } = req.params;

    await db.read();

    const experimentDoc = db.data.trials.find(
      (t) => t.experimentID === experimentID,
    );

    if (!experimentDoc) {
      return res
        .status(404)
        .json({ success: false, error: "Experiment not found" });
    }

    // Encontrar el loop antes de eliminarlo para obtener sus trials y branches
    const loopToDelete = experimentDoc.loops.find((l) => l.id === id);

    if (!loopToDelete) {
      return res.status(404).json({ success: false, error: "Loop not found" });
    }

    // Encontrar la posición del loop en el timeline
    const loopIndex = experimentDoc.timeline.findIndex(
      (item) => item.id === id && item.type === "loop",
    );

    // ========== BORRADO INTELIGENTE: RECONECTAR ESTRUCTURA DEL LOOP ==========
    // Estrategia:
    // 1. El PRIMER trial/loop del contenido se conecta con los padres
    // 2. La estructura INTERNA del loop se mantiene intacta
    // 3. Los BRANCHES del loop se conectan con el ÚLTIMO item de la cadena interna

    const firstTrialId = loopToDelete.trials?.[0] || null;
    const loopBranches = loopToDelete.branches || [];

    // Paso 1: Reconectar padres con el PRIMER trial del loop
    if (firstTrialId) {
      experimentDoc.trials.forEach((trial) => {
        if (trial.branches && trial.branches.includes(id)) {
          // Reemplazar el loop con el primer trial del loop
          trial.branches = trial.branches.map((branchId) =>
            branchId === id ? firstTrialId : branchId,
          );
        }
      });

      experimentDoc.loops.forEach((loop) => {
        if (loop.branches && loop.branches.includes(id)) {
          // Reemplazar el loop con el primer trial del loop
          loop.branches = loop.branches.map((branchId) =>
            branchId === id ? firstTrialId : branchId,
          );
        }
      });
    } else {
      // Si el loop está vacío, simplemente remover referencias
      experimentDoc.trials.forEach((trial) => {
        if (trial.branches && trial.branches.includes(id)) {
          trial.branches = trial.branches.filter((branchId) => branchId !== id);
        }
      });

      experimentDoc.loops.forEach((loop) => {
        if (loop.branches && loop.branches.includes(id)) {
          loop.branches = loop.branches.filter((branchId) => branchId !== id);
        }
      });
    }

    // Paso 2: Conectar los branches del loop con el ÚLTIMO item de la cadena interna
    // Solo si el loop tiene branches
    if (loopBranches.length > 0 && loopToDelete.trials) {
      // Función helper para encontrar los últimos items (items que no son padres de otros)
      const findLastItems = (trialIds) => {
        const lastItems = [];

        for (const trialId of trialIds) {
          // Verificar si este trial es padre de algún otro trial dentro del loop
          const trial = experimentDoc.trials.find((t) => t.id === trialId);
          const nestedLoop = experimentDoc.loops.find((l) => l.id === trialId);

          const itemBranches = trial?.branches || nestedLoop?.branches || [];

          // Verificar si alguno de sus branches está dentro del loop
          const hasBranchesInsideLoop = itemBranches.some((branchId) =>
            trialIds.includes(branchId),
          );

          // Si no tiene branches dentro del loop, es un item final
          if (!hasBranchesInsideLoop) {
            lastItems.push(trialId);
          }
        }

        return lastItems.length > 0 ? lastItems : [trialIds[0]];
      };

      const lastItems = findLastItems(loopToDelete.trials);

      // Conectar al ÚLTIMO último item con los branches del loop
      // (evita crear múltiples padres para el mismo branch)
      if (lastItems.length > 0) {
        const lastLastItemId = lastItems[lastItems.length - 1];

        const trial = experimentDoc.trials.find((t) => t.id === lastLastItemId);
        if (trial) {
          // Agregar los branches del loop al trial final (evitar duplicados)
          const currentBranches = trial.branches || [];
          loopBranches.forEach((branchId) => {
            if (!currentBranches.includes(branchId)) {
              currentBranches.push(branchId);
            }
          });
          trial.branches = currentBranches;
        }

        const loop = experimentDoc.loops.find((l) => l.id === lastLastItemId);
        if (loop) {
          // Agregar los branches del loop al loop final (evitar duplicados)
          const currentBranches = loop.branches || [];
          loopBranches.forEach((branchId) => {
            if (!currentBranches.includes(branchId)) {
              currentBranches.push(branchId);
            }
          });
          loop.branches = currentBranches;
        }
      }
    }
    // ========== FIN BORRADO INTELIGENTE ==========

    // Eliminar loop del array
    experimentDoc.loops = experimentDoc.loops.filter((l) => l.id !== id);

    // Eliminar del timeline
    experimentDoc.timeline = experimentDoc.timeline.filter(
      (item) => !(item.id === id && item.type === "loop"),
    );

    // Restaurar TODOS los trials/loops que tienen este parentLoopId
    // (no solo los que están en loop.trials, porque pueden haber branches internos)
    if (loopIndex !== -1) {
      const trialsToInsert = [];

      // Buscar TODOS los trials que tienen este loop como padre
      experimentDoc.trials.forEach((trial) => {
        if (trial.parentLoopId === id) {
          // Limpiar parentLoopId del trial
          trial.parentLoopId = null;
          trialsToInsert.push({
            id: trial.id,
            type: "trial",
            name: trial.name,
            branches: trial.branches || [],
          });
        }
      });

      // Buscar TODOS los nested loops que tienen este loop como padre
      experimentDoc.loops.forEach((loop) => {
        if (loop.parentLoopId === id) {
          // IMPORTANTE: Limpiar parentLoopId del loop nested
          // porque su padre acaba de ser borrado
          loop.parentLoopId = null;
          trialsToInsert.push({
            id: loop.id,
            type: "loop",
            name: loop.name,
            branches: loop.branches || [],
            trials: loop.trials || [],
            // Asegurar que el timeline item tampoco tenga parentLoopId
            parentLoopId: undefined,
          });
        }
      });

      // Insertar en la posición original del loop
      if (trialsToInsert.length > 0) {
        experimentDoc.timeline.splice(loopIndex, 0, ...trialsToInsert);
      }
    }

    // Actualizar timeline con los branches actualizados
    experimentDoc.timeline.forEach((item) => {
      if (item.type === "trial") {
        const trial = experimentDoc.trials.find((t) => t.id === item.id);
        if (trial) {
          item.branches = trial.branches || [];
        }
      } else if (item.type === "loop") {
        const loop = experimentDoc.loops.find((l) => l.id === item.id);
        if (loop) {
          item.branches = loop.branches || [];
        }
      }
    });

    experimentDoc.updatedAt = new Date().toISOString();

    await db.write();

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Actualiza el orden del timeline (drag & drop).
 * @route PATCH /api/timeline/:experimentID
 * @param {string} experimentID - ID del experimento
 * @param {Object} req.body - Nuevo timeline
 * @param {Array} req.body.timeline - Array con nuevo orden de items
 * @returns {Object} 200 - Timeline actualizado
 * @returns {Object} 404 - Experimento no encontrado
 * @returns {Object} 500 - Error del servidor
 */
router.patch("/api/timeline/:experimentID", async (req, res) => {
  try {
    const { experimentID } = req.params;
    const { timeline } = req.body;

    await db.read();

    const experimentDoc = db.data.trials.find(
      (t) => t.experimentID === experimentID,
    );

    if (!experimentDoc) {
      return res
        .status(404)
        .json({ success: false, error: "Experiment not found" });
    }

    // Actualizar timeline
    experimentDoc.timeline = timeline;
    experimentDoc.updatedAt = new Date().toISOString();

    await db.write();

    res.json({ success: true, timeline });
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

/**
 * Obtiene todos los nombres de trials/loops para validar unicidad.
 * @route GET /api/timeline-names/:experimentID
 * @param {string} experimentID - ID del experimento
 * @returns {Object} 200 - Nombres existentes
 * @returns {string[]} 200.names - Array de nombres
 * @returns {Object} 500 - Error del servidor
 */
router.get("/api/timeline-names/:experimentID", async (req, res) => {
  try {
    await db.read();
    const { experimentID } = req.params;

    const experimentDoc = db.data.trials.find(
      (t) => t.experimentID === experimentID,
    );

    if (!experimentDoc) {
      return res.json({ names: [] });
    }

    // Recolectar nombres de trials top-level
    const trialNames = experimentDoc.trials.map((trial) => trial.name);

    // Recolectar nombres de trials dentro de loops
    const loopTrialNames = experimentDoc.loops.flatMap((loop) => {
      return loop.trials
        .map((trialId) => {
          const trial = experimentDoc.trials.find((t) => t.id === trialId);
          return trial ? trial.name : null;
        })
        .filter(Boolean);
    });

    const allNames = [...trialNames, ...loopTrialNames];

    res.json({ names: allNames });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Valida si un item es ancestro de otro (previene ciclos circulares).
 * Recorre recursivamente los branches para detectar dependencias.
 * @route GET /api/validate-ancestor/:experimentID
 * @param {string} experimentID - ID del experimento
 * @param {string} source - ID del posible ancestro (query param)
 * @param {string} target - ID del item a validar (query param)
 * @returns {Object} 200 - Resultado de validación
 * @returns {boolean} 200.isAncestor - true si source es ancestro de target
 * @returns {Object} 500 - Error del servidor
 */
router.get("/api/validate-ancestor/:experimentID", async (req, res) => {
  try {
    await db.read();
    const { experimentID } = req.params;
    const { source, target } = req.query;

    const experimentDoc = db.data.trials.find(
      (t) => t.experimentID === experimentID,
    );

    if (!experimentDoc) {
      return res.json({ isAncestor: false });
    }

    // Función auxiliar para encontrar item por id
    const findItemById = (id) => {
      const numId =
        typeof id === "string" && !id.startsWith("loop_") ? parseInt(id) : id;

      if (typeof numId === "number") {
        return experimentDoc.trials.find((t) => t.id === numId);
      }
      return experimentDoc.loops.find((l) => l.id === numId);
    };

    // Verificar si sourceId es ancestro de targetId
    const isAncestor = (sourceId, targetId, visited = new Set()) => {
      // Evitar loops infinitos
      if (visited.has(targetId)) {
        return false;
      }
      visited.add(targetId);

      // Si son iguales, retornar true
      if (sourceId == targetId) {
        return true;
      }

      // Encontrar el item target
      const targetItem = findItemById(targetId);
      if (!targetItem || !targetItem.branches) {
        return false;
      }

      // Verificar si sourceId está en las branches de targetId
      if (
        targetItem.branches.includes(sourceId) ||
        targetItem.branches.includes(parseInt(sourceId)) ||
        targetItem.branches.includes(String(sourceId))
      ) {
        return true;
      }

      // Recursivamente verificar todas las branches
      for (const branchId of targetItem.branches) {
        if (isAncestor(sourceId, branchId, visited)) {
          return true;
        }
      }

      return false;
    };

    const result = isAncestor(source, target);
    res.json({ isAncestor: result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Valida si una conexión (branch) entre dos items es válida.
 * Previene: auto-conexión y ciclos circulares.
 * @route GET /api/validate-connection/:experimentID
 * @param {string} experimentID - ID del experimento
 * @param {string} source - ID del item origen (query param)
 * @param {string} target - ID del item destino (query param)
 * @returns {Object} 200 - Resultado de validación
 * @returns {boolean} 200.isValid - true si la conexión es válida
 * @returns {string} [200.errorMessage] - Mensaje de error si no es válida
 * @returns {Object} 500 - Error del servidor
 */
router.get("/api/validate-connection/:experimentID", async (req, res) => {
  try {
    await db.read();
    const { experimentID } = req.params;
    const { source, target } = req.query;

    // No puede conectarse a sí mismo
    if (source == target) {
      return res.json({
        isValid: false,
        errorMessage: "Cannot connect a trial to itself",
      });
    }

    const experimentDoc = db.data.trials.find(
      (t) => t.experimentID === experimentID,
    );

    if (!experimentDoc) {
      return res.json({ isValid: true });
    }

    // Función auxiliar para encontrar item por id
    const findItemById = (id) => {
      const numId =
        typeof id === "string" && !id.startsWith("loop_") ? parseInt(id) : id;

      if (typeof numId === "number") {
        return experimentDoc.trials.find((t) => t.id === numId);
      }
      return experimentDoc.loops.find((l) => l.id === numId);
    };

    // Verificar si sourceId es ancestro de targetId
    const isAncestor = (sourceId, targetId, visited = new Set()) => {
      if (visited.has(targetId)) {
        return false;
      }
      visited.add(targetId);

      if (sourceId == targetId) {
        return true;
      }

      const targetItem = findItemById(targetId);
      if (!targetItem || !targetItem.branches) {
        return false;
      }

      if (
        targetItem.branches.includes(sourceId) ||
        targetItem.branches.includes(parseInt(sourceId)) ||
        targetItem.branches.includes(String(sourceId))
      ) {
        return true;
      }

      for (const branchId of targetItem.branches) {
        if (isAncestor(sourceId, branchId, visited)) {
          return true;
        }
      }

      return false;
    };

    // Verificar si target es ancestro de source (crearía un ciclo)
    if (isAncestor(target, source)) {
      return res.json({
        isValid: false,
        errorMessage:
          "Cannot connect to an ancestor trial (would create a circular dependency)",
      });
    }

    res.json({ isValid: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
