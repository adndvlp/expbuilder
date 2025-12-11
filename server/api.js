import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import path from "path";
import cors from "cors";
import dotenv from "dotenv";

import { db, ensureDbData, userDataRoot } from "./utils/db.js";
import { __dirname } from "./utils/paths.js";

import experimentsRouter from "./routes/experiments.js";
import pluginsRouter from "./routes/plugins.js";
import filesRouter from "./routes/files.js";
import resultsRouter from "./routes/results.js";
import trialsRouter from "./routes/trials.js";
import tunnelRouter from "./routes/tunnel.js";
import configsRouter from "./routes/configs.js";
import dbRouter from "./routes/db.js";

dotenv.config({ path: path.resolve(__dirname, ".env") });

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.ORIGIN || "*",
    methods: ["GET", "POST"],
    credentials: true,
  },
});

const port = 3000;

app.use(
  cors({
    origin: `${process.env.ORIGIN}`,
    credentials: true,
  })
);

app.use(express.json({ limit: "50mb" }));

await db.read();
ensureDbData();
await db.write();

// Setup static file serving
app.use(express.static(path.join(__dirname, "dist"))); // Serve dist/ at root level
app.use(express.static(path.join(__dirname))); // Serve root directory
app.use("/plugins", express.static(path.join(userDataRoot, "plugins")));

app.use("/", experimentsRouter);
app.use("/", pluginsRouter);
app.use("/", filesRouter);
app.use("/", trialsRouter);
app.use("/", configsRouter);
app.use("/", tunnelRouter);
app.use("/", resultsRouter);
app.use("/", dbRouter);

// Socket.IO para tracking de sesiones en tiempo real
const activeSessions = new Map(); // experimentID -> Map(sessionId -> sessionData)

io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);

  socket.on(
    "join-experiment",
    async ({ experimentID, sessionId, state, metadata }) => {
      console.log(`Session joined: ${experimentID}/${sessionId}`);

      // Unirse a la sala del experimento
      socket.join(experimentID);

      // Almacenar información de la sesión
      if (!activeSessions.has(experimentID)) {
        activeSessions.set(experimentID, new Map());
      }
      const experimentSessions = activeSessions.get(experimentID);
      experimentSessions.set(sessionId, {
        sessionId,
        state: state || "initiated",
        socketId: socket.id,
        connectedAt: new Date().toISOString(),
        lastUpdate: new Date().toISOString(),
        metadata: metadata || {},
      });

      // Notificar a todos los clientes en esta sala (incluyendo ResultsList)
      io.to(experimentID).emit("session-update", {
        experimentID,
        sessions: Array.from(experimentSessions.values()),
      });

      // Guardar o actualizar estado en la base de datos
      await db.read();
      const existing = db.data.sessionResults.find(
        (s) => s.experimentID === experimentID && s.sessionId === sessionId
      );
      if (existing) {
        if (state) existing.state = state;
        if (metadata) existing.metadata = { ...existing.metadata, ...metadata };
        existing.lastUpdate = new Date().toISOString();
        await db.write();
      }
    }
  );

  socket.on(
    "update-session-state",
    async ({ experimentID, sessionId, state }) => {
      console.log(
        `Session state updated: ${experimentID}/${sessionId} -> ${state}`
      );

      if (activeSessions.has(experimentID)) {
        const experimentSessions = activeSessions.get(experimentID);
        const session = experimentSessions.get(sessionId);
        if (session) {
          session.state = state;
          session.lastUpdate = new Date().toISOString();

          // Notificar a todos en la sala
          io.to(experimentID).emit("session-update", {
            experimentID,
            sessions: Array.from(experimentSessions.values()),
          });
        }
      }

      // Actualizar en base de datos
      await db.read();
      const existing = db.data.sessionResults.find(
        (s) => s.experimentID === experimentID && s.sessionId === sessionId
      );
      if (existing) {
        existing.state = state;
        existing.lastUpdate = new Date().toISOString();
        await db.write();
      }
    }
  );

  socket.on("disconnect", async () => {
    console.log("Client disconnected:", socket.id);

    // Buscar y marcar sesión como abandonada si no completó
    for (const [experimentID, experimentSessions] of activeSessions.entries()) {
      for (const [sessionId, sessionData] of experimentSessions.entries()) {
        if (sessionData.socketId === socket.id) {
          // Solo marcar como abandonada si no está completada
          if (sessionData.state !== "completed") {
            sessionData.state = "abandoned";
            sessionData.disconnectedAt = new Date().toISOString();

            // Actualizar en base de datos
            await db.read();
            const existing = db.data.sessionResults.find(
              (s) =>
                s.experimentID === experimentID && s.sessionId === sessionId
            );
            if (existing) {
              existing.state = "abandoned";
              existing.lastUpdate = new Date().toISOString();
              await db.write();
            }

            // Notificar a ResultsList
            io.to(experimentID).emit("session-update", {
              experimentID,
              sessions: Array.from(experimentSessions.values()),
            });
          }

          // Remover de sesiones activas
          experimentSessions.delete(sessionId);
          if (experimentSessions.size === 0) {
            activeSessions.delete(experimentID);
          }
          break;
        }
      }
    }
  });

  // Evento para que ResultsList escuche actualizaciones
  socket.on("listen-experiment", (experimentID) => {
    socket.join(experimentID);

    // Enviar estado actual de sesiones activas
    if (activeSessions.has(experimentID)) {
      const experimentSessions = activeSessions.get(experimentID);
      socket.emit("session-update", {
        experimentID,
        sessions: Array.from(experimentSessions.values()),
      });
    }
  });
});

// Middleware to handle 404 errors
app.use((req, res) => {
  console.log(`404 Not Found: ${req.url}`);
  if (req.path.startsWith("/api/")) {
    res.status(404).json({ error: "API endpoint not found" });
  } else {
    res.status(404).send("This page doesn't exist.");
  }
});

// Global error handlers to prevent process exit on uncaught exceptions or unhandled rejections
process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
  // Optionally log to a file or external service, PM2
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
  // Optionally log to a file or external service
});

httpServer.listen(port, () => {
  console.log(`Server running on port ${port}`);
  console.log(`Experiment URL: http://localhost:${port}/experiment`);
  console.log(`API URL: http://localhost:${port}/api`);
  console.log(`WebSocket enabled for real-time session tracking`);
});

export { io };
