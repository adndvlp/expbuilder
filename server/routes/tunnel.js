/**
 * @fileoverview Manages Cloudflare tunnels for experiment sharing.
 * Allows creating and closing temporary tunnels using cloudflared.
 * @module routes/tunnel
 */

import { Router } from "express";
import path from "path";
import os from "os";
import fs from "fs";
import { spawn } from "child_process";
import { __dirname } from "../utils/paths.js";
import { db, ensureDbData } from "../utils/db.js";

const router = Router();

/**
 * Gets the path to the cloudflared binary based on OS and architecture.
 * @private
 * @returns {string} Absolute path to cloudflared binary
 * @throws {Error} If OS is not supported
 */
function getCloudflaredPath() {
  const isProduction = process.env.NODE_ENV === "production";
  const baseDir = isProduction
    ? path.join(process.resourcesPath, "cloudflared")
    : path.join(__dirname, "cloudflared");
  const platform = os.platform();
  const arch = os.arch();

  let binaryName;
  if (platform === "darwin") {
    binaryName =
      arch === "arm64"
        ? "cloudflared-darwin-arm64"
        : "cloudflared-darwin-amd64";
  } else if (platform === "win32") {
    binaryName =
      arch === "arm64"
        ? "cloudflared-windows-arm64.exe"
        : "cloudflared-windows-amd64.exe";
  } else if (platform === "linux") {
    binaryName =
      arch === "arm64" ? "cloudflared-linux-arm64" : "cloudflared-linux-amd64";
  } else {
    throw new Error(`Unsupported OS: ${platform}`);
  }

  const binaryPath = path.join(baseDir, binaryName);
  if (!fs.existsSync(binaryPath)) {
    throw new Error(
      `cloudflared binary not found at: ${binaryPath}\n` +
        `OS: ${platform}, Arch: ${arch}\n` +
        `Download the correct binary from https://github.com/cloudflare/cloudflared/releases and place it in the 'server/cloudflared/' folder as '${binaryName}'.`,
    );
  }
  return binaryPath;
}

let tunnelProcess = null;

// ─── Tunnel Settings ─────────────────────────────────────────────────────────

/**
 * Returns the tunnelSettings object for an experiment from the DB.
 * Creates the field with defaults if missing.
 * @private
 */
async function getTunnelSettings(experimentID) {
  await db.read();
  ensureDbData();
  const exp = db.data.experiments.find((e) => e.experimentID === experimentID);
  if (!exp) return null;
  exp.tunnelSettings ||= {
    hostname: "",
    persistent: false,
  };
  return exp.tunnelSettings;
}

/**
 * Loads the tunnel settings for an experiment.
 * @route GET /api/tunnel-settings/:experimentID
 */
