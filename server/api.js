import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import dotenv from "dotenv";

import { db, dbPath, ensureDbData, userDataRoot } from "./utils/db.js";
import { __dirname } from "./utils/paths.js";
import {
  serializeDbRequest,
  withDbLock,
} from "./modules/session-persistence/dbQueue.js";
import { createPresenceTracker } from "./modules/session-presence/presenceTracker.js";
import {
  isLocalRequest,
  originMatchesRequest,
  restrictRemoteAccess,
  socketOriginAllowed,
} from "./modules/tunnel-access/participantAccess.js";

import experimentsRouter from "./routes/experiments.js";
import pluginsRouter from "./routes/plugins.js";
import filesRouter from "./routes/files.js";
import resultsRouter from "./routes/results.js";
import trialsRouter from "./routes/timeline/index.js";
import tunnelRouter from "./routes/tunnel.js";
import configsRouter from "./routes/configs.js";
import dbRouter from "./routes/db.js";
import agentRouter from "./agent/routes.js";

dotenv.config({ path: `${__dirname}/.env` });

const app = express();
const httpServer = createServer(app);
const DEV_ORIGINS = ["http://localhost:5173", "http://localhost:5174", "http://localhost:4173", "http://localhost:3000"];
const socketOrigins = process.env.ORIGIN
  ? [process.env.ORIGIN, ...DEV_ORIGINS]
  : DEV_ORIGINS;
const io = new Server(httpServer, {
  cors: {
    origin: true,
    methods: ["GET", "POST"],
    credentials: true,
  },
  allowRequest: (req, callback) =>
    callback(null, socketOriginAllowed(req, socketOrigins)),
});

const preferredPort = Number(process.env.PORT || 3000);

app.use((req, res, next) =>
  cors({
    origin: (origin, cb) => {
      const allowed = process.env.ORIGIN
        ? [process.env.ORIGIN, ...DEV_ORIGINS]
        : DEV_ORIGINS;
      if (!origin || allowed.includes(origin) || originMatchesRequest(req, origin)) {
        return cb(null, true);
      }
      return cb(new Error(`CORS: ${origin} not allowed`));
    },
    credentials: true,
  })(req, res, next),
);

app.use(express.json({ limit: "50mb" }));
app.use(restrictRemoteAccess);

await withDbLock(async () => {
  await db.read();
  ensureDbData();
  await db.write();
});

// Serve only the assets required by local experiment HTML.
app.use("/jspsych-bundle", express.static(`${__dirname}/jspsych-bundle`));
app.use("/dynamicplugin/dist", express.static(`${__dirname}/dynamicplugin/dist`));
app.use("/icon", express.static(`${__dirname}/icon`));
app.use("/plugins", express.static(`${userDataRoot}/plugins`));
app.use(serializeDbRequest);

app.use("/", experimentsRouter);
app.use("/", pluginsRouter);
app.use("/", filesRouter);
app.use("/", trialsRouter);
app.use("/", configsRouter);
app.use("/", tunnelRouter);
app.use("/", resultsRouter);
app.use("/", dbRouter);
app.use("/", agentRouter);

// Socket.IO para tracking de sesiones en tiempo real
const presence = createPresenceTracker(io);

io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);

  socket.on("join-experiment", (payload, acknowledge) =>
    presence.join(socket, payload, acknowledge),
  );

  socket.on("update-session-state", (payload, acknowledge) =>
    presence.update(socket.id, payload, acknowledge),
  );

  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
    presence.disconnect(socket.id);
  });

  // Evento para que ResultsList escuche actualizaciones
  socket.on("listen-experiment", (experimentID, acknowledge) => {
    if (!isLocalRequest(socket.request)) {
      acknowledge?.({ success: false, error: "Listener not available remotely" });
      return;
    }
    presence.listen(socket, experimentID, acknowledge);
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
/* istanbul ignore next -- process-level safety handler is not invoked during unit tests. */
process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
  // Optionally log to a file or external service, PM2
});

/* istanbul ignore next -- process-level safety handler is not invoked during unit tests. */
process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
  // Optionally log to a file or external service
});

function listenOnAvailablePort(server, startPort, maxAttempts = 50) {
  return new Promise((resolve, reject) => {
    let port = startPort;
    const maxPort = startPort + maxAttempts - 1;

    const tryListen = () => {
      const handleError = (err) => {
        if (err?.code === "EADDRINUSE" && port < maxPort) {
          port += 1;
          tryListen();
          return;
        }
        reject(err);
      };
      if (typeof server.once === "function") {
        server.once("error", handleError);
      }
      server.listen(port, () => {
        if (typeof server.off === "function") {
          server.off("error", handleError);
        }
        resolve(port);
      });
    };

    tryListen();
  });
}

export const whenListening = listenOnAvailablePort(
  httpServer,
  preferredPort,
).then(async (port) => {
  process.env.PORT = String(port);
  process.env.API_URL = `http://localhost:${port}`;
  if (!DEV_ORIGINS.includes(`http://localhost:${port}`)) {
    DEV_ORIGINS.push(`http://localhost:${port}`);
  }
  try {
    await withDbLock(async () => {
      await db.read();
      ensureDbData();
      let changed = false;
      for (const exp of db.data.experiments) {
        if (exp.tunnelUrl) {
          delete exp.tunnelUrl;
          changed = true;
        }
      }
      if (changed) await db.write();
    });
  } catch (err) {
    console.error("Error clearing tunnel URLs on startup:", err);
  }
  console.log(`Server running on port ${port}`);
  console.info(`[session-persistence] db.json path: ${dbPath}`);
  console.log(`Experiment URL: http://localhost:${port}/experiment`);
  console.log(`API URL: http://localhost:${port}/api`);
  console.log(`WebSocket enabled for real-time session tracking`);
  return port;
});

export { io };
