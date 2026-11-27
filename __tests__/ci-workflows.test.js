import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import process from "node:process";
import { fileURLToPath, URL } from "node:url";
import { describe, expect, test } from "@jest/globals";
import { minimatch } from "minimatch";
import { parse } from "yaml";

const workflows = ["builder-contracts", "public-persistence"].map((name) => [
  name,
  parse(readFileSync(new URL(`../.github/workflows/${name}.yml`, import.meta.url), "utf8")),
]);

describe.each([
  ["build", "test"],
  ["builder-contracts", "contracts"],
  ["public-persistence", "persistence"],
])("%s browser environment", (name, jobName) => {
  test("pins an Ubuntu release with Chromium and FFmpeg downloads available in the installed Playwright", () => {
    const workflow = parse(readFileSync(
      new URL(`../.github/workflows/${name}.yml`, import.meta.url), "utf8",
    ));
    const runner = workflow.jobs[jobName]["runs-on"];
    // A moving alias can select a new Ubuntu before this Playwright supports it.
    expect(runner).toMatch(/^ubuntu-\d+\.\d+$/);

    const result = spawnSync(process.execPath, [
      fileURLToPath(new URL("../client/node_modules/playwright-core/cli.js", import.meta.url)),
      "install", "--dry-run", "chromium",
    ], {
      encoding: "utf8",
      timeout: 10000,
      env: {
        ...process.env,
        PLAYWRIGHT_HOST_PLATFORM_OVERRIDE: `${runner.replace("ubuntu-", "ubuntu")}-x64`,
      },
    });
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(0);
    // Playwright 1.60's dry run can exit successfully for an unsupported host,
    // leaving download URLs empty. Check every browser/tool, including FFmpeg.
    const downloads = result.stdout.trim().split(/\n\s*\n/);
    expect(downloads.length).toBeGreaterThanOrEqual(3);
    for (const download of downloads) {
      expect(download).toMatch(/Download url:\s+https:\/\//);
    }
  });
});

// These workflows use positive path globs and branches-ignore, without ordered
// negations. Exercise their actual filters with changes that previously ran no tests.
function selects(workflow, event, files, branch = "bug-fix") {
  if (!Object.hasOwn(workflow.on, event)) return false;
  const filters = workflow.on[event] ?? {};
  if (event === "push" && filters["branches-ignore"]?.some((glob) => minimatch(branch, glob))) {
    return false;
  }
  return !filters.paths || files.some((file) => filters.paths.some((glob) => minimatch(file, glob)));
}

describe("build workflow Linux publish compilers", () => {
  const workflow = parse(readFileSync(
    new URL("../.github/workflows/build.yml", import.meta.url), "utf8",
  ));

  test("pins GCC 12 in the linux-x64 job between dependency install and client build", () => {
    const steps = workflow.jobs["linux-x64"].steps;
    const pinIndex = steps.findIndex(
      (step) => step.name === "Pin GCC 12 for native module rebuilds",
    );
    expect(pinIndex).toBeGreaterThanOrEqual(0);

    const installIndex = steps.findIndex(
      (step) => step.name === "Install dependencies",
    );
    const buildClientIndex = steps.findIndex(
      (step) => step.name === "Build client",
    );
    expect(installIndex).toBeGreaterThanOrEqual(0);
    expect(buildClientIndex).toBeGreaterThanOrEqual(0);
    expect(pinIndex).toBeGreaterThan(installIndex);
    expect(pinIndex).toBeLessThan(buildClientIndex);
  });

  test("installs gcc-12 and g++-12 and exports CC/CXX for later steps", () => {
    const steps = workflow.jobs["linux-x64"].steps;
    const pin = steps.find(
      (step) => step.name === "Pin GCC 12 for native module rebuilds",
    );
    expect(pin).toBeTruthy();
    const run = pin.run;
    expect(run).toContain("gcc-12");
    expect(run).toContain("g++-12");
    expect(run).toMatch(/echo "CC=gcc-12" >> "\$GITHUB_ENV"/);
    expect(run).toMatch(/echo "CXX=g\+\+-12" >> "\$GITHUB_ENV"/);
  });

  test("keeps the compiler pin out of the other jobs", () => {
    for (const jobName of ["test", "tag", "mac", "win"]) {
      const steps = workflow.jobs[jobName]?.steps ?? [];
      const pin = steps.find(
        (step) => step.name === "Pin GCC 12 for native module rebuilds",
      );
      expect(pin).toBeUndefined();
    }
  });
});

describe.each(workflows)("%s workflow activation", (_name, workflow) => {
  test.each(["push", "pull_request"])("%s selects the persistence harness and media regression", (event) => {
    for (const file of ["api/persistence-e2e/harness.mjs", "api/persistence-e2e/media.e2e.mjs"]) {
      expect(selects(workflow, event, [file])).toBe(true);
    }
  });

  test.each(["push", "pull_request"])("%s selects the persistence runner and workflow configuration", (event) => {
    for (const file of [
      "scripts/run-persistence-e2e.mjs",
      ".github/workflows/public-persistence.yml",
    ]) {
      expect(selects(workflow, event, [file])).toBe(true);
    }
  });

  test("ordinary branch pushes select tests without a desktop build marker", () => {
    expect(selects(workflow, "push", ["api/functions/index.js"])).toBe(true);
  });

  test("documentation-only changes do not select the suites", () => {
    expect(selects(workflow, "push", ["docs/12-PUBLISH_FLOW.md"])).toBe(false);
  });

  test("manual execution remains available", () => {
    expect(selects(workflow, "workflow_dispatch", [])).toBe(true);
  });
});
