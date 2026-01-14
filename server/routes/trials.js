import { Router } from "express";
import { db } from "../utils/db.js";

const router = Router();

// ==================== GET TIMELINE CODE (trialCode de trials + code de loops) ====================
router.get("/api/timeline-code/:experimentID", async (req, res) => {
  try {
    await db.read();
    const { experimentID } = req.params;

    const experimentDoc = db.data.trials.find(
      (t) => t.experimentID === experimentID
    );

    if (!experimentDoc) {
      return res.json({ codes: [] });
    }

    // Concatenar códigos de trials y loops
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

// ==================== GET TRIALS METADATA (id, type, name, branches) ====================
router.get("/api/trials-metadata/:experimentID", async (req, res) => {
  try {
    await db.read();
    const { experimentID } = req.params;

    // Buscar el documento del experimento
    const experimentDoc = db.data.trials.find(
      (t) => t.experimentID === experimentID
    );

    if (!experimentDoc) {
      return res.json({ timeline: [] });
    }

    // Construir timeline con metadata necesaria para render (id, type, name, branches)
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

// ==================== TRIAL ENDPOINTS ====================

// POST - Crear un trial
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
      (t) => t.experimentID === experimentID
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

// GET - Obtener un trial específico
router.get("/api/trial/:experimentID/:id", async (req, res) => {
  try {
    const { experimentID, id } = req.params;
    const trialId = Number(id);

    await db.read();

    const experimentDoc = db.data.trials.find(
      (t) => t.experimentID === experimentID
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

// PATCH - Actualizar un trial
router.patch("/api/trial/:experimentID/:id", async (req, res) => {
  try {
    const { experimentID, id } = req.params;
    const trialId = Number(id);
    const updates = req.body;

    await db.read();

    const experimentDoc = db.data.trials.find(
      (t) => t.experimentID === experimentID
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
        (item) => item.id === trialId && item.type === "trial"
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

// DELETE - Eliminar un trial
router.delete("/api/trial/:experimentID/:id", async (req, res) => {
  try {
    const { experimentID, id } = req.params;
    const trialId = Number(id);

    await db.read();

    const experimentDoc = db.data.trials.find(
      (t) => t.experimentID === experimentID
    );

    if (!experimentDoc) {
      return res
        .status(404)
        .json({ success: false, error: "Experiment not found" });
    }

    // Eliminar trial del array
    experimentDoc.trials = experimentDoc.trials.filter((t) => t.id !== trialId);

    // Eliminar del timeline
    experimentDoc.timeline = experimentDoc.timeline.filter(
      (item) => !(item.id === trialId && item.type === "trial")
    );

    // Eliminar referencias en loops
    experimentDoc.loops = experimentDoc.loops.map((loop) => ({
      ...loop,
      trials: loop.trials?.filter((tid) => tid !== trialId) || [],
    }));

    experimentDoc.updatedAt = new Date().toISOString();

    await db.write();

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== LOOP ENDPOINTS ====================

// POST - Crear un loop
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
      (t) => t.experimentID === experimentID
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
        (item) => !(item.type === "trial" && newLoop.trials.includes(item.id))
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
          newLoop.trials.includes(branchId)
        );
        if (hasAnyTrialFromLoop) {
          // Remover todos los trial IDs que están en el loop
          const filteredBranches = trial.branches.filter(
            (branchId) => !newLoop.trials.includes(branchId)
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
          newLoop.trials.includes(branchId)
        );
        if (hasAnyTrialFromNewLoop) {
          // Remover todos los trial IDs que están en el nuevo loop
          const filteredBranches = loop.branches.filter(
            (branchId) => !newLoop.trials.includes(branchId)
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

// GET - Obtener metadata de trials/loops dentro de un loop
router.get(
  "/api/loop-trials-metadata/:experimentID/:loopId",
  async (req, res) => {
    try {
      const { experimentID, loopId } = req.params;

      await db.read();

      const experimentDoc = db.data.trials.find(
        (t) => t.experimentID === experimentID
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
                ...nestedLoop.branches.filter((bid) => bid !== loopId)
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
  }
);

// GET - Obtener un loop específico
router.get("/api/loop/:experimentID/:id", async (req, res) => {
  try {
    const { experimentID, id } = req.params;

    await db.read();

    const experimentDoc = db.data.trials.find(
      (t) => t.experimentID === experimentID
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

// PATCH - Actualizar un loop
router.patch("/api/loop/:experimentID/:id", async (req, res) => {
  try {
    const { experimentID, id } = req.params;
    const updates = req.body;

    await db.read();

    const experimentDoc = db.data.trials.find(
      (t) => t.experimentID === experimentID
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
        (item) => item.id === id && item.type === "loop"
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
            (item) => !(item.type === "trial" && loopTrialIds.includes(item.id))
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

// DELETE - Eliminar un loop
router.delete("/api/loop/:experimentID/:id", async (req, res) => {
  try {
    const { experimentID, id } = req.params;

    await db.read();

    const experimentDoc = db.data.trials.find(
      (t) => t.experimentID === experimentID
    );

    if (!experimentDoc) {
      return res
        .status(404)
        .json({ success: false, error: "Experiment not found" });
    }

    // Encontrar el loop antes de eliminarlo para obtener sus trials
    const loopToDelete = experimentDoc.loops.find((l) => l.id === id);

    // Encontrar la posición del loop en el timeline
    const loopIndex = experimentDoc.timeline.findIndex(
      (item) => item.id === id && item.type === "loop"
    );

    // Eliminar loop del array
    experimentDoc.loops = experimentDoc.loops.filter((l) => l.id !== id);

    // Eliminar del timeline
    experimentDoc.timeline = experimentDoc.timeline.filter(
      (item) => !(item.id === id && item.type === "loop")
    );

    // Restaurar los trials en la posición donde estaba el loop
    if (loopToDelete && loopToDelete.trials && loopIndex !== -1) {
      const trialsToInsert = [];
      for (const trialId of loopToDelete.trials) {
        const trial = experimentDoc.trials.find((t) => t.id === trialId);
        if (trial) {
          trialsToInsert.push({
            id: trial.id,
            type: "trial",
            name: trial.name,
            branches: trial.branches || [],
          });
        }
      }
      // Insertar en la posición original del loop
      experimentDoc.timeline.splice(loopIndex, 0, ...trialsToInsert);
    }

    // Actualizar branches de todos los trials/loops que contenían este loop
    // Reemplazar el ID del loop por los IDs individuales de los trials que estaban en él
    if (loopToDelete && loopToDelete.trials) {
      experimentDoc.trials.forEach((trial) => {
        if (trial.branches && trial.branches.includes(id)) {
          // Remover el loop ID
          const filteredBranches = trial.branches.filter(
            (branchId) => branchId !== id
          );
          // Agregar los trial IDs que estaban en el loop
          loopToDelete.trials.forEach((trialId) => {
            if (!filteredBranches.includes(trialId)) {
              filteredBranches.push(trialId);
            }
          });
          trial.branches = filteredBranches;
        }
      });

      experimentDoc.loops.forEach((loop) => {
        if (loop.branches && loop.branches.includes(id)) {
          // Remover el loop ID
          const filteredBranches = loop.branches.filter(
            (branchId) => branchId !== id
          );
          // Agregar los trial IDs que estaban en el loop eliminado
          loopToDelete.trials.forEach((trialId) => {
            if (!filteredBranches.includes(trialId)) {
              filteredBranches.push(trialId);
            }
          });
          loop.branches = filteredBranches;
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
    }

    experimentDoc.updatedAt = new Date().toISOString();

    await db.write();

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== TIMELINE ENDPOINT ====================

// PATCH - Actualizar timeline (orden)
router.patch("/api/timeline/:experimentID", async (req, res) => {
  try {
    const { experimentID } = req.params;
    const { timeline } = req.body;

    await db.read();

    const experimentDoc = db.data.trials.find(
      (t) => t.experimentID === experimentID
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

// ==================== DELETE ALL TRIALS (cuando se borra experimento) ====================

router.delete("/api/trials/:experimentID", async (req, res) => {
  try {
    const { experimentID } = req.params;

    await db.read();

    // Eliminar el documento completo del experimento
    db.data.trials = db.data.trials.filter(
      (t) => t.experimentID !== experimentID
    );

    await db.write();

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== GET ALL TRIAL NAMES (para validación de nombres únicos) ====================
router.get("/api/timeline-names/:experimentID", async (req, res) => {
  try {
    await db.read();
    const { experimentID } = req.params;

    const experimentDoc = db.data.trials.find(
      (t) => t.experimentID === experimentID
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

// ==================== VALIDATE ANCESTOR (previene ciclos circulares) ====================
router.get("/api/validate-ancestor/:experimentID", async (req, res) => {
  try {
    await db.read();
    const { experimentID } = req.params;
    const { source, target } = req.query;

    const experimentDoc = db.data.trials.find(
      (t) => t.experimentID === experimentID
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

// ==================== VALIDATE CONNECTION (valida que una conexión sea válida) ====================
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
      (t) => t.experimentID === experimentID
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
