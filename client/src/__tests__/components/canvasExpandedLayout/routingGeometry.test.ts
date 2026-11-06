import { expect, it } from "vitest";
import { buildUnifiedFlowLayout } from "../../../pages/ExperimentBuilder/components/Canvas/services/buildUnifiedFlowLayout";
import { getCanvasLayoutBounds } from "../../../pages/ExperimentBuilder/components/Canvas/services/canvasLayoutBounds";
import { getCanvasLayoutSignature } from "../../../pages/ExperimentBuilder/components/Canvas/services/getCanvasLayoutSignature";
import { diamond, nestedScene, render, trial } from "./symmetryFixtures";
import { sampleCurves } from "./curveTestUtils";

it("includes exterior routes, nested circuits and protruding controls in the viewport", () => {
  const result = buildUnifiedFlowLayout(nestedScene(5));
  const box = getCanvasLayoutBounds(result.nodes, result.edges)!;
  for (const node of result.nodes) {
    expect(box.x).toBeLessThanOrEqual(node.position.x - 12);
    expect(box.y).toBeLessThanOrEqual(node.position.y - 12);
    expect(box.x + box.width).toBeGreaterThanOrEqual(
      node.position.x + node.measured.width + 12,
    );
    expect(box.y + box.height).toBeGreaterThanOrEqual(node.position.y + 90);
  }
  for (const edge of result.edges) {
    for (const p of sampleCurves(edge.data.curve ?? [])) {
      expect(p.x).toBeGreaterThanOrEqual(box.x - 1e-6);
      expect(p.x).toBeLessThanOrEqual(box.x + box.width + 1e-6);
      expect(p.y).toBeGreaterThanOrEqual(box.y - 1e-6);
      expect(p.y).toBeLessThanOrEqual(box.y + box.height + 1e-6);
    }
    if (edge.data.routeX !== undefined) {
      expect(box.x + box.width).toBeGreaterThanOrEqual(edge.data.routeX);
      expect(box.y).toBeLessThanOrEqual(edge.data.routeTopY!);
      expect(box.y + box.height).toBeGreaterThanOrEqual(
        edge.data.routeBottomY!,
      );
    }
  }
});

it("invalidates the viewport when a route changes with the same node positions", () => {
  const items = diamond();
  items[3] = trial("D", ["A"]);
  const result = render(items);
  const original = getCanvasLayoutSignature(result.nodes, result.edges);
  const edge = result.edges.find((value) => value.data.curve?.length)!;
  edge.data.curve![0].control1.x += 200;
  expect(getCanvasLayoutSignature(result.nodes, result.edges)).not.toBe(
    original,
  );
});

it("keeps the drawn return curves outside every other node", () => {
  const result = render([
    trial("A", ["B", "C"]),
    trial("B", ["D"]),
    trial("C", ["D"]),
    trial("D", ["A"]),
  ]);
  for (const edge of result.edges) {
    for (const point of sampleCurves(edge.data.curve ?? [])) {
      for (const node of result.nodes.filter(
        (value) => value.id !== edge.source && value.id !== edge.target,
      )) {
        const { x, y } = node.position;
        const crosses =
          point.x > x &&
          point.x < x + node.measured.width &&
          point.y > y &&
          point.y < y + node.measured.height;
        expect(crosses).toBe(false);
      }
    }
  }
});
