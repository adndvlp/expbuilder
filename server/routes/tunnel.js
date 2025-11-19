import { Router } from "express";
import path from "path";
import os from "os";
import { spawn } from "child_process";
import { __dirname } from "../utils/paths.js";

const router = Router();

function getCloudflaredPath() {
  const baseDir = path.join(__dirname, "cloudflared");
  if (os.platform() === "darwin") {
    // MacOS: selecciona el binario correcto según la arquitectura
    if (os.arch() === "arm64") {
      return path.join(baseDir, "cloudflared-darwin-arm64");
    } else {
      return path.join(baseDir, "cloudflared-darwin-amd64");
    }
  } else if (os.platform() === "win32") {
    // Windows
    return path.join(baseDir, "cloudflared-windows-amd64.exe");
  } else if (os.platform() === "linux") {
    // Linux
    return path.join(baseDir, "cloudflared-linux-amd64");
  } else {
    throw new Error("Unsupported OS for cloudflared");
  }
}

let tunnelProcess = null;

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
      // No matamos el proceso aquí, solo limpiamos el timeout
    }

    function handleTunnelOutput(data) {
      if (responded) return;
      const output = data.toString();
      const match = output.match(urlRegex);
      if (match && !tunnelUrl) {
        tunnelUrl = `${match[0]}`;
        responded = true;
        cleanup();
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

router.post("/api/close-tunnel", (req, res) => {
  if (tunnelProcess) {
    tunnelProcess.kill();
    tunnelProcess = null;
    return res.json({ success: true, message: "Tunnel closed" });
  } else {
    return res
      .status(400)
      .json({ success: false, message: "No active tunnel" });
  }
});

export default router;
