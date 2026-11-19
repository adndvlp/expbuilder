import { createLoopBranch as create } from "../../../../shared/experiment-workspace/dist/loopBranching/createLoopBranch.js";
import { allocateTrialId } from "../graph/itemIds.js";
export function createLoopBranch(document, source, scopeId, mode, timestamp = new Date().toISOString(), allocateId = allocateTrialId) {
  return create(document, source, scopeId, mode, timestamp, allocateId);
}
