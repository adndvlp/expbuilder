import type {
  CommandKind,
  CommandArgs,
} from "../../../../../../shared/experiment-workspace/dist/commandTypes.js";
import { isRegenerableTrialCode } from "../../../../../../shared/experiment-workspace/dist/codeCache.js";
import type { ExperimentAuthoringClient } from "../experiment-authoring/types";
import type { createWorkspaceClient } from "./client";
import type { Trial, Loop } from "../../components/ConfigurationPanel/types";

export function adaptWorkspaceAuthoring(
  legacy: ExperimentAuthoringClient,
  workspace: ReturnType<typeof createWorkspaceClient>,
): ExperimentAuthoringClient {
  const active = (id: string | undefined) =>
    !!id && workspace.peek(id)?.document.workspaceSchemaVersion === 2;
  const run = <K extends CommandKind>(
    id: string | undefined,
    kind: K,
    args: CommandArgs[K],
    recordHistory = true,
  ) => {
    if (!id) throw Error("Experiment ID is required");
    return workspace.command(id, kind, args, undefined, { recordHistory });
  };
  const item = <T extends Trial | Loop>(items: T[], id: unknown) => {
    const value = items.find((t) => String(t.id) === String(id));
    if (!value) throw Error("Item not found");
    return structuredClone(value);
  };
  return {
    ...legacy,
    async getGraph(id) {
      return active(id)
        ? (await workspace.load(id!, true)).graph
        : legacy.getGraph(id);
    },
    async getTrial(id, target) {
      return active(id)
        ? item(workspace.peek(id!)!.document.trials, target)
        : legacy.getTrial(id, target);
    },
    async getLoop(id, target) {
      return active(id)
        ? item(workspace.peek(id!)!.document.loops, target)
        : legacy.getLoop(id, target);
    },
    async createTrial(id, trial) {
      if (!active(id)) return legacy.createTrial(id, trial);
      const result = await run(id, "addTrial", { trial });
      return { ...result, trial: item(result.document.trials, result.result) };
    },
    async updateTrial(id, trialId, updates) {
      if (!active(id)) return legacy.updateTrial(id, trialId, updates);
      const record = item(workspace.peek(id!)!.document.trials, trialId);
      const cacheUpdate = Object.prototype.hasOwnProperty.call(
        updates,
        "trialCode",
      );
      if (cacheUpdate && updates.trialCodeSource === undefined)
        updates = { ...updates, trialCodeSource: "generated" };
      const derived =
        cacheUpdate &&
        Object.keys(updates).every((key) =>
          ["trialCode", "trialCodeSource"].includes(key),
        ) &&
        isRegenerableTrialCode({ ...record, ...updates });
      const result = await run(
        id,
        "updateTrial",
        { trialId, updates },
        !derived,
      );
      return { ...result, trial: item(result.document.trials, trialId) };
    },
    async deleteTrial(id, trialId) {
      return active(id)
        ? run(id, "deleteItems", { ids: [trialId] })
        : legacy.deleteTrial(id, trialId);
    },
    async deleteAllTrials(id) {
      return active(id)
        ? run(id, "deleteItems", {
            ids: [
              ...workspace.peek(id!)!.document.trials,
              ...workspace.peek(id!)!.document.loops,
            ].map((t) => t.id),
          })
        : legacy.deleteAllTrials(id);
    },
    async createLoop(id, loop) {
      if (!active(id)) return legacy.createLoop(id, loop);
      const result = await run(id, "groupLoop", {
        ids: loop.trials,
        name: loop.name,
        loop,
      });
      return { ...result, loop: item(result.document.loops, result.result) };
    },
    async updateLoop(id, loopId, updates) {
      if (!active(id)) return legacy.updateLoop(id, loopId, updates);
      const derived =
        Object.keys(updates).length === 1 &&
        Object.prototype.hasOwnProperty.call(updates, "code");
      const result = await run(id, "updateLoop", { loopId, updates }, !derived);
      return { ...result, loop: item(result.document.loops, loopId) };
    },
    async deleteLoop(id, loopId) {
      return active(id)
        ? run(id, "deleteLoop", { loopId })
        : legacy.deleteLoop(id, loopId);
    },
    async updateTimeline(id, timeline) {
      if (!active(id)) return legacy.updateTimeline(id, timeline);
      const result = await run(id, "reorderRoot", {
        ids: timeline.map((i) => i.id),
      });
      return { ...result, timeline: result.graph.root.items };
    },
  };
}
