import { spawn } from "node:child_process";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const runtimeRoot = path.dirname(fileURLToPath(import.meta.url));
const clientRoot = path.dirname(runtimeRoot);

const allocatePort = () =>
  new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close();
        reject(new Error("Could not allocate a runtime test port"));
        return;
      }
      server.close((error) => {
        if (error) reject(error);
        else resolve(address.port);
      });
    });
  });

const port = String(await allocatePort());
const serverUrl = `http://127.0.0.1:${port}`;
const dbRoot = path.join(os.tmpdir(), `expbuilder-runtime-${process.pid}`);
const playwrightCli = path.join(
  clientRoot,
  "node_modules",
  "@playwright",
  "test",
  "cli.js",
);

const child = spawn(
  process.execPath,
  [playwrightCli, "test", "-c", "playwright.runtime.config.ts", ...process.argv.slice(2)],
  {
    cwd: clientRoot,
    stdio: "inherit",
    env: {
      ...process.env,
      RUNTIME_SERVER_PORT: port,
      RUNTIME_SERVER_URL: serverUrl,
      RUNTIME_DB_ROOT: dbRoot,
    },
  },
);

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => child.kill(signal));
}

child.once("error", (error) => {
  console.error(error);
  process.exitCode = 1;
});
child.once("exit", (code, signal) => {
  process.exitCode = signal ? 1 : (code ?? 1);
});
