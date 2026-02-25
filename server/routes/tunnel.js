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
  const baseDir = path.join(__dirname, "cloudflared");
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
  const maxAttempts = 3;
  const timeoutMs = 10000; // 10 seconds
  const urlRegex = /https?:\/\/(.*?)\.trycloudflare\.com/;
  let attempt = 0;
  let responded = false;

  async function tryCreateTunnel() {
    attempt++;
    const cloudflaredPath = getCloudflaredPath();
    tunnelProcess = spawn(cloudflaredPath, [
      "tunnel",
      "--url",
      "http://localhost:3000",
      "--no-autoupdate",
    ]);

    let tunnelUrl = null;
    let timeoutId = null;

    function cleanup() {
      if (timeoutId) clearTimeout(timeoutId);
      // We don't kill the process here, just clear the timeout
    }

    function handleTunnelOutput(data) {
      if (responded) return;
      const output = data.toString();
      const match = output.match(urlRegex);
      if (match && !tunnelUrl) {
        tunnelUrl = `${match[0]}`;
        responded = true;
        cleanup();
        // Persist tunnelUrl in the experiment document
        const experimentID = req.body?.experimentID;
        if (experimentID) {
          db.read()
            .then(() => {
              ensureDbData();
              const exp = db.data.experiments.find(
                (e) => e.experimentID === experimentID,
              );
              if (exp) {
                exp.tunnelUrl = tunnelUrl;
                exp.updatedAt = new Date().toISOString();
                db.write().catch(console.error);
              }
            })
            .catch(console.error);
        }
        res.json({ success: true, url: tunnelUrl });
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
          // Retry
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
  if (tunnelProcess) {
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
  } else {
    return res
      .status(400)
      .json({ success: false, message: "No active tunnel" });
  }
});

export default router;
