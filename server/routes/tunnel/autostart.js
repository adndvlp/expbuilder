import { spawn } from "child_process";
import { db, ensureDbData } from "../../utils/db.js";
import { withDbLock } from "../../modules/session-persistence/dbQueue.js";
import {
  clearTunnelProcess,
  getCloudflaredPath,
  getTunnelProcess,
  setTunnelProcess,
} from "./state.js";

/* istanbul ignore next -- server boot autostart depends on host cloudflared state and is not deterministic in unit tests. */
export function schedulePersistentTunnelAutostart() {
  setImmediate(async () => {
    try {
      const candidates = await withDbLock(async () => {
        await db.read();
        ensureDbData();
        return db.data.experiments
          .filter((exp) => exp.tunnelSettings?.persistent && exp.tunnelSettings.hostname)
          .map((exp) => ({
            experimentID: exp.experimentID,
            hostname: exp.tunnelSettings.hostname,
          }));
      });

      for (const candidate of candidates) {
        if (getTunnelProcess()) break;
        console.log(
          `[tunnel] Auto-starting cloudflared tunnel for ${candidate.experimentID} → ${candidate.hostname}`,
        );
        const processRef = spawn(getCloudflaredPath(), [
          "tunnel",
          "--hostname",
          candidate.hostname,
          "--url",
          process.env.API_URL || "http://localhost:3000",
          "--no-autoupdate",
        ]);
        setTunnelProcess(processRef);
        processRef.stderr.on("data", (d) => process.stderr.write(d));
        processRef.stdout.on("data", (d) => process.stdout.write(d));
        processRef.on("exit", () => clearTunnelProcess());
        await withDbLock(async () => {
          await db.read();
          ensureDbData();
          const exp = db.data.experiments.find(
            (item) => item.experimentID === candidate.experimentID,
          );
          if (!exp) return;
          exp.tunnelUrl = `https://${candidate.hostname}`;
          exp.updatedAt = new Date().toISOString();
          await db.write();
        });
      }
    } catch (err) {
      console.error("[tunnel] Auto-start error:", err.message);
    }
  });
}
