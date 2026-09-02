import { buildExperimentGraph } from "../graph/buildExperimentGraph.js";
import { createLoopBranch } from "./createLoopBranch.js";
import { findTrial } from "./scopeGraph.js";

const OPERATION = "create-loop-branch";

export class LoopBranchCommandError extends Error {
  constructor(code, message, status = 400, details = {}) {
    super(message);
    this.name = "LoopBranchCommandError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

const id = (value) =>
  value === undefined || value === null ? null : String(value);

const commandPayload = (experimentId, command) =>
  JSON.stringify({
    experimentId: String(experimentId),
    sourceTrialId: id(command.sourceTrialId),
    targetScopeId: id(command.targetScopeId),
    mode: command.mode,
  });

const nextRevision = (currentRevision) => {
  const parsed = Date.parse(currentRevision);
  const minimum = Number.isNaN(parsed) ? Date.now() : parsed + 1;
  return new Date(Math.max(Date.now(), minimum)).toISOString();
};

const findReceipt = (data, idempotencyKey) =>
  data.mutationReceipts.find(
    (receipt) =>
      receipt.operation === OPERATION &&
      receipt.idempotencyKey === idempotencyKey,
  );

export function executeLoopBranchCommand(data, command) {
  const idempotencyKey = String(command.idempotencyKey ?? "");
  if (!idempotencyKey) {
    throw new LoopBranchCommandError(
      "IDEMPOTENCY_KEY_REQUIRED",
      "Idempotency-Key is required",
    );
  }
  const payload = commandPayload(command.experimentId, command);
  const existing = findReceipt(data, idempotencyKey);
  if (existing) {
    if (existing.payload !== payload) {
      throw new LoopBranchCommandError(
        "IDEMPOTENCY_CONFLICT",
        "Idempotency-Key was already used with a different command",
        409,
      );
    }
    return structuredClone(existing.response);
  }

  const experimentDoc = data.trials.find(
    (candidate) => candidate.experimentID === command.experimentId,
  );
  if (!experimentDoc) {
    throw new LoopBranchCommandError(
      "EXPERIMENT_NOT_FOUND",
      "Experiment not found",
      404,
    );
  }
  const currentGraph = buildExperimentGraph(experimentDoc);
  if (
    command.expectedRevision !== undefined &&
    String(command.expectedRevision) !== String(currentGraph.revision)
  ) {
    throw new LoopBranchCommandError(
      "REVISION_CONFLICT",
      "Experiment graph changed before the branch was created",
      409,
      { graph: currentGraph, revision: currentGraph.revision },
    );
  }
  const sourceTrial = findTrial(experimentDoc, command.sourceTrialId);
  if (!sourceTrial) {
    throw new LoopBranchCommandError(
      "SOURCE_NOT_FOUND",
      "Source trial not found",
      404,
    );
  }

  const result = createLoopBranch(
    experimentDoc,
    sourceTrial,
    command.targetScopeId,
    command.mode,
    nextRevision(currentGraph.revision),
  );
  if (result.error) {
    throw new LoopBranchCommandError(
      "DESTINATION_SCOPE_INVALID",
      result.error,
    );
  }
  const graph = buildExperimentGraph(experimentDoc);
  if (graph.diagnostics.length > 0) {
    throw new LoopBranchCommandError(
      "GRAPH_INVALID",
      "Branch creation produced an invalid experiment graph",
      409,
      { diagnostics: graph.diagnostics },
    );
  }
  const route = graph.edges.find(
    (edge) =>
      id(edge.sourceId) === id(sourceTrial.id) &&
      id(edge.targetId) === id(result.trial.id),
  );
  const response = {
    success: true,
    source: structuredClone(sourceTrial),
    target: structuredClone(result.trial),
    trial: structuredClone(result.trial),
    route: route ?? null,
    revision: graph.revision,
    graph,
    crossedLoopIds: result.crossedLoopIds,
  };
  data.mutationReceipts.push({
    operation: OPERATION,
    idempotencyKey,
    payload,
    response: structuredClone(response),
    createdAt: new Date().toISOString(),
  });
  return response;
}
