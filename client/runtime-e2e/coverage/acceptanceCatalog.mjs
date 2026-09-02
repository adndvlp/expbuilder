import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const coverageRoot = dirname(fileURLToPath(import.meta.url));

export const repositoryRoot = resolve(coverageRoot, "../../..");
export const acceptancePlanPath = resolve(
  repositoryRoot,
  "docs/loop-branching-spec/07-test-acceptance-plan.md",
);
export const decisionPaths = [
  resolve(
    repositoryRoot,
    "docs/loop-branching-spec/06-pending-decisions.md",
  ),
  resolve(
    repositoryRoot,
    "docs/loop-branching-spec/06b-pending-decisions.md",
  ),
];

const requirementPattern =
  /\b(?:TD|TC|TA|TL|TG|TR|TRES|TJ|TM|E2E)-\d+[A-Z]?\b/g;

export async function loadAcceptanceIds() {
  const source = await readFile(acceptancePlanPath, "utf8");
  return [...new Set(source.match(requirementPattern) ?? [])];
}

export async function loadDecisions() {
  const decisions = new Map();
  for (const path of decisionPaths) {
    const source = await readFile(path, "utf8");
    for (const line of source.split("\n")) {
      const match = line.match(/^### (DEC-\d+) — (.+)$/);
      if (!match) continue;
      const [, id, heading] = match;
      decisions.set(id, {
        heading,
        resolved: heading.includes("RESUELTA"),
        blocking: heading.includes("BLOQUEANTE"),
      });
    }
  }
  return decisions;
}

export function requirementGroup(id) {
  return id.slice(0, id.indexOf("-"));
}
