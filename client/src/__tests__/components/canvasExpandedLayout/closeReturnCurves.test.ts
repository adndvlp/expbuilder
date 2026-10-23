import { describe, expect, it } from "vitest";
import { node, render, trial } from "./symmetryFixtures";
import { sampleCurves } from "./curveTestUtils";

const consent = () =>
  render([
    trial("A", ["B"]),
    trial("B", ["A", "Rejected", "Prequestion"]),
    trial("Rejected"),
    trial("Prequestion", ["Question"]),
    trial("Question", ["Instructions"]),
    trial("Instructions", ["Practice"]),
    trial("Practice", ["Instructions", "End"]),
    trial("End"),
  ]);
const selfInDiamond = () =>
  render([
    trial("A", ["Yes", "No", "Final"]),
    trial("Yes", ["Final"]),
    trial("No", ["Final", "No"]),
    trial("Final"),
  ]);
const route = (
  result: ReturnType<typeof render>,
  source: string,
  target: string,
) =>
  result.edges.find(
    (edge) =>
      edge.source === node(result, source).id &&
      edge.target === node(result, target).id,
  )!.data.curve!;

describe("returns next to other branches", () => {
  it.each([
    ["B", "A"],
    ["Practice", "Instructions"],
  ])(
    "keeps %s → %s curved without a rectangular fallback",
    (source, target) => {
      const result = consent();
      const curve = route(result, source, target);
      expect(curve).toHaveLength(2);
      const points = sampleCurves(curve);
      expect(Math.max(...points.map((p) => p.y))).toBeLessThan(
        node(result, source).position.y +
          node(result, source).measured.height +
          50,
      );
    },
  );

  it("keeps a self connection local to its node in a diamond with a bypass", () => {
    const result = selfInDiamond();
    const value = node(result, "No"),
      points = sampleCurves(route(result, "No", "No"));
    expect(Math.min(...points.map((p) => p.y))).toBeGreaterThan(
      value.position.y - 50,
    );
    expect(Math.max(...points.map((p) => p.y))).toBeLessThan(
      value.position.y + value.measured.height + 50,
    );
    expect(Math.max(...points.map((p) => p.x))).toBeLessThan(
      value.position.x + value.measured.width + 120,
    );
  });

  it("also routes a bypass when the self connection is on the same vertical chain", () => {
    const result = render([
      trial("A", ["B", "C"]),
      trial("B", ["C", "B"]),
      trial("C"),
    ]);
    expect(route(result, "B", "B")).toHaveLength(2);
    expect(route(result, "A", "C")).toHaveLength(2);
  });

  it("keeps the long bypass curved after adding a trial before the diamond", () => {
    const result = render([
      trial("A", ["New", "Final"]),
      trial("New", ["Yes", "No", "Final"]),
      trial("Yes", ["Final"]),
      trial("No", ["Final", "No"]),
      trial("Final"),
    ]);
    expect(route(result, "A", "Final")).toHaveLength(2);
  });

  it.each([0, 1, 2, 4, 8, 16])(
    "uses curved routes throughout a generated graph with %s preceding trials",
    (depth) => {
      const items = Array.from({ length: depth + 1 }, (_, index) =>
        trial(
          `P${index}`,
          index < depth
            ? [`P${index + 1}`, "Final"]
            : ["Left", "Right", "Final"],
        ),
      );
      const result = render(
        [
          ...items,
          trial("Left", ["Final"]),
          trial("Right", ["Final", "Right"]),
          trial("Final", ["P0"]),
        ],
        "P0",
      );
      for (const edge of result.edges) {
        if (edge.data.kind !== "flow") continue;
        expect(edge.data.curve!.length).toBeLessThanOrEqual(2);
        for (const point of sampleCurves(edge.data.curve!)) {
          for (const value of result.nodes) {
            expect(
              point.x > value.position.x + 1 &&
                point.x < value.position.x + value.measured.width - 1 &&
                point.y > value.position.y + 1 &&
                point.y < value.position.y + value.measured.height - 1,
              `${edge.id} crosses ${value.id}`,
            ).toBe(false);
          }
        }
      }
    },
  );

  it.each([consent, selfInDiamond])(
    "avoids node interiors throughout the photographed cases",
    (fixture) => {
      const result = fixture();
      for (const edge of result.edges) {
        if (edge.data.kind !== "flow") continue;
        for (const point of sampleCurves(edge.data.curve!)) {
          for (const value of result.nodes) {
            const inside =
              point.x > value.position.x + 1 &&
              point.x < value.position.x + value.measured.width - 1 &&
              point.y > value.position.y + 1 &&
              point.y < value.position.y + value.measured.height - 1;
            expect(inside, `${edge.id} crosses ${value.id}`).toBe(false);
          }
        }
      }
    },
  );
});
