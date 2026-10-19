import { expect, it } from "vitest";
import { composeExpandedLoopLayout } from "../../../pages/ExperimentBuilder/components/Canvas/services/composeExpandedLoopLayout";

it("keeps return connections and a self revisit visible without duplicating nodes", () => {
  const branchEdges = [
    [1, 1],
    [1, 2],
    [2, 1],
  ].map(([sourceId, targetId]) => ({
    sourceId,
    targetId,
    sourceOwnerId: null,
    targetOwnerId: null,
    exitedLoopIds: [],
  }));
  const layout = composeExpandedLoopLayout({
    rootTimeline: [
      {
        id: 1,
        type: "trial",
        name: "A",
        branches: [1, 2],
        defaultNextTrialId: null,
      },
      {
        id: 2,
        type: "trial",
        name: "B",
        branches: [1],
        defaultNextTrialId: null,
      },
    ],
    expandedScopes: [],
    branchEdges,
  });
  expect(layout.nodes).toHaveLength(2);
  expect(
    layout.edges.filter((edge) => edge.data.semanticEdgeIds?.length),
  ).toHaveLength(3);
  expect(layout.edges.some((edge) => edge.source === edge.target)).toBe(true);
});
