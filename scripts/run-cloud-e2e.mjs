import { spawnSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));
const clientRoot = join(repositoryRoot, "client");
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const jestPath = join(repositoryRoot, "node_modules", "jest", "bin", "jest.js");
const isCi =
  process.env.CI === "true" || process.env.GITHUB_ACTIONS === "true";

function run(command, args, environment, timeout) {
  const result = spawnSync(command, args, {
    cwd: repositoryRoot,
    env: environment,
    stdio: "inherit",
    ...(timeout ? { timeout } : {}),
  });
  if (result.error) throw result.error;
  return result.status ?? 1;
}

function runJest(testFile, environment) {
  return run(
    process.execPath,
    [
      "--experimental-vm-modules",
      jestPath,
      testFile,
      "--runInBand",
      "--forceExit",
    ],
    environment,
  );
}

function runProviderTests() {
  return runJest("__tests__/provider-cloud.e2e.test.js", {
    ...process.env,
    RUN_CLOUD_E2E: "1",
  });
}

async function runBrowserTests() {
  let browserDirectory;
  const environment = { ...process.env, RUN_CLOUD_E2E: "1" };

  try {
    if (!isCi && !environment.PLAYWRIGHT_BROWSERS_PATH) {
      browserDirectory = await mkdtemp(
        join(tmpdir(), "expbuilder-cloud-playwright-"),
      );
      environment.PLAYWRIGHT_BROWSERS_PATH = browserDirectory;
      console.log(
        `Installing temporary Chromium for ${process.platform}/${process.arch}...`,
      );
      const installExitCode = run(
        npmCommand,
        [
          "--prefix",
          clientRoot,
          "exec",
          "--",
          "playwright",
          "install",
          "--only-shell",
          "chromium",
        ],
        environment,
        600000,
      );
      if (installExitCode !== 0) return installExitCode;
    }

    return runJest("__tests__/browser-journey.e2e.test.js", environment);
  } finally {
    if (browserDirectory) {
      await rm(browserDirectory, {
        force: true,
        maxRetries: 3,
        recursive: true,
        retryDelay: 100,
      });
    }
  }
}

const mode = process.argv[2] ?? "all";
let exitCode = 1;

try {
  if (mode === "providers") {
    exitCode = runProviderTests();
  } else if (mode === "browser") {
    exitCode = await runBrowserTests();
  } else if (mode === "all") {
    exitCode = runProviderTests();
    if (exitCode === 0) exitCode = await runBrowserTests();
  } else {
    throw new Error(`Unknown cloud E2E mode: ${mode}`);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : "Cloud E2E failed");
  exitCode = 1;
}

process.exitCode = exitCode;
