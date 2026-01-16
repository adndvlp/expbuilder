/**
 * @fileoverview Manages experiment session results.
 * Allows creating sessions, appending results, completing sessions,
 * downloading data as CSV, and managing online session metadata.
 * @module routes/results
 */

import { Router } from "express";
import { db } from "../utils/db.js";
import { Parser } from "json2csv";
const router = Router();

/**
 * Creates a new experiment session (no data yet).
 * @route POST /api/append-result/:experimentID
 * @param {string} experimentID - Experiment ID
 * @param {Object} req.body - Session data
 * @param {string} req.body.sessionId - Unique session ID
 * @param {Object} [req.body.metadata] - Metadata (browser, OS, etc.)
 * @returns {Object} 200 - Session created
 * @returns {boolean} 200.success - Indicates success
 * @returns {string} 200.id - Session ID
 * @returns {number} 200.participantNumber - Participant number
 * @returns {Object} 400 - sessionId required
 * @returns {Object} 409 - Session already exists
 * @returns {Object} 500 - Server error
 */
router.post("/api/append-result/:experimentID", async (req, res) => {
  try {
    let { sessionId } = req.body;
    if (!sessionId)
      return res
        .status(400)
        .json({ success: false, error: "sessionId required" });

    await db.read();
    // Only create if it doesn't exist
    let existing = db.data.sessionResults.find(
      (s) =>
        s.experimentID === req.params.experimentID && s.sessionId === sessionId
    );
    if (existing) {
      return res
        .status(409)
        .json({ success: false, error: "Session already exists" });
    }

    const { metadata } = req.body;

    const created = {
      experimentID: req.params.experimentID,
      sessionId,
      createdAt: new Date().toISOString(),
      data: [],
      state: "initiated",
      lastUpdate: new Date().toISOString(),
      metadata: metadata || {},
    };
    db.data.sessionResults.push(created);
    await db.write();

    // Get participantNumber
    const sessions = db.data.sessionResults
      .filter((s) => s.experimentID === req.params.experimentID)
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    const participantNumber =
      sessions.findIndex((s) => s.sessionId === sessionId) + 1;

    res.json({ success: true, id: sessionId, participantNumber });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Appends a result (trial response) to an existing session.
 * @route PUT /api/append-result/:experimentID
 * @param {string} experimentID - Experiment ID
 * @param {Object} req.body - Result data
 * @param {string} req.body.sessionId - Session ID
 * @param {Object|string} req.body.response - Trial data (JSON)
 * @returns {Object} 200 - Result appended
 * @returns {boolean} 200.success - Indicates success
 * @returns {string} 200.id - Session ID
 * @returns {number} 200.participantNumber - Participant number
 * @returns {Object} 400 - Missing parameters
 * @returns {Object} 404 - Session not found
 * @returns {Object} 500 - Server error
 */
router.put("/api/append-result/:experimentID", async (req, res) => {
  try {
    let { sessionId, response } = req.body;
    if (!sessionId || !response)
      return res
        .status(400)
        .json({ success: false, error: "sessionId and response required" });

    if (typeof response === "string") response = JSON.parse(response);

    await db.read();
    // Solo añadir si existe
    let existing = db.data.sessionResults.find(
      (s) =>
        s.experimentID === req.params.experimentID && s.sessionId === sessionId
    );
    if (!existing) {
      return res
        .status(404)
        .json({ success: false, error: "Session not found" });
    }

    existing.data.push(response);
    existing.state = "in-progress";
    existing.lastUpdate = new Date().toISOString();
    await db.write();

    // Obtener participantNumber
    const sessions = db.data.sessionResults
      .filter((s) => s.experimentID === req.params.experimentID)
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    const participantNumber =
      sessions.findIndex((s) => s.sessionId === sessionId) + 1;

    res.json({ success: true, id: sessionId, participantNumber });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Obtiene metadata de todas las sesiones (sin datos completos).
 * @route GET /api/session-results/:experimentID
 * @param {string} experimentID - ID del experimento
 * @returns {Object} 200 - Lista de sesiones
 * @returns {Object[]} 200.sessions - Metadata de sesiones (sin campo data)
 * @returns {string} 200.sessions[].sessionId - ID de la sesión
 * @returns {string} 200.sessions[].state - Estado: "initiated"|"in-progress"|"completed"
 * @returns {string} 200.sessions[].createdAt - Fecha de creación
 * @returns {string} 200.sessions[].lastUpdate - Última actualización
 * @returns {Object} 200.sessions[].metadata - Metadata del navegador
 * @returns {Object} 500 - Error del servidor
 */
router.get("/api/session-results/:experimentID", async (req, res) => {
  try {
    await db.read();
    const sessions = db.data.sessionResults
      .filter((s) => s.experimentID === req.params.experimentID)
      .map(({ data, ...session }) => session) // Excluir data
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json({ sessions });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Descarga los datos de una sesión en formato CSV.
 * Incluye metadata del navegador en cada fila del CSV.
 * @route GET /api/download-session/:sessionId/:experimentID
 * @param {string} sessionId - ID de la sesión
 * @param {string} experimentID - ID del experimento
 * @returns {File} 200 - Archivo CSV con datos de la sesión
 * @returns {string} 400 - No hay datos para exportar
 * @returns {string} 404 - Sesión no encontrada
 * @returns {string} 500 - Error generando CSV
 */
router.get(
  "/api/download-session/:sessionId/:experimentID",
  async (req, res) => {
    try {
      const { sessionId } = req.params;

      await db.read();
      // 1. Buscar el documento
      const doc = db.data.sessionResults.find(
        (s) =>
          s.experimentID === req.params.experimentID &&
          s.sessionId === sessionId
      );
      if (!doc) return res.status(404).send("Session not found");

      // 2. Filtrar si es necesario
      // const filteredData = doc.data.filter((row) => row.trial_type !== "preload");
      const filteredData = doc.data;

      if (!filteredData.length)
        return res.status(400).send("No valid data to export");

      // 3. Agregar metadata a cada fila
      const metadata = doc.metadata || {};
      const dataWithMetadata = filteredData.map((row) => ({
        ...row,
        // Agregar campos de metadata
        session_browser: metadata.browser || "",
        session_browser_version: metadata.browserVersion || "",
        session_os: metadata.os || "",
        session_screen_resolution: metadata.screenResolution || "",
        session_language: metadata.language || "",
        session_started_at: metadata.startedAt || "",
        session_id: sessionId,
        session_created_at: doc.createdAt || "",
        session_state: doc.state || "",
      }));

      // 4. Extraer todos los campos únicos (ahora incluye metadata)
      const allFields = Array.from(
        new Set(dataWithMetadata.flatMap((row) => Object.keys(row)))
      );

      // 5. Convertir a CSV con json2csv
      const parser = new Parser({ fields: allFields });
      const csv = parser.parse(dataWithMetadata);

      // 6. Enviar como descarga
      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="session_${sessionId}.csv"`
      );
      res.status(200).send(csv);
    } catch (err) {
      console.error("Error exporting CSV:", err);
      res.status(500).send("Error generating CSV");
    }
  }
);

/**
 * Marca una sesión como completada.
 * @route POST /api/complete-session/:experimentID
 * @param {string} experimentID - ID del experimento
 * @param {Object} req.body - Datos
 * @param {string} req.body.sessionId - ID de la sesión
 * @returns {Object} 200 - Sesión completada
 * @returns {boolean} 200.success - Indica éxito
 * @returns {Object} 400 - Falta sessionId
 * @returns {Object} 404 - Sesión no encontrada
 * @returns {Object} 500 - Error del servidor
 */
router.post("/api/complete-session/:experimentID", async (req, res) => {
  try {
    const { sessionId } = req.body;
    if (!sessionId)
      return res
        .status(400)
        .json({ success: false, error: "sessionId required" });

    await db.read();
    const existing = db.data.sessionResults.find(
      (s) =>
        s.experimentID === req.params.experimentID && s.sessionId === sessionId
    );

    if (!existing) {
      return res
        .status(404)
        .json({ success: false, error: "Session not found" });
    }

    existing.state = "completed";
    existing.lastUpdate = new Date().toISOString();
    await db.write();

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Guarda metadata de sesiones online (Firebase).
 * Usado para trackear sesiones que guardan datos en cloud pero queremos metadata local.
 * @route POST /api/save-online-session-metadata/:experimentID
 * @param {string} experimentID - ID del experimento
 * @param {Object} req.body - Datos de metadata
 * @param {string} req.body.sessionId - ID de la sesión
 * @param {Object} [req.body.metadata] - Metadata a guardar
 * @param {string} [req.body.state] - Estado de la sesión
 * @returns {Object} 200 - Metadata guardada
 * @returns {boolean} 200.success - Indica éxito
 * @returns {Object} 400 - Falta sessionId
 * @returns {Object} 500 - Error del servidor
 */
router.post(
  "/api/save-online-session-metadata/:experimentID",
  async (req, res) => {
    try {
      const { sessionId, metadata, state } = req.body;
      if (!sessionId)
        return res
          .status(400)
          .json({ success: false, error: "sessionId required" });

      await db.read();

      // Verificar si ya existe
      const existing = db.data.sessionResults.find(
        (s) =>
          s.experimentID === req.params.experimentID &&
          s.sessionId === sessionId
      );

      if (existing) {
        // Actualizar metadata y estado
        if (metadata) existing.metadata = { ...existing.metadata, ...metadata };
        if (state) existing.state = state;
        existing.lastUpdate = new Date().toISOString();
      } else {
        // Crear nueva entrada de metadata
        db.data.sessionResults.push({
          experimentID: req.params.experimentID,
          sessionId,
          createdAt: new Date().toISOString(),
          data: [], // No guardamos data, solo metadata
          state: state || "initiated",
          lastUpdate: new Date().toISOString(),
          metadata: metadata || {},
          isOnline: true, // Marcar como sesión online
        });
      }

      await db.write();
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

/**
 * Elimina una sesión y todos sus datos.
 * @route DELETE /api/session-results/:sessionId/:experimentID
 * @param {string} sessionId - ID de la sesión
 * @param {string} experimentID - ID del experimento
 * @returns {Object} 200 - Sesión eliminada
 * @returns {boolean} 200.success - Indica éxito
 * @returns {Object} 404 - Sesión no encontrada
 * @returns {Object} 500 - Error del servidor
 */
router.delete(
  "/api/session-results/:sessionId/:experimentID",
  async (req, res) => {
    try {
      await db.read();
      const sessionIndex = db.data.sessionResults.findIndex(
        (s) =>
          s.experimentID === req.params.experimentID &&
          s.sessionId === req.params.sessionId
      );

      if (sessionIndex === -1) {
        return res
          .status(404)
          .json({ success: false, error: "Session not found" });
      }

      db.data.sessionResults.splice(sessionIndex, 1);
      await db.write();

      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

export default router;
