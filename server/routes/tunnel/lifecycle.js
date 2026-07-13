import { spawn } from "child_process";
import { Router } from "express";
import { db, ensureDbData } from "../../utils/db.js";
import { getTunnelSettings } from "./settings.js";
import {
  clearTunnelProcess,
  getCloudflaredPath,
  getTunnelProcess,
  setTunnelProcess,
} from "./state.js";

const router = Router();

async function persistTunnelUrl(experimentID, url) {
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

async function clearExperimentTunnelUrl(experimentID) {
  if (!experimentID) return;
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

router.post("/api/create-tunnel", async (req, res) => {
  /* istanbul ignore next -- express.json initializes req.body in the mounted API app. */
  const { experimentID } = req.body || {};
  const maxAttempts = 3;
  const timeoutMs = 10000;
  const quickTunnelRegex = /https?:\/\/(.*?)\.trycloudflare\.com/;

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
    const processRef = spawn(cloudflaredPath, args);
    setTunnelProcess(processRef);

    let tunnelUrl = null;
    let timeoutId = null;

    function cleanup() {
      /* istanbul ignore else -- timeout is set before cleanup can run in real child-process flow. */
      if (timeoutId) clearTimeout(timeoutId);
    }

    async function respondWithUrl(url) {
      tunnelUrl = url;
      responded = true;
      cleanup();
      await persistTunnelUrl(experimentID, url);
      res.json({ success: true, url });
    }

    function handleTunnelOutput(data) {
      if (responded) return;
      const output = data.toString();

      if (customTunnelUrl) {
        if (
          /registered tunnel connection|connection registered|started tunnel|serving/i.test(
            output,
          )
        ) {
          void respondWithUrl(customTunnelUrl);
        }
      } else {
        const match = output.match(quickTunnelRegex);
        if (match && !tunnelUrl) {
          void respondWithUrl(`${match[0]}`);
        }
      }
    }

    processRef.stdout.on("data", handleTunnelOutput);
    processRef.stderr.on("data", handleTunnelOutput);

    processRef.on("error", (err) => {
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

router.post("/api/close-tunnel", async (req, res) => {
  /* istanbul ignore next -- express.json initializes req.body in the mounted API app. */
  const { experimentID } = req.body || {};
  const processRef = getTunnelProcess();
  if (!processRef) {
    return res
      .status(400)
      .json({ success: false, message: "No active tunnel" });
  }

  processRef.kill();
  clearTunnelProcess();
  await clearExperimentTunnelUrl(experimentID);
  return res.json({ success: true, message: "Tunnel closed" });
});

export default router;
