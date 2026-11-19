import { required } from "./valueUtils.js";
import type { WorkspaceModelOptions, ModelServices } from "./modelContracts.js";
import { createWorkspaceModel } from "./model.js";
import { modelDocument } from "./documentAdapter.js";
import { createUniqueItemName } from "./names.js";
import { getLoopBranchLevels } from "./loopBranching/scopeGraph.js";
import { createLoopBranch } from "./loopBranching/createLoopBranch.js";

export function workspaceModel(options: WorkspaceModelOptions = {}) {
  const services: ModelServices = {
    createUniqueItemName,
    layout: (s) =>
      options.layout?.(s) ?? {
        positions: Object.fromEntries(
          [...s.trials, ...s.loops].map((t, i) => [
            t.id,
            s.anchors[t.id] ?? { x: 800, y: 80 + i * 120 },
          ]),
        ),
      },
    insertionEndpoints(s, id, entryId) {
      if (options.insertionEndpoints)
        return options.insertionEndpoints(s, id, entryId);
      const c = model.componentFor(s, id);
      if (!c || c.locked) return null;
      if (!options.endpoints)
        throw Error("Canonical structure endpoints are required");
      const value = {
        entryId: entryId ?? options.endpoints.entryId,
        exitId: options.endpoints.exitId,
        ids: [...c.ids],
      };
      const reachable = model.reachable({
        ...s,
        entryId: value.entryId,
      }).trials;
      if (
        !c.trials.has(value.entryId) ||
        !c.trials.has(value.exitId) ||
        !reachable.has(value.exitId)
      )
        throw Error("Invalid structure endpoints");
      return value;
    },
    loopBranchLevels(s, sourceId, contextId = sourceId) {
      const doc = modelDocument(s),
        source = doc.trials.find((t) => t.id === sourceId),
        context = doc.trials.find((t) => t.id === contextId);
      if (!source || !context) throw Error("Source must be a trial");
      return getLoopBranchLevels(doc, {
        ...context,
        branches: source.branches,
      });
    },
    selectLoopBranchLevel({ levels }, scopeId) {
      const level = levels.find((l) => l.scopeId === scopeId);
      return level ? { level, requiresPlacement: level.branchCount > 0 } : null;
    },
    planLoopBranch(s, sourceId, scopeId, mode) {
      const document = modelDocument(s),
        source = required(document.trials.find((t) => t.id === sourceId));
      const result = createLoopBranch(
        document,
        source,
        scopeId,
        mode,
        "workspace",
        (doc) => {
          let n = 1;
          while (doc.trials.some((t) => String(t.id) === String(n))) n++;
          return n;
        },
      );
      if ("error" in result) throw Error(result.error);
      return {
        document,
        source,
        trial: result.trial,
        crossedLoopIds: result.crossedLoopIds,
      };
    },
  };
  const model = createWorkspaceModel(services);
  return model;
}
