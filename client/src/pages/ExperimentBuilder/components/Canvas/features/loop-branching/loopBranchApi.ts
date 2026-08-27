import type {
  CreatedLoopBranch,
  LoopBranchCommandOptions,
  LoopBranchLevelSnapshot,
  LoopBranchMode,
} from "./types";
import { experimentAuthoringClient } from "../../../../modules/experiment-authoring";

export async function loadLoopBranchLevels(
  experimentId: string,
  sourceTrialId: string | number,
): Promise<LoopBranchLevelSnapshot> {
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
  options?: LoopBranchCommandOptions,
): Promise<CreatedLoopBranch> {
  return (await experimentAuthoringClient.createLoopBranch(
    experimentId,
    sourceTrialId,
    targetScopeId,
    mode,
    options,
  )) as CreatedLoopBranch;
}
