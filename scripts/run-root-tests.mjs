import { spawnSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));
const clientRoot = join(repositoryRoot, "client");
const jestPath = join(repositoryRoot, "node_modules", "jest", "bin", "jest.js");
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
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

let browserDirectory;
let exitCode = 1;

try {
  const testEnvironment = { ...process.env };

  if (!isCi && !testEnvironment.PLAYWRIGHT_BROWSERS_PATH) {
    browserDirectory = await mkdtemp(
      join(tmpdir(), "expbuilder-server-playwright-"),
    );
    testEnvironment.PLAYWRIGHT_BROWSERS_PATH = browserDirectory;

    console.log(
      `Installing temporary Chromium for ${process.platform}/${process.arch}...`,
    );
    exitCode = run(
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
      testEnvironment,
      600000,
    );
  } else {
    exitCode = 0;
  }

  if (exitCode === 0) {
    exitCode = run(
      process.execPath,
      [
        "--experimental-vm-modules",
        jestPath,
        ...process.argv.slice(2),
      ],
      testEnvironment,
    );
  }
} catch (error) {
  console.error(
    error instanceof Error ? error.message : "Failed to run server tests",
  );
  exitCode = 1;
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

process.exitCode = exitCode;
