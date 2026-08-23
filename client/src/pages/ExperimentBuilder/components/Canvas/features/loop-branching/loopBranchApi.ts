import type {
  CreatedLoopBranch,
  LoopBranchLevel,
  LoopBranchMode,
} from "./types";
import { experimentAuthoringClient } from "../../../../modules/experiment-authoring";

export async function loadLoopBranchLevels(
  experimentId: string,
  sourceTrialId: string | number,
): Promise<LoopBranchLevel[]> {
  return experimentAuthoringClient.loadLoopBranchLevels(
    experimentId,
    sourceTrialId,
  );
}

export async function createLoopBranch(
  experimentId: string,
  sourceTrialId: string | number,
  targetScopeId: string | null,
  mode: LoopBranchMode,
): Promise<CreatedLoopBranch> {
  return (await experimentAuthoringClient.createLoopBranch(
    experimentId,
    sourceTrialId,
    targetScopeId,
    mode,
  )) as CreatedLoopBranch;
}
