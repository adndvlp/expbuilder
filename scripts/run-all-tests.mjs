import { spawnSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));
const clientRoot = join(repositoryRoot, "client");
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const isCi =
  process.env.CI === "true" || process.env.GITHUB_ACTIONS === "true";

const suites = [
  {
    name: "jsPsych runtime bundle",
    args: ["--prefix", "server/jspsych-bundler", "run", "build"],
  },
  {
    name: "server tests",
    args: ["test", "--", "--runInBand"],
  },
  {
    name: "client unit tests",
    args: ["--prefix", "client", "run", "test:unit"],
  },
  {
    name: "Functions tests",
    args: ["--prefix", "api/functions", "test", "--", "--runInBand"],
  },
  {
    name: "Builder end-to-end tests",
    args: ["--prefix", "client", "run", "test:e2e"],
  },
  {
    name: "generated-runtime end-to-end tests",
    args: ["--prefix", "client", "run", "test:runtime"],
  },
  {
    name: "public-cloud end-to-end tests",
    args: ["run", "test:e2e:cloud"],
  },
];

function run(args, environment, timeout) {
  const result = spawnSync(npmCommand, args, {
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
      join(tmpdir(), "expbuilder-all-tests-playwright-"),
    );
    testEnvironment.PLAYWRIGHT_BROWSERS_PATH = browserDirectory;

    console.log(
      `Installing one temporary Chromium for all tests on ${process.platform}/${process.arch}...`,
    );
    exitCode = run(
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

  for (const suite of suites) {
    if (exitCode !== 0) break;
    console.log(`\n=== ${suite.name} ===`);
    exitCode = run(suite.args, testEnvironment);
  }
} catch (error) {
  console.error(
    error instanceof Error ? error.message : "Failed to run the complete test suite",
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
