import { describe, expect, it } from "vitest";
import { buildUnifiedFlowLayout } from "../../../pages/ExperimentBuilder/components/Canvas/services/buildUnifiedFlowLayout";
import { getCanvasLayoutBounds } from "../../../pages/ExperimentBuilder/components/Canvas/services/canvasLayoutBounds";
import { getCanvasLayoutSignature } from "../../../pages/ExperimentBuilder/components/Canvas/services/getCanvasLayoutSignature";
import { center, nestedScene, node, render, trial } from "./symmetryFixtures";
import { sampleCurves } from "./curveTestUtils";
const returning = () =>
  render([
    trial("A", ["B", "D"]),
    trial("B", ["C"]),
    trial("C", ["D", "A"]),
    trial("D", ["B"]),
  ]);

describe("curved navigation geometry", () => {
  it("draws a wide continuous arc around an intermediate node", () => {
    const result = render([
      trial("A", ["B", "C"]),
      trial("B", ["C"]),
      trial("C"),
    ]);
    const source = node(result, "A"),
      target = node(result, "C"),
      middle = node(result, "B");
    const edge = result.edges.find(
      (edge) => edge.source === source.id && edge.target === target.id,
    )!;
    const curve = edge.data.curve;
    expect(edge.type).toBe("navigation");
    expect(curve).toHaveLength(2);
    expect(curve![0].start).toEqual({
      x: center(result, "A"),
      y: source.position.y + source.measured.height,
    });
    expect(curve!.at(-1)!.end).toEqual({
      x: center(result, "C"),
      y: target.position.y,
    });
    const join = curve![0].end;
    expect(Math.abs(join.x - center(result, "B"))).toBeGreaterThan(
      middle.measured.width / 2 + 20,
    );
    expect(join.y).toBeGreaterThan(middle.position.y);
    expect(join.y).toBeLessThan(middle.position.y + middle.measured.height);
    expect(curve![1].start).toEqual(join);
    expect(curve![0].control2.x).toBeCloseTo(join.x);
    expect(curve![1].control1.x).toBeCloseTo(join.x);
  });

  it.each(["returns", "nested", "self"])(
    "avoids node interiors along the actual %s curves",
    (kind) => {
      const result =
        kind === "nested"
          ? buildUnifiedFlowLayout(nestedScene(5))
          : kind === "self"
            ? render([trial("A", ["A"])])
            : returning();
      for (const edge of result.edges.filter(
        (edge) => edge.data.kind === "flow",
      )) {
        expect(edge.data.curve?.length).toBeGreaterThan(0);
        const segments = edge.data.curve!;
        expect(segments[0].control1.x).toBeCloseTo(segments[0].start.x);
        expect(segments[0].control1.y).toBeGreaterThan(segments[0].start.y);
        expect(segments.at(-1)!.control2.x).toBeCloseTo(segments.at(-1)!.end.x);
        expect(segments.at(-1)!.control2.y).toBeLessThan(
          segments.at(-1)!.end.y,
        );
        for (const point of sampleCurves(segments)) {
          for (const value of result.nodes) {
            const { x, y } = value.position;
            const inside =
              point.x > x + 1 &&
              point.x < x + value.measured.width - 1 &&
              point.y > y + 1 &&
              point.y < y + value.measured.height - 1;
            expect(inside, `${kind}: ${edge.id} crosses ${value.id}`).toBe(
              false,
            );
          }
        }
      }
    },
  );

  it("frames the curved paths and invalidates fitting when a control changes", () => {
    const result = returning();
    const bounds = getCanvasLayoutBounds(result.nodes, result.edges)!;
    for (const edge of result.edges.filter(
      (edge) => edge.data.kind === "flow",
    )) {
      expect(edge.data.curve?.length).toBeGreaterThan(0);
      for (const point of sampleCurves(edge.data.curve!)) {
        expect(point.x).toBeGreaterThanOrEqual(bounds.x - 1e-6);
        expect(point.x).toBeLessThanOrEqual(bounds.x + bounds.width + 1e-6);
        expect(point.y).toBeGreaterThanOrEqual(bounds.y - 1e-6);
        expect(point.y).toBeLessThanOrEqual(bounds.y + bounds.height + 1e-6);
      }
    }
    const original = getCanvasLayoutSignature(result.nodes, result.edges);
    result.edges.find(
      (edge) => edge.data.curve?.length,
    )!.data.curve![0].control1.x += 200;
    expect(getCanvasLayoutSignature(result.nodes, result.edges)).not.toBe(
      original,
    );
  });
});
