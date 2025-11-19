import { Router } from "express";
import { db } from "../utils/db.js";
import { Parser } from "json2csv";
const router = Router();

router.post("/api/append-result/:experimentID", async (req, res) => {
  try {
    let { sessionId } = req.body;
    if (!sessionId)
      return res
        .status(400)
        .json({ success: false, error: "sessionId required" });

    await db.read();
    // Solo crear si no existe
    let existing = db.data.sessionResults.find(
      (s) =>
        s.experimentID === req.params.experimentID && s.sessionId === sessionId
    );
    if (existing) {
      return res
        .status(409)
        .json({ success: false, error: "Session already exists" });
    }

    const created = {
      experimentID: req.params.experimentID,
      sessionId,
      createdAt: new Date().toISOString(),
      data: [],
    };
    db.data.sessionResults.push(created);
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

// Endpoint para obtener los resultados de una sesión
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

      // 3. Extraer todos los campos únicos
      const allFields = Array.from(
        new Set(filteredData.flatMap((row) => Object.keys(row)))
      );

      // 4. Convertir a CSV con json2csv
      const parser = new Parser({ fields: allFields });
      const csv = parser.parse(filteredData);

      // 5. Enviar como descarga
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
