import { readdir, readFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import {
  loadAcceptanceIds,
  loadDecisions,
  repositoryRoot,
  requirementGroup,
} from "./acceptanceCatalog.mjs";
import {
  acceptanceCoverage,
  verticalCapabilities,
} from "./coverageRegistry.mjs";

const runtimeScenarioRoot = resolve(
  repositoryRoot,
  "client/runtime-e2e/scenarios",
);
const errors = [];

async function validateEvidence(id, entries = []) {
  if (entries.length === 0) {
    errors.push(`${id}: covered entries require evidence`);
    return;
  }
  for (const entry of entries) {
    const path = resolve(repositoryRoot, entry.file);
    let source;
    try {
      source = await readFile(path, "utf8");
    } catch {
      errors.push(`${id}: evidence file does not exist: ${entry.file}`);
      continue;
    }
    if (!source.includes(entry.title)) {
      errors.push(`${id}: evidence title not found in ${entry.file}`);
    }
    if (!entry.title.includes(`[${id}]`)) {
      errors.push(`${id}: evidence title must contain [${id}]`);
    }
  }
}

async function validateRuntimeCapabilities() {
  const files = (await readdir(runtimeScenarioRoot))
    .filter((file) => file.endsWith(".spec.ts"));
  const found = new Map();
  for (const file of files) {
    const source = await readFile(resolve(runtimeScenarioRoot, file), "utf8");
    for (const match of source.matchAll(/\[(RUNTIME-[A-Z-]+)]/g)) {
      const id = match[1];
      if (found.has(id)) errors.push(`${id}: duplicate runtime capability tag`);
      found.set(id, file);
    }
  }
  for (const [id, expectedFile] of Object.entries(verticalCapabilities)) {
    if (found.get(id) !== expectedFile) {
      errors.push(
        `${id}: expected ${expectedFile}, found ${found.get(id) ?? "nothing"}`,
      );
    }
  }
  for (const [id, file] of found) {
    if (!(id in verticalCapabilities)) {
      errors.push(`${id}: ${file} is not registered`);
    }
  }
  return found.size;
}

const acceptanceIds = await loadAcceptanceIds();
const acceptanceSet = new Set(acceptanceIds);
const decisions = await loadDecisions();

for (const [id, entry] of Object.entries(acceptanceCoverage)) {
  if (!acceptanceSet.has(id)) {
    errors.push(`${id}: not present in the acceptance plan`);
    continue;
  }
  if (entry.status === "covered") {
    await validateEvidence(id, entry.evidence);
  } else if (entry.status === "blocked") {
    if (!entry.blockedBy?.length) {
      errors.push(`${id}: blocked entries require blockedBy`);
    }
    for (const decisionId of entry.blockedBy ?? []) {
      const decision = decisions.get(decisionId);
      if (!decision) errors.push(`${id}: unknown decision ${decisionId}`);
      else if (decision.resolved) {
        errors.push(`${id}: ${decisionId} is resolved and cannot block coverage`);
      }
    }
  } else {
    errors.push(`${id}: unsupported status ${entry.status}`);
  }
}

const capabilityCount = await validateRuntimeCapabilities();
const totals = { covered: 0, blocked: 0, missing: 0 };
const missingByGroup = {};
for (const id of acceptanceIds) {
  const status = acceptanceCoverage[id]?.status ?? "missing";
  totals[status] += 1;
  if (status === "missing") {
    const group = requirementGroup(id);
    missingByGroup[group] = (missingByGroup[group] ?? 0) + 1;
  }
}

console.log(
  `Acceptance coverage: ${totals.covered} covered, ` +
    `${totals.blocked} blocked, ${totals.missing} missing ` +
    `(${acceptanceIds.length} total).`,
);
console.log(`Missing by group: ${JSON.stringify(missingByGroup)}`);
console.log(`Registered vertical runtime capabilities: ${capabilityCount}.`);

if (process.argv.includes("--require-complete") && totals.missing > 0) {
  errors.push(`${totals.missing} acceptance requirements remain missing`);
}
if (errors.length > 0) {
  console.error("Coverage registry errors:");
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
}
