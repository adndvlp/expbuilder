import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
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

const dbRoot = path.join(os.tmpdir(), `expbuilder-runtime-${process.pid}`);
const playwrightCli = path.join(
  clientRoot,
  "node_modules",
  "@playwright",
  "test",
  "cli.js",
);

const testArguments = process.argv.slice(2);
const isCi = process.env.CI === "true" || process.env.GITHUB_ACTIONS === "true";
let child;
let interrupted = false;
let browserDirectory;

function runPlaywright(args, env) {
  if (interrupted) return Promise.resolve(1);
  return new Promise((resolve, reject) => {
    child = spawn(process.execPath, [playwrightCli, ...args], {
      cwd: clientRoot,
      stdio: "inherit",
      env,
    });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      child = undefined;
      resolve(signal ? 1 : (code ?? 1));
    });
  });
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => {
    interrupted = true;
    child?.kill(signal);
  });
}

let exitCode = 1;
try {
  const testEnvironment = { ...process.env };
  let installExitCode = 0;
  if (
    !isCi &&
    !testEnvironment.PLAYWRIGHT_BROWSERS_PATH &&
    !testEnvironment.RUNTIME_BROWSER_CHANNEL
  ) {
    browserDirectory = await mkdtemp(
      path.join(os.tmpdir(), "expbuilder-playwright-"),
    );
    testEnvironment.PLAYWRIGHT_BROWSERS_PATH = browserDirectory;
    const headed =
      testArguments.some((arg) =>
        ["--headed", "--debug", "--ui"].includes(arg),
      ) || Boolean(testEnvironment.PWDEBUG && testEnvironment.PWDEBUG !== "0");
    console.log(
      `Installing temporary Chromium for ${process.platform}/${process.arch}...`,
    );
    installExitCode = await runPlaywright(
      ["install", ...(headed ? [] : ["--only-shell"]), "chromium"],
      testEnvironment,
    );
  }
  if (installExitCode !== 0 || interrupted) {
    exitCode = installExitCode || 1;
  } else {
    const port = String(await allocatePort());
    exitCode = await runPlaywright(
      ["test", "-c", "playwright.runtime.config.ts", ...testArguments],
      {
        ...testEnvironment,
        RUNTIME_SERVER_PORT: port,
        RUNTIME_SERVER_URL: `http://127.0.0.1:${port}`,
        RUNTIME_DB_ROOT: dbRoot,
      },
    );
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
} finally {
  if (browserDirectory) {
    await rm(browserDirectory, {
      recursive: true,
      force: true,
      maxRetries: 3,
      retryDelay: 100,
    });
  }
}
process.exitCode = interrupted ? 1 : exitCode;
