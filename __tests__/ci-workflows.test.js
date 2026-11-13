import { readFileSync } from "node:fs";
import { URL } from "node:url";
import { describe, expect, test } from "@jest/globals";
import { minimatch } from "minimatch";
import { parse } from "yaml";

const workflows = ["builder-contracts", "public-persistence"].map((name) => [
  name,
  parse(readFileSync(new URL(`../.github/workflows/${name}.yml`, import.meta.url), "utf8")),
]);

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
