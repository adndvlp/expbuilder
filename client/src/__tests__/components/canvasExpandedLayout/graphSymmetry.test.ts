import { describe, expect, it } from "vitest";
import { MarkerType } from "@xyflow/react";
import { buildUnifiedFlowLayout } from "../../../pages/ExperimentBuilder/components/Canvas/services/buildUnifiedFlowLayout";
import { getLoopCircuitPoints } from "../../../pages/ExperimentBuilder/components/Canvas/services/loopRoutingPath";
import {
  center,
  diamond,
  loop,
  nestedScene,
  node,
  render,
  scene,
  trial,
} from "./symmetryFixtures";

describe("graph symmetry from the approved canvas demo", () => {
  it("centers a shared destination between both parents without duplicating it", () => {
    const oneParent = render(diamond(false));
    const shared = render(diamond());
    expect(center(oneParent, "D")).toBeCloseTo(center(oneParent, "B"));
    expect(center(shared, "D")).toBeCloseTo(
      (center(shared, "B") + center(shared, "C")) / 2,
    );
    expect(
      shared.nodes.filter((value) => value.data.itemId === "D"),
    ).toHaveLength(1);
    expect(node(shared, "D").position.y).toBeGreaterThan(
      node(shared, "C").position.y,
    );
  });

  it("places a connection between branches after all its forward parents", () => {
    const result = render([
      trial("A", ["B", "C"]),
      trial("B", ["D"]),
      trial("C", ["E"]),
      trial("D", ["F", "E"]),
      trial("E", ["F"]),
      trial("F"),
    ]);
    expect(node(result, "E").position.y).toBeGreaterThan(
      node(result, "D").position.y,
    );
    expect(node(result, "F").position.y).toBeGreaterThan(
      node(result, "E").position.y,
    );
    const bypass = result.edges.find(
      (edge) =>
        edge.source === node(result, "D").id &&
        edge.target === node(result, "F").id,
    );
    expect(bypass?.data.curve?.length).toBeGreaterThan(1);
    expect(
      result.edges.filter((edge) => edge.data.kind === "flow"),
    ).toHaveLength(7);
  });

  it("keeps the explicit entry above the diamond while drawing its return", () => {
    const items = diamond();
    items[3] = trial("D", ["A"]);
    const input = scene(items);
    const result = buildUnifiedFlowLayout(input);
    expect(result.nodes).toHaveLength(4);
    expect(node(result, "A").position.y).toBeLessThan(
      node(result, "B").position.y,
    );
    const back = result.edges.find(
      (edge) =>
        edge.source === node(result, "D").id &&
        edge.target === node(result, "A").id,
    );
    expect(back?.data.curve?.length).toBeGreaterThan(1);
    const snapshot = (value: typeof result) =>
      value.nodes
        .map((n) => [n.id, n.position])
        .sort(([a], [b]) => String(a).localeCompare(String(b)));
    expect(
      snapshot(
        buildUnifiedFlowLayout({
          ...input,
          timeline: [...items].reverse(),
          branchEdges: [...input.branchEdges].reverse(),
        }),
      ),
    ).toEqual(snapshot(result));
  });

  it.each([3, 8])(
    "supports returns and root exits through %s nested loops",
    (depth) => {
      const input = nestedScene(depth);
      const original = JSON.stringify(input);
      const result = buildUnifiedFlowLayout(input);
      expect(node(result, "P0").position.y).toBeLessThan(
        node(result, `P${depth - 1}`).position.y,
      );
      expect(node(result, "T").position.y).toBeGreaterThan(
        node(result, `P${depth - 1}`).position.y,
      );
      expect(result.nodes).toHaveLength(2 + depth * 2);
      expect(
        result.edges.filter((edge) => edge.data.kind === "loop-return"),
      ).toHaveLength(depth);
      expect(new Set(result.nodes.map((value) => value.id)).size).toBe(
        result.nodes.length,
      );
      expect(
        result.edges.flatMap((edge) => edge.data.semanticEdgeIds ?? []),
      ).toHaveLength(input.branchEdges.length);
      expect(JSON.stringify(input)).toBe(original);
    },
  );

  it("preserves terminal routes and disconnected components without connecting them", () => {
    const result = render([
      trial("A", ["B"]),
      trial("B"),
      trial("isolated"),
      trial("self", ["self"]),
    ]);
    expect(result.nodes).toHaveLength(4);
    const flow = result.edges.filter((edge) => edge.data.kind === "flow");
    expect(flow).toHaveLength(2);
    expect(
      flow.some(
        (edge) =>
          edge.source === node(result, "self").id &&
          edge.target === node(result, "self").id,
      ),
    ).toBe(true);
    expect(
      flow.some((edge) => edge.target === node(result, "isolated").id),
    ).toBe(false);
  });

  it("adds matching arrowheads and makes loop dots run down the left side", () => {
    const result = buildUnifiedFlowLayout(nestedScene());
    for (const edge of result.edges) {
      expect(edge.markerEnd).toMatchObject({
        type: MarkerType.ArrowClosed,
        color: edge.style.stroke,
      });
    }
    const points = getLoopCircuitPoints({
      sourceX: 200,
      sourceY: 250,
      targetX: 200,
      targetY: 200,
      routeX: 700,
      routeTopY: 100,
      routeBottomY: 560,
    });
    expect(points[0]).toEqual({ x: 200, y: 250 });
    expect(points[1].y).toBeGreaterThan(points[0].y);
    expect(points.at(-1)).toEqual({ x: 200, y: 200 });
  });

  it("places the declared continuation after an expanded loop independently of record order", () => {
    const expanded = [
      {
        loop: { id: "L", name: "Loop", parentLoopId: null },
        items: [trial("P")],
      },
    ];
    const input = scene(
      [trial("T"), loop("L", "T"), trial("A", ["P"])],
      expanded,
    );
    const result = buildUnifiedFlowLayout(input);
    expect(node(result, "T").position.y).toBeGreaterThan(
      node(result, "P").position.y,
    );
    expect(
      result.edges.some(
        (edge) =>
          edge.source === node(result, "P").id &&
          edge.target === node(result, "T").id,
      ),
    ).toBe(true);
  });

  it("orients a cycle from its declared entry when the root starts in a loop", () => {
    const input = scene(
      [loop("L")],
      [
        {
          loop: { id: "L", name: "Loop", parentLoopId: null },
          items: [trial("A", ["B"]), trial("B", ["A"])],
        },
      ],
      "L",
    );
    input.entryItemIds["loop-scope:L"] = "B";
    const result = buildUnifiedFlowLayout(input);
    expect(node(result, "B").position.y).toBeLessThan(
      node(result, "A").position.y,
    );
    const forward = result.edges.find(
      (edge) =>
        edge.source === node(result, "B").id &&
        edge.target === node(result, "A").id,
    );
    expect(forward?.data.isReturn).not.toBe(true);
  });
});
