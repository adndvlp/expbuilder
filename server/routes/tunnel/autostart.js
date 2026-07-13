import { spawn } from "child_process";
import { db, ensureDbData } from "../../utils/db.js";
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
      await db.read();
      ensureDbData();
      for (const exp of db.data.experiments) {
        const s = exp.tunnelSettings;
        if (!s || !s.persistent) continue;
        if (!s.hostname) continue;
        if (getTunnelProcess()) continue;

        console.log(
          `[tunnel] Auto-starting cloudflared tunnel for ${exp.experimentID} → ${s.hostname}`,
        );
        const cloudflaredPath = getCloudflaredPath();
        const processRef = spawn(cloudflaredPath, [
          "tunnel",
          "--hostname",
          s.hostname,
          "--url",
          "http://localhost:3000",
          "--no-autoupdate",
        ]);
        setTunnelProcess(processRef);
        processRef.stderr.on("data", (d) => process.stderr.write(d));
        processRef.stdout.on("data", (d) => process.stdout.write(d));
        processRef.on("exit", () => {
          clearTunnelProcess();
        });
        exp.tunnelUrl = `https://${s.hostname}`;
        exp.updatedAt = new Date().toISOString();
      }
      await db.write();
    } catch (err) {
      console.error("[tunnel] Auto-start error:", err.message);
    }
  });
}
