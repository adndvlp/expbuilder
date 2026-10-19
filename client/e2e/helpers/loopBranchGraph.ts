import type { Page } from "@playwright/test";
import type {
  ExperimentGraphSnapshot,
  GraphBranchEdge,
  GraphScopeView,
  TimelineItem,
} from "../../src/pages/ExperimentBuilder/modules/experiment-graph/types";

export const edgeId = (source: string, target: string) =>
  ["edge", "flow", source, target].map(encodeURIComponent).join("::");

export const graph = (
  rootItems: TimelineItem[],
  scopes: Record<string, GraphScopeView>,
  edges: GraphBranchEdge[],
): ExperimentGraphSnapshot => ({
  revision: "visual-regression",
  root: { scopeId: null, parentScopeId: null, items: rootItems },
  scopes,
  edges,
  diagnostics: [],
});

export const graphScope = (
  scopeId: GraphScopeView["scopeId"],
  parentScopeId: GraphScopeView["parentScopeId"],
  items: TimelineItem[],
): GraphScopeView => ({ scopeId, parentScopeId, items });

export const fulfillGraph = (snapshot: ExperimentGraphSnapshot) => {
  const items = [snapshot.root, ...Object.values(snapshot.scopes)].flatMap(
    (scope) => scope.items,
  );
  const loopIds = new Set(
    items.filter((item) => item.type === "loop").map((item) => String(item.id)),
  );
  items.forEach((item) => {
    if (item.type === "loop") {
      if (
        Object.hasOwn(item, "branches") ||
        Object.hasOwn(item, "branchConditions")
      )
        throw new Error(`Loop fixture ${item.id} cannot own branching fields`);
    } else if ((item.branches ?? []).some((id) => loopIds.has(String(id)))) {
      throw new Error(`Trial fixture ${item.id} cannot branch to a loop`);
    }
  });
  snapshot.edges.forEach((edge) => {
    if (
      loopIds.has(String(edge.sourceId)) ||
      loopIds.has(String(edge.targetId))
    )
      throw new Error(
        `Graph fixture edge ${edge.sourceId} → ${edge.targetId} must connect trials`,
      );
  });
  return {
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ graph: snapshot }),
  };
};

export const routeGraph = (
  page: Page,
  experimentId: string,
  snapshot: ExperimentGraphSnapshot,
) =>
  page.route(`**/api/experiment-graph/${experimentId}`, (route) =>
    route.fulfill(fulfillGraph(snapshot)),
  );

export const branchEdge = (
  sourceId: string | number,
  targetId: string | number,
  sourceOwnerId: string | null,
  targetOwnerId: string | null,
  exitedLoopIds: string[] = [],
): GraphBranchEdge => ({
  sourceId,
  targetId,
  sourceOwnerId,
  targetOwnerId,
  exitedLoopIds,
});
