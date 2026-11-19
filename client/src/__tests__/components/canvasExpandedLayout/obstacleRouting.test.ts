import { describe, expect, it } from "vitest";
import { routeNavigationEdges } from "../../../pages/ExperimentBuilder/components/Canvas/services/navigationRouting";
import { findNavigationCurve } from "../../../pages/ExperimentBuilder/components/Canvas/services/navigationCurve";
import type {
  ExpandedCanvasLayout,
  ExpandedCanvasNode,
} from "../../../pages/ExperimentBuilder/components/Canvas/services/expandedLayoutTypes";
import { sampleCurves } from "./curveTestUtils";

// Geometry produced by the demo's automatic placement: an expanded, detached
// A -> B loop, both pointing at Final in the active Inicio -> Final sequence.
function scene(mirrored = false, dx = 0, dy = 0): ExpandedCanvasLayout {
  const node = (
    id: string,
    x: number,
    y: number,
    loop = false,
  ): ExpandedCanvasNode => ({
    id,
    type: loop ? "loop" : "trial",
    data: {
      scopeId: "root",
      itemId: id,
      name: id,
      role: loop ? "loop-marker" : "item",
      expanded: loop,
    },
    position: { x: (mirrored ? -x - (loop ? 140 : 180) : x) + dx, y: y + dy },
    measured: { width: loop ? 140 : 180, height: 50 },
    draggable: false,
  });
  return {
    nodes: [
      node("start", 500, 80),
      node("end", 500, 200),
      node("a", 1144, 124),
      node("b", 1144, 244),
      node("loop", 884, 184, true),
    ],
    edges: ["a", "b"].map((source) => ({
      id: source + "-end",
      source,
      target: "end",
      sourceHandle: "flow-source",
      targetHandle: "flow-target",
      type: "default",
      data: { kind: "flow", scopeId: "root" },
    })),
    exitIds: [],
  };
}

