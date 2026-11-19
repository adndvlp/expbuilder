import type { ExperimentGraphSnapshot } from "../../src/pages/ExperimentBuilder/modules/experiment-graph/types";
import type { WorkspaceDocument } from "../../../shared/experiment-workspace/dist/types.js";
import { executeWorkspaceCommand } from "../../../server/routes/workspace/executeCommand.js";

// Existing visual scenarios describe scope order and explicit branch edges.
// Turn that data into complete persisted records using the application's converter.
export function workspaceDocument(
  snapshot: ExperimentGraphSnapshot,
  experimentID: string,
): WorkspaceDocument {
  const explicit = Object.hasOwn(snapshot.root, "entryItemId");
  const groups = [snapshot.root, ...Object.values(snapshot.scopes)];
  const trials = groups.flatMap((scope) =>
    scope.items.flatMap((item) => {
      if (item.type !== "trial") return [];
      const branches =
        item.branches ??
        snapshot.edges
          .filter((edge) => String(edge.sourceId) === String(item.id))
          .map((edge) => edge.targetId);
      return [
        {
          id: item.id,
          name: item.name,
          type: "Trial",
          plugin: "plugin-dynamic",
          parentLoopId: scope.scopeId,
          parameters: {},
          trialCode: "",
          branches,
          branchConditions: [],
          ...(explicit
            ? {
                defaultNextTrialId:
                  item.defaultNextTrialId ?? branches[0] ?? null,
              }
            : {}),
        },
      ];
    }),
  );
  const loops = groups.flatMap((scope) =>
    scope.items.flatMap((item) => {
      if (item.type !== "loop") return [];
      const contents = snapshot.scopes[String(item.id)];
      if (!contents)
        throw new Error(`Loop fixture ${item.id} is missing its scope`);
      return [
        {
          id: String(item.id),
          name: item.name,
          parentLoopId: scope.scopeId,
          trials: contents.items.map((child) => child.id),
          ...(explicit
            ? {
                entryItemId:
                  contents.entryItemId ?? contents.items[0]?.id ?? null,
                nextItemId: item.nextItemId ?? null,
              }
            : {}),
        },
      ];
    }),
  );
  const doc = {
    experimentID,
    authoringRevision: "1",
    updatedAt: "fixture",
    timeline: snapshot.root.items.map(({ id, type, name }) => ({
      id,
      type,
      name,
    })),
    trials,
    loops,
    ...(explicit ? { entryItemId: snapshot.root.entryItemId } : {}),
  };
  const data = {
    experiments: [{ experimentID }],
    trials: [doc],
    mutationReceipts: [],
  };
  return executeWorkspaceCommand(
    data,
    experimentID,
    {
      kind: "convertWorkspace",
      args: {},
      expectedRevision: "1",
    },
    "fixture-conversion",
  ).document;
}
