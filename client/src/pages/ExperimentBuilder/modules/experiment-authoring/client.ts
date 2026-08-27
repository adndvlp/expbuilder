import { createJsonTransport, type FetchLike } from "./http";
import type {
  AuthoringMutation,
  CreateExperimentInput,
  ExperimentAuthoringClient,
  ExperimentRecord,
  LoopBranchMutation,
} from "./types";
import type { Loop, Trial } from "../../components/ConfigurationPanel/types";
import type { TimelineItem } from "../../contexts/TrialsContext";
import type { ExperimentGraphSnapshot } from "../experiment-graph/types";
import type {
  LoopBranchCommandOptions,
  LoopBranchLevelSnapshot,
  LoopBranchMode,
} from "../../components/Canvas/features/loop-branching/types";

const json = (body: unknown): RequestInit => ({
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

const createIdempotencyKey = () =>
  globalThis.crypto?.randomUUID?.() ??
  `loop-branch-${Date.now()}-${Math.random().toString(36).slice(2)}`;

function experimentPath(
  route: string,
  experimentId: string | undefined,
  itemId?: string | number,
) {
  if (!experimentId) throw new Error("Experiment ID is required");
  const base = `${route}/${encodeURIComponent(experimentId)}`;
  return itemId === undefined
    ? base
    : `${base}/${encodeURIComponent(String(itemId))}`;
}

export function createExperimentAuthoringClient(options: {
  baseUrl?: string;
  fetchImpl?: FetchLike;
}): ExperimentAuthoringClient {
  const transport = createJsonTransport(options);

  return {
    async createExperiment(input: CreateExperimentInput) {
      const result = await transport.request<{
        success: boolean;
        experiment?: ExperimentRecord;
      }>("/api/create-experiment", { method: "POST", ...json(input) });
      if (!result.success || !result.experiment) {
        throw new Error("Experiment creation did not return an experiment");
      }
      return result.experiment;
    },

    async getGraph(experimentId: string) {
      const result = await transport.request<{ graph: ExperimentGraphSnapshot }>(
        experimentPath("/api/experiment-graph", experimentId),
      );
      return result.graph;
    },

    async createTrial(experimentId: string, trial: Omit<Trial, "id">) {
      return transport.request<AuthoringMutation<{ trial: Trial }>>(
        experimentPath("/api/trial", experimentId),
        { method: "POST", ...json(trial) },
      );
    },

    async getTrial(experimentId: string, trialId: string | number) {
      const result = await transport.request<{ trial: Trial }>(
        experimentPath("/api/trial", experimentId, trialId),
      );
      return result.trial;
    },

    async updateTrial(experimentId, trialId, updates) {
      return transport.request<AuthoringMutation<{ trial: Trial }>>(
        experimentPath("/api/trial", experimentId, trialId),
        { method: "PATCH", ...json(updates) },
      );
    },

    async deleteTrial(experimentId, trialId) {
      return transport.request<AuthoringMutation<Record<string, never>>>(
        experimentPath("/api/trial", experimentId, trialId),
        { method: "DELETE" },
      );
    },

    async deleteAllTrials(experimentId) {
      return transport.request<{ success: true }>(
        experimentPath("/api/trials", experimentId),
        { method: "DELETE" },
      );
    },

    async createLoop(experimentId: string, loop: Omit<Loop, "id">) {
      return transport.request<AuthoringMutation<{ loop: Loop }>>(
        experimentPath("/api/loop", experimentId),
        { method: "POST", ...json(loop) },
      );
    },

    async getLoop(experimentId: string, loopId: string | number) {
      const result = await transport.request<{ loop: Loop }>(
        experimentPath("/api/loop", experimentId, loopId),
      );
      return result.loop;
    },

    async updateLoop(experimentId, loopId, updates) {
      return transport.request<AuthoringMutation<{ loop: Loop }>>(
        experimentPath("/api/loop", experimentId, loopId),
        { method: "PATCH", ...json(updates) },
      );
    },

    async deleteLoop(experimentId, loopId) {
      return transport.request<AuthoringMutation<Record<string, never>>>(
        experimentPath("/api/loop", experimentId, loopId),
        { method: "DELETE" },
      );
    },

    async updateTimeline(experimentId: string, timeline: TimelineItem[]) {
      return transport.request<
        AuthoringMutation<{ timeline: TimelineItem[] }>
      >(experimentPath("/api/timeline", experimentId), {
        method: "PATCH",
        ...json({ timeline }),
      });
    },

    async loadLoopBranchLevels(experimentId, sourceTrialId) {
      const result = await transport.request<LoopBranchLevelSnapshot>(
        experimentPath(
          "/api/loop-branch-levels",
          experimentId,
          sourceTrialId,
        ),
      );
      return { levels: result.levels ?? [], revision: result.revision };
    },

    async createLoopBranch(
      experimentId,
      sourceTrialId,
      targetScopeId,
      mode: LoopBranchMode,
      options: LoopBranchCommandOptions = {},
    ) {
      const expectedRevision =
        options.expectedRevision ??
        (
          await transport.request<{ graph: ExperimentGraphSnapshot }>(
            experimentPath("/api/experiment-graph", experimentId),
          )
        ).graph.revision;
      return transport.request<LoopBranchMutation>(
        experimentPath("/api/loop-branch", experimentId),
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key":
              options.idempotencyKey ?? createIdempotencyKey(),
          },
          body: JSON.stringify({
            sourceTrialId,
            targetScopeId,
            mode,
            expectedRevision,
          }),
        },
      );
    },
  };
}
