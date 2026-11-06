import { describe, it, expect } from "vitest";
import {
  layout,
  insertionEndpoints,
} from "../../pages/ExperimentBuilder/components/Canvas/workspace/layout";
import { workspaceModel } from "../../../../shared/experiment-workspace/dist/modelServices.js";

describe("workspace production layout", () => {
  it("moves a detached convergence without moving active nodes", () => {
    const M = workspaceModel(),
      s = M.makeState(
        "test",
        [
          M.trial("a", "A", null, "b"),
          M.trial("b", "B"),
          M.trial("c", "C", null, "b"),
        ],
        [],
        "a",
      );
    const first = layout(s);
    s.anchors.c = { x: 1300, y: 400 };
    const moved = layout(s);
    expect(moved.positions.a).toEqual(first.positions.a);
    expect(moved.positions.b).toEqual(first.positions.b);
    s.anchors.c.x += 40;
    expect(layout(s).positions.c.x - moved.positions.c.x).toBe(40);
    expect(
      moved.flowEdges.some((e) => e.source === "c" && e.target === "b"),
    ).toBe(true);
  });
  it("takes the last visual trial of a detached fork for insertion", () => {
    const M = workspaceModel(),
      s = M.makeState(
        "test",
        [
          M.trial("a", "A"),
          M.trial("x", "X", null, "y"),
          M.trial("y", "Y", null, "z"),
          M.trial("z", "Z"),
          M.trial("w", "W"),
        ],
        [],
        "a",
      );
    M.connect(s, "x", "w");
    expect(insertionEndpoints(s, "x")).toMatchObject({
      entryId: "x",
      exitId: "z",
    });
  });
});

it("updates a partial convergence curve during the drag, keeping the active endpoint fixed", async () => {
  const { translatedProjection } = await import(
    "../../pages/ExperimentBuilder/components/Canvas/workspace/projection.js"
  );
  const M = workspaceModel(),
    s = M.makeState(
      "test",
      [
        M.trial("a", "A", null, "b"),
        M.trial("b", "B"),
        M.trial("c", "C", null, "b"),
      ],
      [],
      "a",
    ),
    flow = layout(s);
  const before = flow.flowEdges.find(
      (e) => e.source === "c" && e.target === "b",
    )!,
    moved = translatedProjection(
      { nodes: flow.flowNodes, edges: flow.flowEdges },
      { ids: new Set(["c"]), dx: 150, dy: 100 },
    ),
    after = moved.edges.find((e) => e.id === before.id)!;
  expect(after.data.curve[0].start.x - before.data.curve[0].start.x).toBe(150);
  expect(after.data.curve[0].start.y - before.data.curve[0].start.y).toBe(100);
  expect(after.data.curve.at(-1).end).toEqual(before.data.curve.at(-1).end);
});
