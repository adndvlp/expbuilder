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

export const fulfillGraph = (snapshot: ExperimentGraphSnapshot) => ({
  status: 200,
  contentType: "application/json",
  body: JSON.stringify({ graph: snapshot }),
});

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
