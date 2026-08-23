export type LoopBranchLevel = {
  scopeId: string | null;
  name: string;
  relation: "current" | "ancestor" | "root";
  branchCount: number;
};

export type LoopBranchMode = "parallel" | "sequential";

export type LoopBranchLevelSnapshot = {
  levels: LoopBranchLevel[];
  revision: string;
};

export type LoopBranchCommandOptions = {
  expectedRevision?: string;
  idempotencyKey?: string;
};

export type CreatedLoopBranch = {
  trial: {
    id: number;
    type: "Trial";
    name: string;
    plugin: string;
    parameters: Record<string, unknown>;
    trialCode: string;
    branches: Array<string | number>;
    parentLoopId?: string;
  };
  crossedLoopIds: Array<string | number>;
  revision: string;
  graph: ExperimentGraphSnapshot;
};
import type { ExperimentGraphSnapshot } from "../../../../modules/experiment-graph/types";
