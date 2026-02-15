/**
 * @fileoverview Manages trials and loops with normalized architecture.
 * Implements a flat storage system where trials and loops are stored
 * separately but linked via IDs. Allows CRUD operations on trials,
 * loops, timeline, and branch management (conditional connections).
 * @module routes/trials
 * @see {@link file://CAMBIOS_NORMALIZACION.md} For refactoring details
 */

import trialsRouter from "./trials.js";
import loopsRouter from "./loops.js";
import { Router } from "express";
import { db } from "../../utils/db.js";

const router = Router();
router.use(trialsRouter);
router.use(loopsRouter);

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
