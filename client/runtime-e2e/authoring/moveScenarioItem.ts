import { moveScopedItem } from "../../src/pages/ExperimentBuilder/components/Canvas/actions/moveActions";
import type { CanvasActionDependencies } from "../../src/pages/ExperimentBuilder/components/Canvas/actions/types";
import type { ExperimentAuthoringClient } from "../../src/pages/ExperimentBuilder/modules/experiment-authoring/types";

type MoveScenarioItemOptions = {
  client: ExperimentAuthoringClient;
  dependencies: CanvasActionDependencies;
  destinationId: string | number;
  experimentId: string;
  itemId: string | number;
  scopeId: string | number | null;
};

export async function moveScenarioItem(options: MoveScenarioItemOptions) {
  const graph = await options.client.getGraph(options.experimentId);
  const scope = options.scopeId === null
    ? { kind: "root" as const, items: graph.root.items }
    : {
        kind: "loop" as const,
        loopId: options.scopeId,
        items: graph.scopes[String(options.scopeId)]?.items ?? [],
        rootItems: graph.root.items,
      };
  const item = scope.items.find(
    (candidate) => String(candidate.id) === String(options.itemId),
  );
  if (!item) throw new Error(`Could not find ${options.itemId} in move scope`);
  const result = await moveScopedItem({
    scope,
    dependencies: options.dependencies,
    item,
    destinationId: options.destinationId,
    addAsBranch: false,
  });
  if (result.status !== "moved") throw new Error("Move destination not found");
  return options.client.getGraph(options.experimentId);
}
