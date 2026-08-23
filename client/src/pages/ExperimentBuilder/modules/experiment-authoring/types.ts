import type { Loop, Trial } from "../../components/ConfigurationPanel/types";
import type { TimelineItem } from "../../contexts/TrialsContext";
import type { ExperimentGraphSnapshot } from "../experiment-graph/types";
import type {
  LoopBranchLevelSnapshot,
  LoopBranchCommandOptions,
  LoopBranchMode,
} from "../../components/Canvas/features/loop-branching/types";

export type ExperimentRecord = {
  experimentID: string;
  name: string;
  description?: string;
  author?: string;
  storage?: string;
};

export type CreateExperimentInput = Omit<ExperimentRecord, "experimentID">;

export type AuthoringMutation<T> = {
  success: true;
  graph: ExperimentGraphSnapshot;
} & T;

export type LoopBranchMutation = AuthoringMutation<{
  trial: Trial;
  crossedLoopIds: string[];
  revision: string;
}>;

export interface ExperimentAuthoringClient {
  createExperiment(input: CreateExperimentInput): Promise<ExperimentRecord>;
  getGraph(experimentId: string | undefined): Promise<ExperimentGraphSnapshot>;
  createTrial(
    experimentId: string | undefined,
    trial: Omit<Trial, "id">,
  ): Promise<AuthoringMutation<{ trial: Trial }>>;
  getTrial(experimentId: string | undefined, trialId: string | number): Promise<Trial>;
  updateTrial(
    experimentId: string | undefined,
    trialId: string | number,
    updates: Partial<Trial>,
  ): Promise<AuthoringMutation<{ trial: Trial }>>;
  deleteTrial(
    experimentId: string | undefined,
    trialId: string | number,
  ): Promise<AuthoringMutation<Record<string, never>>>;
  deleteAllTrials(experimentId: string | undefined): Promise<{ success: true }>;
  createLoop(
    experimentId: string | undefined,
    loop: Omit<Loop, "id">,
  ): Promise<AuthoringMutation<{ loop: Loop }>>;
  getLoop(experimentId: string | undefined, loopId: string | number): Promise<Loop>;
  updateLoop(
    experimentId: string | undefined,
    loopId: string | number,
    updates: Partial<Loop>,
  ): Promise<AuthoringMutation<{ loop: Loop }>>;
  deleteLoop(
    experimentId: string | undefined,
    loopId: string | number,
  ): Promise<AuthoringMutation<Record<string, never>>>;
  updateTimeline(
    experimentId: string | undefined,
    timeline: TimelineItem[],
  ): Promise<AuthoringMutation<{ timeline: TimelineItem[] }>>;
  loadLoopBranchLevels(
    experimentId: string | undefined,
    sourceTrialId: string | number,
  ): Promise<LoopBranchLevelSnapshot>;
  createLoopBranch(
    experimentId: string | undefined,
    sourceTrialId: string | number,
    targetScopeId: string | null,
    mode: LoopBranchMode,
    options?: LoopBranchCommandOptions,
  ): Promise<LoopBranchMutation>;
}