router.get("/api/tunnel-settings/:experimentID", async (req, res) => {
  try {
    const settings = await getTunnelSettings(req.params.experimentID);
    if (!settings)
      return res
        .status(404)
        .json({ success: false, error: "Experiment not found" });
    res.json({ success: true, settings });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Saves the tunnel settings for an experiment.
 * @route PUT /api/tunnel-settings/:experimentID
 * @body {string} hostname  - Custom hostname (empty = use quick tunnel)
 * @body {boolean} persistent - Keep tunnel running across restarts
 */
router.put("/api/tunnel-settings/:experimentID", async (req, res) => {
  const { hostname = "", persistent = false } = req.body || {};
  try {
    await db.read();
    ensureDbData();
    const exp = db.data.experiments.find(
      (e) => e.experimentID === req.params.experimentID,
    );
    if (!exp)
      return res
        .status(404)
        .json({ success: false, error: "Experiment not found" });
    const norm = hostname
      .replace(/^https?:\/\//, "")
      .replace(/\/$/, "")
      .trim();
    exp.tunnelSettings = {
      hostname: norm,
      persistent: !!persistent,
    };
    exp.updatedAt = new Date().toISOString();
    await db.write();
    res.json({ success: true, settings: exp.tunnelSettings });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── Auto-start persistent tunnels on server boot ────────────────────────────
// Runs after the event-loop tick so the DB is ready.
setImmediate(async () => {
  try {
    await db.read();
    ensureDbData();
    for (const exp of db.data.experiments) {
      const s = exp.tunnelSettings;
      if (!s || !s.persistent) continue;

      if (!s.hostname) continue;
      if (tunnelProcess) continue; // only one tunnel at a time for now
      console.log(
        `[tunnel] Auto-starting cloudflared tunnel for ${exp.experimentID} → ${s.hostname}`,
      );
      const cloudflaredPath = getCloudflaredPath();
      tunnelProcess = spawn(cloudflaredPath, [
        "tunnel",
        "--hostname",
        s.hostname,
        "--url",
        "http://localhost:3000",
        "--no-autoupdate",
      ]);
      tunnelProcess.stderr.on("data", (d) => process.stderr.write(d));
      tunnelProcess.stdout.on("data", (d) => process.stdout.write(d));
      tunnelProcess.on("exit", () => {
        tunnelProcess = null;
      });
      exp.tunnelUrl = `https://${s.hostname}`;
      exp.updatedAt = new Date().toISOString();
    }
    await db.write();
  } catch (err) {
    console.error("[tunnel] Auto-start error:", err.message);
  }
});

/**
 * Creates a Cloudflare tunnel to share the local server.
 * Attempts to retrieve tunnel URL (*.trycloudflare.com) up to 3 times.
 * Keeps the process running in the background.
 * @route POST /api/create-tunnel
 * @returns {Object} 200 - Tunnel successfully created
 * @returns {boolean} 200.success - Indicates success
 * @returns {string} 200.url - Public tunnel URL (e.g., "https://abc.trycloudflare.com")
 * @returns {Object} 500 - Error starting cloudflared
 * @returns {Object} 504 - Timeout: URL not retrieved after 3 attempts
 */
router.post("/api/create-tunnel", async (req, res) => {
  const { experimentID } = req.body || {};

  // ── cloudflared branch ─────────────────────────────────────────────────────
  const maxAttempts = 3;
  const timeoutMs = 10000; // 10 seconds
  const quickTunnelRegex = /https?:\/\/(.*?)\.trycloudflare\.com/;

  // Resolve hostname: prefer DB settings, fall back to request body
  let resolvedHostname = (req.body?.hostname || "")
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "")
    .trim();

  if (!resolvedHostname && experimentID) {
    const settings = await getTunnelSettings(experimentID).catch(() => null);
    if (settings?.hostname) resolvedHostname = settings.hostname;
  }

  const customHostname = resolvedHostname || null;
  const customTunnelUrl = customHostname ? `https://${customHostname}` : null;
  let attempt = 0;
  let responded = false;

  async function persistTunnelUrl(url) {
    if (!experimentID) return;
    try {
      await db.read();
      ensureDbData();
      const exp = db.data.experiments.find(
        (e) => e.experimentID === experimentID,
      );
      if (exp) {
        exp.tunnelUrl = url;
        exp.updatedAt = new Date().toISOString();
        await db.write();
      }
    } catch (err) {
      console.error("Error persisting tunnelUrl:", err);
    }
  }

  async function tryCreateTunnel() {
    attempt++;
    const cloudflaredPath = getCloudflaredPath();
    const args = [
      "tunnel",
      "--url",
      "http://localhost:3000",
      "--no-autoupdate",
    ];
    if (customHostname) {
      args.push("--hostname", customHostname);
    }
    tunnelProcess = spawn(cloudflaredPath, args);

    let tunnelUrl = null;
    let timeoutId = null;

    function cleanup() {
      if (timeoutId) clearTimeout(timeoutId);
    }

    function respondWithUrl(url) {
      tunnelUrl = url;
      responded = true;
      cleanup();
      persistTunnelUrl(url);
      res.json({ success: true, url });
    }

    function handleTunnelOutput(data) {
      if (responded) return;
      const output = data.toString();

      if (customTunnelUrl) {
        // Custom hostname: respond once cloudflared reports a registered connection
        if (
          /registered tunnel connection|connection registered|started tunnel|serving/i.test(
            output,
          )
        ) {
          respondWithUrl(customTunnelUrl);
        }
      } else {
        // Quick tunnel: detect the random *.trycloudflare.com URL from output
        const match = output.match(quickTunnelRegex);
        if (match && !tunnelUrl) {
          respondWithUrl(`${match[0]}`);
        }
      }
    }

    tunnelProcess.stdout.on("data", handleTunnelOutput);
    tunnelProcess.stderr.on("data", handleTunnelOutput);

    tunnelProcess.on("error", (err) => {
      if (!responded) {
        responded = true;
        cleanup();
        res.status(500).json({ success: false, error: err.message });
      }
    });

    timeoutId = setTimeout(() => {
      if (!responded) {
        cleanup();
        if (attempt < maxAttempts) {
          tryCreateTunnel();
        } else {
          responded = true;
          res.status(504).json({
            success: false,
            error: `Could not obtain the tunnel URL after ${maxAttempts} attempts.`,
          });
        }
      }
    }, timeoutMs);
  }

  tryCreateTunnel();
});

/**
 * Cierra el túnel de Cloudflare activo.
 * @route POST /api/close-tunnel
 * @returns {Object} 200 - Túnel cerrado exitosamente
 * @returns {boolean} 200.success - Indica éxito
 * @returns {string} 200.message - Mensaje de confirmación
 * @returns {Object} 400 - No hay túnel activo
 */
router.post("/api/close-tunnel", async (req, res) => {
  const { experimentID } = req.body || {};
  if (!tunnelProcess) {
    return res
      .status(400)
      .json({ success: false, message: "No active tunnel" });
  }

  tunnelProcess.kill();
  tunnelProcess = null;

  // Clear tunnelUrl from the experiment document
  if (experimentID) {
    try {
      await db.read();
      ensureDbData();
      const exp = db.data.experiments.find(
        (e) => e.experimentID === experimentID,
      );
      if (exp) {
        delete exp.tunnelUrl;
        exp.updatedAt = new Date().toISOString();
        await db.write();
      }
    } catch (err) {
      console.error("Error clearing tunnelUrl from experiment:", err);
    }
  }
  return res.json({ success: true, message: "Tunnel closed" });
});

export default router;
