import { describe, expect, it } from "vitest";
import { buildUnifiedFlowLayout } from "../../../pages/ExperimentBuilder/components/Canvas/services/buildUnifiedFlowLayout";
import { getCanonicalBranchEdgeId } from "../../../pages/ExperimentBuilder/components/Canvas/services/canonicalBranchProjection";
import {
  center,
  diamond,
  loop,
  node,
  render,
  scene,
  trial,
} from "./symmetryFixtures";

function loopChain(shortcut = true) {
  return scene(
    [loop("L1", "F"), trial("F", ["E2"]), loop("L2", "T"), trial("T")],
    [
      {
        loop: { id: "L1", name: "Loop 1", parentLoopId: null },
        items: [trial("E1", shortcut ? ["F", "E2"] : ["F"])],
      },
      {
        loop: { id: "L2", name: "Loop 2", parentLoopId: null },
        items: [trial("E2", ["T"])],
      },
    ],
    "L1",
  );
}

describe("aligned chains from the curved branching demo", () => {
  it("keeps every node fixed when connections skip steps in a chain", () => {
    const plain = [
      trial("A", ["B"]),
      trial("B", ["C"]),
      trial("C", ["D"]),
      trial("D", ["E"]),
      trial("E"),
    ];
    const extra = [
      trial("A", ["B", "C", "E"]),
      trial("B", ["C", "D", "E"]),
      ...plain.slice(2),
    ];
    const before = render(plain),
      after = render(extra);
    for (const id of ["A", "B", "C", "D", "E"]) {
      expect(center(after, id)).toBeCloseTo(center(after, "A"));
      expect(node(after, id).position).toEqual(node(before, id).position);
    }
    expect(
      after.edges.filter((edge) => edge.data.kind === "flow"),
    ).toHaveLength(8);
  });

  it.each([0, 1, 2, 3])(
    "keeps the photographed loop chain aligned with expansion mask %s",
    (mask) => {
      const input = loopChain();
      const expandedPath = input.expandedPath.filter(
        (_, index) => mask & (1 << index),
      );
      const result = buildUnifiedFlowLayout({ ...input, expandedPath });
      const plain = loopChain(false);
      const baseline = buildUnifiedFlowLayout({
        ...plain,
        expandedPath: plain.expandedPath.filter(
          (_, index) => mask & (1 << index),
        ),
      });
      const spine = [mask & 1 ? "E1" : "L1", "F", mask & 2 ? "E2" : "L2", "T"];
      for (const id of spine) {
        expect(center(result, id)).toBeCloseTo(center(result, spine[0]));
        expect(node(result, id).position).toEqual(node(baseline, id).position);
      }
      const ordered = spine.map((id) => node(result, id).position.y);
      expect(ordered).toEqual([...ordered].sort((a, b) => a - b));
    },
  );

  it("keeps independent alternatives balanced when adding an exterior connection", () => {
    const items = [
      trial("A", ["B"]),
      trial("B", ["C", "D", "E"]),
      trial("C", ["F"]),
      trial("D", ["F"]),
      trial("E", ["F"]),
      trial("F", ["G"]),
      trial("G"),
    ];
    const before = render(items);
    const input = scene([trial("A", ["B", "G"]), ...items.slice(1)]);
    const result = buildUnifiedFlowLayout(input);
    for (const item of items)
      expect(node(result, String(item.id)).position).toEqual(
        node(before, String(item.id)).position,
      );
    expect(center(result, "C")).toBeLessThan(center(result, "D"));
    expect(center(result, "E")).toBeGreaterThan(center(result, "D"));
    expect(center(result, "D")).toBeCloseTo(center(result, "B"));
    expect(
      new Set(result.edges.flatMap((edge) => edge.data.semanticEdgeIds ?? [])),
    ).toEqual(new Set(input.branchEdges.map(getCanonicalBranchEdgeId)));
  });

  it("does not mistake parallel conditions for an alternative path", () => {
    const input = scene(diamond());
    input.branchEdges.push({ ...input.branchEdges[0] });
    const result = buildUnifiedFlowLayout(input);
    expect(center(result, "B")).toBeLessThan(center(result, "A"));
    expect(center(result, "C")).toBeGreaterThan(center(result, "A"));
    expect(
      result.edges.filter((edge) => edge.data.kind === "flow"),
    ).toHaveLength(4);
  });

  it("emits one visual edge when a declared loop continuation also has a canonical connection", () => {
    const result = buildUnifiedFlowLayout(loopChain());
    expect(new Set(result.edges.map((edge) => edge.id)).size).toBe(
      result.edges.length,
    );
  });

  it("aligns the entry and continuation through nested returns and exterior arcs", () => {
    const input = scene(
      [trial("A", ["P"]), loop("L1", "T"), trial("T")],
      [
        {
          loop: { id: "L1", name: "L1", parentLoopId: null },
          items: [trial("P", ["Q"]), loop("L2", "R"), trial("R", ["T", "Q"])],
        },
        {
          loop: { id: "L2", name: "L2", parentLoopId: "L1" },
          items: [trial("Q", ["R", "T", "P"])],
        },
      ],
    );
    const result = buildUnifiedFlowLayout(input);
    for (const id of ["A", "P", "Q", "R", "T"])
      expect(center(result, id)).toBeCloseTo(center(result, "A"));
    expect(new Set(result.edges.map((edge) => edge.id)).size).toBe(
      result.edges.length,
    );
  });

  it("keeps chain positions deterministic for permuted records and return edges", () => {
    const input = scene([
      trial("A", ["B", "D"]),
      trial("B", ["C"]),
      trial("C", ["D", "A"]),
      trial("D", ["B"]),
    ]);
    const original = JSON.stringify(input);
    const result = buildUnifiedFlowLayout(input);
    const reordered = buildUnifiedFlowLayout({
      ...input,
      timeline: [...input.timeline].reverse(),
      branchEdges: [...input.branchEdges].reverse(),
    });
    for (const id of ["A", "B", "C", "D"]) {
      expect(center(result, id)).toBeCloseTo(center(result, "A"));
      expect(node(result, id).position).toEqual(node(reordered, id).position);
    }
    expect(JSON.stringify(input)).toBe(original);
  });
});
