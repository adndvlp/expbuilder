import { spawnSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const clientRoot = fileURLToPath(new URL("..", import.meta.url));
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const vitestArguments = process.argv.slice(2);
const vitestCommand = [
  "vitest",
  "run",
  ...(vitestArguments.some((argument) =>
    argument.startsWith("--hookTimeout"),
  )
    ? []
    : ["--hookTimeout=30000"]),
  ...vitestArguments,
];
const isCi =
  process.env.CI === "true" || process.env.GITHUB_ACTIONS === "true";

function runPackageBinary(args, env) {
  const result = spawnSync(npmCommand, ["exec", "--", ...args], {
    cwd: clientRoot,
    env,
    stdio: "inherit",
  });

  if (result.error) {
    throw result.error;
  }

  return result.status ?? 1;
}

let browserDirectory;
let exitCode = 1;

try {
  const testEnvironment = { ...process.env };

  if (!isCi && !testEnvironment.PLAYWRIGHT_BROWSERS_PATH) {
    browserDirectory = await mkdtemp(
      join(tmpdir(), "expbuilder-playwright-"),
    );
    testEnvironment.PLAYWRIGHT_BROWSERS_PATH = browserDirectory;

    console.log(
      `Installing temporary Chromium for ${process.platform}/${process.arch}...`,
    );
    const installExitCode = runPackageBinary(
      ["playwright", "install", "--only-shell", "chromium"],
      testEnvironment,
    );

    if (installExitCode !== 0) {
      exitCode = installExitCode;
    } else {
      exitCode = runPackageBinary(vitestCommand, testEnvironment);
    }
  } else {
    exitCode = runPackageBinary(vitestCommand, testEnvironment);
  }
} catch (error) {
  console.error(
    error instanceof Error ? error.message : "Failed to run client unit tests",
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
