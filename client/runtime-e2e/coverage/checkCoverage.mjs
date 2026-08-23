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
import {
  interactionCoverage,
  interactionCoveragePolicy,
} from "./interactionCoverage.mjs";

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
  return found;
}

function validateInteractionCoverage(foundCapabilities, decisions) {
  if (interactionCoveragePolicy.exhaustive !== false ||
      interactionCoveragePolicy.model !== "incremental") {
    errors.push("interaction coverage must remain explicitly incremental and non-exhaustive");
  }
  const totals = { representative: 0, partial: 0, blocked: 0 };
  for (const [id, entry] of Object.entries(interactionCoverage)) {
    if (!(entry.status in totals)) {
      errors.push(`${id}: unsupported interaction status ${entry.status}`);
      continue;
    }
    totals[entry.status] += 1;
    const capabilities = entry.capabilities ?? [];
    if (entry.status === "representative" && capabilities.length === 0) {
      errors.push(`${id}: representative interactions require a capability`);
    }
    if (entry.status === "partial" && capabilities.length === 0) {
      errors.push(`${id}: partial interactions require executed evidence`);
    }
    if (entry.status === "blocked" && capabilities.length > 0) {
      errors.push(`${id}: blocked interactions cannot claim executed evidence`);
    }
    for (const capability of capabilities) {
      if (!foundCapabilities.has(capability)) {
        errors.push(`${id}: unknown runtime capability ${capability}`);
      }
    }
    const blockers = entry.blockedBy ?? [];
    if (entry.status !== "representative" && blockers.length === 0) {
      errors.push(`${id}: ${entry.status} interactions require blockedBy`);
    }
    for (const decisionId of blockers) {
      const decision = decisions.get(decisionId);
      if (!decision) errors.push(`${id}: unknown decision ${decisionId}`);
      else if (decision.resolved) {
        errors.push(`${id}: ${decisionId} is resolved and cannot block coverage`);
      }
    }
  }
  return totals;
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

const foundCapabilities = await validateRuntimeCapabilities();
const capabilityCount = foundCapabilities.size;
const interactionTotals = validateInteractionCoverage(foundCapabilities, decisions);
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
console.log(
  `Non-exhaustive interaction matrix: ` +
    `${interactionTotals.representative} representative, ` +
    `${interactionTotals.partial} partial, ${interactionTotals.blocked} blocked.`,
);

if (process.argv.includes("--require-complete") && totals.missing > 0) {
  errors.push(`${totals.missing} acceptance requirements remain missing`);
}
if (errors.length > 0) {
  console.error("Coverage registry errors:");
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
}