describe("routing between independently positioned structures", () => {
  it("uses an accessible narrow passage between overlapping obstacle groups", () => {
    const boxes = [
      { left: -40, right: 40, top: -50, bottom: 0 },
      { left: -350, right: -250, top: 30, bottom: 80 },
      { left: -200, right: -100, top: -10, bottom: 120 },
      { left: -220, right: -80, top: -300, bottom: -10 },
      { left: -250, right: -50, top: 124, bottom: 200 },
    ];
    const { curve } = findNavigationCurve(
      { x: 0, y: 0 },
      { x: -300, y: 30 },
      boxes,
      [
        { side: "left", x: -422 },
        { side: "right", x: 112 },
      ],
      false,
    );
    const points = sampleCurves(curve);
    for (const point of points) {
      expect(Number.isFinite(point.x) && Number.isFinite(point.y)).toBe(true);
      for (const box of boxes)
        expect(
          point.x > box.left + 1e-5 &&
            point.x < box.right - 1e-5 &&
            point.y > box.top + 1e-5 &&
            point.y < box.bottom - 1e-5,
        ).toBe(false);
    }
    expect(Math.max(...points.map((p) => p.y))).toBeLessThan(124);
    expect(Math.min(...points.map((p) => p.y))).toBeGreaterThan(-100);
    expect(
      points.some((p) => p.x < -100 && p.x > -200 && p.y > 120 && p.y < 124),
    ).toBe(true);
  });

  it("adapts the departure distance when another node is close below the source", () => {
    const boxes = [
      { left: -40, right: 40, top: -50, bottom: 0 },
      { left: -350, right: -250, top: 30, bottom: 80 },
      { left: -200, right: -100, top: -10, bottom: 120 },
      { left: -30, right: 30, top: 8, bottom: 100 },
    ];
    const { curve } = findNavigationCurve(
      { x: 0, y: 0 },
      { x: -300, y: 30 },
      boxes,
      [
        { side: "left", x: -422 },
        { side: "right", x: 112 },
      ],
      false,
    );
    expect(curve[0].control1.x).toBe(0);
    expect(curve[0].control1.y).toBeGreaterThan(0);
    for (const point of sampleCurves(curve))
      for (const box of boxes) {
        expect(
          point.x > box.left + 1e-5 &&
            point.x < box.right - 1e-5 &&
            point.y > box.top + 1e-5 &&
            point.y < box.bottom - 1e-5,
        ).toBe(false);
      }
  });

  it("does not fabricate a route through a node covering the departure connector", () => {
    expect(() =>
      findNavigationCurve(
        { x: 0, y: 0 },
        { x: 100, y: 100 },
        [{ left: -20, right: 20, top: -10, bottom: 20 }],
        [
          { side: "left", x: -72 },
          { side: "right", x: 172 },
        ],
        false,
      ),
    ).toThrow("Canvas curve cannot be routed outside node bounds");
  });

  it.each([
    [false, 0, 0],
    [true, 0, 0],
    [false, -1800, -400],
    [true, 1800, 600],
  ] as const)(
    "routes around the loop marker without moving nodes (mirror=%s, offset=%s,%s)",
    (mirrored, dx, dy) => {
      const layout = scene(mirrored, dx, dy),
        before = structuredClone(layout.nodes);
      routeNavigationEdges(layout);
      expect(layout.nodes).toEqual(before);
      for (const edge of layout.edges) {
        const curve = edge.data.curve!;
        const source = layout.nodes.find((n) => n.id === edge.source)!;
        const target = layout.nodes.find((n) => n.id === edge.target)!;
        expect(curve.length).toBeGreaterThan(0);
        expect(curve[0].start).toEqual({
          x: source.position.x + 90,
          y: source.position.y + 50,
        });
        expect(curve.at(-1)!.end).toEqual({
          x: target.position.x + 90,
          y: target.position.y,
        });
        expect(curve[0].control1.x).toBe(curve[0].start.x);
        expect(curve[0].control1.y).toBeGreaterThan(curve[0].start.y);
        expect(curve.at(-1)!.control2.x).toBe(curve.at(-1)!.end.x);
        expect(curve.at(-1)!.control2.y).toBeLessThan(curve.at(-1)!.end.y);
        for (let i = 1; i < curve.length; i++) {
          const previous = curve[i - 1],
            next = curve[i];
          expect(next.start).toEqual(previous.end);
          const a = {
            x: previous.end.x - previous.control2.x,
            y: previous.end.y - previous.control2.y,
          };
          const b = {
            x: next.control1.x - next.start.x,
            y: next.control1.y - next.start.y,
          };
          expect(a.x * b.y - a.y * b.x).toBeCloseTo(0, 6);
          expect(a.x * b.x + a.y * b.y).toBeGreaterThan(0);
        }
        for (const point of sampleCurves(curve)) {
          for (const node of layout.nodes) {
            const padding =
              node.id === source.id || node.id === target.id
                ? 0
                : node.type === "loop"
                  ? 18
                  : 12;
            const inside =
              point.x > node.position.x - padding + 1e-5 &&
              point.x <
                node.position.x + node.measured.width + padding - 1e-5 &&
              point.y > node.position.y - padding + 1e-5 &&
              point.y < node.position.y + node.measured.height + padding - 1e-5;
            expect(inside, edge.id + " crosses " + node.id).toBe(false);
          }
          // The detour should stay local to the actual diagram, rather than
          // exhausting increasingly distant lateral lanes.
          expect(point.x).toBeGreaterThan(
            Math.min(...layout.nodes.map((n) => n.position.x)) - 200,
          );
          expect(point.x).toBeLessThan(
            Math.max(
              ...layout.nodes.map((n) => n.position.x + n.measured.width),
            ) + 200,
          );
        }
      }
      const again = scene(mirrored, dx, dy);
      routeNavigationEdges(again);
      expect(again.edges.map((e) => e.data.curve)).toEqual(
        layout.edges.map((e) => e.data.curve),
      );
    },
  );
});
