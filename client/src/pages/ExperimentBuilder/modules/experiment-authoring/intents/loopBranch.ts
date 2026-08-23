import type { ExperimentGraphSnapshot } from "../../experiment-graph/types";
import type {
  LoopBranchLevel,
  LoopBranchMode,
} from "../../../components/Canvas/features/loop-branching/types";
import type { Trial } from "../../../components/ConfigurationPanel/types";

export type LoopBranchPlacement = "parallel" | "sequential";

export type LoopBranchIntentDependencies = {
  loadLevels: (
    experimentId: string,
    sourceTrialId: string | number,
  ) => Promise<LoopBranchLevel[]>;
  createBranch: (
    experimentId: string,
    sourceTrialId: string | number,
    targetScopeId: string | null,
    mode: LoopBranchMode,
  ) => Promise<{
    trial: Trial;
    graph: ExperimentGraphSnapshot;
    crossedLoopIds?: Array<string | number>;
  }>;
};

export type StartedLoopBranchIntent = {
  experimentId: string;
  sourceTrialId: string | number;
  levels: LoopBranchLevel[];
};

export type SelectedLoopBranchLevel = {
  level: LoopBranchLevel;
  requiresPlacement: boolean;
};

const scopesMatch = (left: string | null, right: string | null) =>
  left === null ? right === null : String(left) === String(right);

export async function startLoopBranchIntent(options: {
  experimentId: string;
  sourceTrialId: string | number;
  dependencies: LoopBranchIntentDependencies;
}): Promise<StartedLoopBranchIntent> {
  return {
    experimentId: options.experimentId,
    sourceTrialId: options.sourceTrialId,
    levels: await options.dependencies.loadLevels(
      options.experimentId,
      options.sourceTrialId,
    ),
  };
}

export function selectLoopBranchLevel(
  intent: StartedLoopBranchIntent,
  targetScopeId: string | null,
): SelectedLoopBranchLevel | null {
  const level = intent.levels.find((candidate) =>
    scopesMatch(candidate.scopeId, targetScopeId),
  );
  return level
    ? { level, requiresPlacement: level.branchCount > 0 }
    : null;
}

export async function commitLoopBranchIntent(options: {
  intent: StartedLoopBranchIntent;
  selection: SelectedLoopBranchLevel;
  placement?: LoopBranchPlacement;
  dependencies: LoopBranchIntentDependencies;
}) {
  const mode: LoopBranchMode = options.selection.requiresPlacement
    ? options.placement ?? "parallel"
    : "parallel";
  return options.dependencies.createBranch(
    options.intent.experimentId,
    options.intent.sourceTrialId,
    options.selection.level.scopeId,
    mode,
  );
}
