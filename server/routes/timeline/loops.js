import { Router } from "express";
import { db } from "../../utils/db.js";

const router = Router();

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

export default router;
