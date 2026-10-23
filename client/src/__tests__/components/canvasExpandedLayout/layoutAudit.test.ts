import { expect, it } from "vitest";
import { routeNavigationEdges } from "../../../pages/ExperimentBuilder/components/Canvas/services/navigationRouting";
import { getNavigationPath } from "../../../pages/ExperimentBuilder/components/Canvas/services/navigationCurve";
import { placeDirectedBlocks } from "../../../pages/ExperimentBuilder/components/Canvas/services/directedLayout";
import { center, loop, render, scene, trial } from "./symmetryFixtures";
import { buildUnifiedFlowLayout } from "../../../pages/ExperimentBuilder/components/Canvas/services/buildUnifiedFlowLayout";
import type { ExpandedCanvasLayout } from "../../../pages/ExperimentBuilder/components/Canvas/services/expandedLayoutTypes";

it("does not treat a loop circuit as an obstacle for a local return", () => {
  const base = render([trial("A", ["B"]), trial("B", ["A"]), trial("distant")]);
  const makeLayout = (): ExpandedCanvasLayout => ({
    nodes: base.nodes.map((value) => ({
      ...value,
      data: { ...value.data, scopeId: "inner" },
      position:
        value.data.itemId === "distant"
          ? { x: 900, y: 2000 }
          : { ...value.position },
    })),
    edges: base.edges.map((value) => ({
      ...value,
      data: { ...value.data, curve: undefined },
    })),
  });
  const withoutCircuit = makeLayout(),
    withCircuit = makeLayout();
  withCircuit.nodes.forEach((value) => {
    value.data.scopeId = "another-scope";
  });
  routeNavigationEdges(withoutCircuit);
  routeNavigationEdges(withCircuit);
  expect(withCircuit.edges.map((edge) => edge.data.curve)).toEqual(
    withoutCircuit.edges.map((edge) => edge.data.curve),
  );
});

it("preserves authored branch order when one destination is outside the current scope", () => {
  const blocks = ["A", "B", "C", "D"].map((id) => ({
    id,
    left: 90,
    right: 90,
    height: 50,
    external: id === "B",
  }));
  const edges = ["B", "C", "D"].map((target, order) => ({
    id: target,
    source: "A",
    target,
    order,
  }));
  const { positions } = placeDirectedBlocks(blocks, edges, "A");
  expect(positions.get("B")!.x).toBeLessThan(positions.get("C")!.x);
  expect(positions.get("C")!.x).toBeLessThan(positions.get("D")!.x);
});

it("preserves the planned tangents when binding the curve to measured handles", () => {
  const curve = [
    {
      start: { x: 0, y: 0 },
      control1: { x: 0, y: 20 },
      control2: { x: 0, y: 180 },
      end: { x: 0, y: 200 },
    },
  ];
  const original = structuredClone(curve);
  expect(getNavigationPath(curve, { x: 5, y: 7 }, { x: 3, y: 193 })).toBe(
    "M 5,7 C 5,27 3,173 3,193",
  );
  expect(curve).toEqual(original);
});

it.each([[], ["L1"], ["L2"], ["L1", "L2"]].map((open) => ({ open })))(
  "preserves authored destination order through visible containers: $open",
  ({ open }) => {
    const input = scene(
      [trial("A", ["Q", "P", "Z"]), loop("L1"), loop("L2"), trial("Z")],
      [
        {
          loop: { id: "L1", name: "L1", parentLoopId: null },
          items: [trial("P")],
        },
        {
          loop: { id: "L2", name: "L2", parentLoopId: null },
          items: [trial("Q")],
        },
      ],
    );
    const result = buildUnifiedFlowLayout({
      ...input,
      expandedPath: input.expandedPath.filter((entry) =>
        open.includes(String(entry.loop.id)),
      ),
      branchEdges: [...input.branchEdges].reverse(),
    });
    const first = open.includes("L2") ? "Q" : "L2";
    const second = open.includes("L1") ? "P" : "L1";
    expect(center(result, first)).toBeLessThan(center(result, second));
    expect(center(result, second)).toBeLessThan(center(result, "Z"));
    expect(
      result.edges.flatMap((edge) => edge.data.semanticEdgeIds ?? []),
    ).toHaveLength(3);
  },
);
