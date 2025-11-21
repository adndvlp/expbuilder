import express from "express";
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

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
  console.log(`Experiment URL: http://localhost:${port}/experiment`);
  console.log(`API URL: http://localhost:${port}/api`);
});
