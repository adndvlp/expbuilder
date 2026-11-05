import { migrateLegacyNavigation } from "../db/legacy/migrateLegacyNavigation.js";
import { findWorkspaceDocument } from "./document.js";
import { applyWorkspaceCommand } from "../../../shared/experiment-workspace/commands.js";
import {
  createDelta,
  applyDelta,
} from "../../../shared/experiment-workspace/history.js";
import { stableStringify } from "../../../shared/experiment-workspace/serialization.js";
import { assertExperimentNavigation } from "../timeline/branchContract.js";
import { allocateTrialId, allocateLoopId } from "../timeline/graph/itemIds.js";
import { revisionOf, workspaceSnapshot } from "./snapshot.js";

const fail = (message, code, status = 400) => {
  throw Object.assign(Error(message), { status, code });
};
const docFor = (data, experimentId) =>
  data.trials.find((d) => d.experimentID === experimentId);

function responseFor(data, receipt) {
  let document = structuredClone(docFor(data, receipt.experimentId));
  const subsequent = data.mutationReceipts.filter(
    (r) =>
      r.operation === "workspace" && r.experimentId === receipt.experimentId,
  );
  const index = subsequent.findIndex(
    (r) => r.idempotencyKey === receipt.idempotencyKey,
  );
  for (let i = subsequent.length - 1; i > index; i--) {
    document = applyDelta(document, subsequent[i].changes, "undo");
    document.authoringRevision = subsequent[i].beforeRevision;
    document.updatedAt = subsequent[i].beforeUpdatedAt;
  }
  document.authoringRevision = receipt.revision;
  document.updatedAt = receipt.updatedAt;
  return {
    ...workspaceSnapshot(document),
    result: receipt.result,
    idMap: receipt.idMap,
    undoPatch: receipt.historyPatch,
    removedIds: receipt.removedIds,
  };
}

function executeCommand(data, experimentId, command, key) {
  if (!key) fail("Idempotency-Key is required", "IDEMPOTENCY_KEY_REQUIRED");
  if (
    !command ||
    typeof command.kind !== "string" ||
    (command.args != null &&
      (typeof command.args !== "object" || Array.isArray(command.args)))
  )
    fail("Invalid workspace command", "COMMAND_INVALID");
  const payload = stableStringify(command);
  const receipt = data.mutationReceipts.find(
    (r) =>
      r.operation === "workspace" &&
      r.experimentId === experimentId &&
      r.idempotencyKey === key,
  );
  if (receipt) {
    if (receipt.payload !== payload)
      fail(
        "Idempotency key was already used for another command",
        "IDEMPOTENCY_CONFLICT",
        409,
      );
    return responseFor(data, receipt);
  }
  const before = findWorkspaceDocument(data, experimentId);
  if (!before) fail("Experiment not found", "EXPERIMENT_NOT_FOUND", 404);
  if (String(command.expectedRevision) !== revisionOf(before))
    fail("The workspace changed before this command", "REVISION_CONFLICT", 409);
  if (
    before.workspaceSchemaVersion !== 2 &&
    command.kind !== "convertWorkspace"
  )
    fail(
      "Convert the workspace before editing it",
      "WORKSPACE_SCHEMA_UNSUPPORTED",
      409,
    );
  let document,
    result,
    idMap = {};
  if (command.kind === "applyHistory") {
    const changes = command.args?.changes;
    if (
      !Array.isArray(changes) ||
      !["undo", "redo"].includes(command.args?.direction)
    )
      fail("Invalid history command", "HISTORY_INVALID");
    for (const change of changes)
      if (
        ![
          "trials",
          "loops",
          "timeline",
          "entryItemId",
          "editorLayout",
        ].includes(change.path?.[0])
      )
        fail("History cannot modify unrelated data", "HISTORY_INVALID");
    document = applyDelta(before, changes, command.args.direction);
  } else {
    ({ document, result, idMap } = applyWorkspaceCommand(
      command.kind === "convertWorkspace"
        ? migrateLegacyNavigation(before)
        : before,
      command,
      {
        allocateId: (kind, doc) =>
          kind === "trial"
            ? allocateTrialId(
                doc,
                Math.max(Date.now(), doc.nextWorkspaceTrialId ?? 1),
              )
            : allocateLoopId(
                doc,
                Math.max(Date.now(), doc.nextWorkspaceLoopId ?? 1),
              ),
      },
    ));
  }
  assertExperimentNavigation(document);
  const changes = createDelta(before, document);
  if (changes.length) {
    document.authoringRevision = String(
      (Number(before.authoringRevision) || 0) + 1,
    );
    document.updatedAt = new Date().toISOString();
  }
  const historyPatch =
    command.kind === "convertWorkspace"
      ? []
      : changes.filter((c) =>
          [
            "trials",
            "loops",
            "timeline",
            "entryItemId",
            "editorLayout",
          ].includes(c.path[0]),
        );
  const afterIds = new Set(
    [...document.trials, ...document.loops].map((t) => String(t.id)),
  );
  const removedIds = [...before.trials, ...before.loops]
    .filter((t) => !afterIds.has(String(t.id)))
    .map((t) => t.id);
  const nextReceipt = {
    operation: "workspace",
    experimentId,
    idempotencyKey: key,
    payload,
    changes,
    historyPatch,
    result,
    idMap,
    removedIds,
    beforeRevision: revisionOf(before),
    beforeUpdatedAt: before.updatedAt,
    revision: document.authoringRevision,
    updatedAt: document.updatedAt,
  };
  const existingIndex = data.trials.indexOf(before);
  if (existingIndex < 0) data.trials.push(document);
  else data.trials[existingIndex] = document;
  data.mutationReceipts.push(nextReceipt);
  return responseFor(data, nextReceipt);
}

export function executeWorkspaceCommand(...args) {
  try {
    return executeCommand(...args);
  } catch (error) {
    error.status ??= 400;
    throw error;
  }
}
