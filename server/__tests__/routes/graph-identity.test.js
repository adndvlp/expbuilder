import { describe, expect, test } from "@jest/globals";
import { buildExperimentGraph } from "../../routes/timeline/graph/buildExperimentGraph.js";
import {
  getCrossedLoops,
  getLoopAncestry,
  idsMatch,
} from "../../routes/timeline/graph/identity.js";

const nestedDoc = () => ({
  timeline: [{ id: "outer", type: "loop", name: "Outer" }],
  trials: [{ id: 1, name: "Source", parentLoopId: "inner", branches: [] }],
  loops: [
    { id: "outer", name: "Outer", trials: ["middle"] },
    { id: "middle", name: "Middle", parentLoopId: "outer", trials: ["inner"] },
    { id: "inner", name: "Inner", parentLoopId: "middle", trials: [1] },
  ],
});

describe("canonical graph identity and ancestry", () => {
  test("[TD-01] [TG-01] returns one unique path and one owner entry per item", () => {
    const ancestry = getLoopAncestry(nestedDoc(), "inner").map(({ id }) => id);
    const graph = buildExperimentGraph(nestedDoc());
    const ownedIds = [
      ...graph.root.items,
      ...Object.values(graph.scopes).flatMap(({ items }) => items),
    ].map(({ id }) => String(id));

    expect(ancestry).toEqual(["inner", "middle", "outer"]);
    expect(new Set(ancestry).size).toBe(ancestry.length);
    expect(ownedIds).toEqual(expect.arrayContaining(["outer", "middle", "inner", "1"]));
    expect(new Set(ownedIds).size).toBe(ownedIds.length);
  });

  test("[TG-02] compiles the exact three-loop boundaries for FX-01", () => {
    const doc = nestedDoc();
    doc.trials.push(
      { id: 2, name: "Exit nested 2", parentLoopId: "middle", branches: [] },
      { id: 3, name: "Exit nested 1", parentLoopId: "outer", branches: [] },
      { id: 4, name: "Exit outer", branches: [] },
    );
    doc.loops.find(({ id }) => id === "middle").trials.push(2);
    doc.loops.find(({ id }) => id === "outer").trials.push(3);
    doc.timeline.push({ id: 4, type: "trial", name: "Exit outer" });
    doc.trials[0].branches = [2, 3, 4];

    const routes = buildExperimentGraph(doc).edges.map((edge) => ({
      targetId: edge.targetId,
      exitedLoopIds: edge.exitedLoopIds,
    }));
    expect(routes).toEqual([
      { targetId: 2, exitedLoopIds: ["inner"] },
      { targetId: 3, exitedLoopIds: ["inner", "middle"] },
      { targetId: 4, exitedLoopIds: ["inner", "middle", "outer"] },
    ]);
  });

  test("[TD-02] rejects missing parents and ownership cycles without fallback", () => {
    const missing = nestedDoc();
    missing.loops.find(({ id }) => id === "middle").parentLoopId = "missing";
    const cyclic = nestedDoc();
    cyclic.loops.find(({ id }) => id === "outer").parentLoopId = "inner";

    expect(() => getLoopAncestry(missing, "inner")).toThrow(
      "Loop missing not found",
    );
    expect(() => getLoopAncestry(cyclic, "inner")).toThrow(
      "Loop ownership contains a cycle",
    );
  });

  test("[TD-07] [TD-08] derives same-scope and ancestor exits inner-to-outer", () => {
    const doc = nestedDoc();

    expect(getCrossedLoops(doc, "inner", "inner")).toEqual([]);
    expect(getCrossedLoops(doc, "inner", "middle").map(({ id }) => id))
      .toEqual(["inner"]);
    expect(getCrossedLoops(doc, "inner", "outer").map(({ id }) => id))
      .toEqual(["inner", "middle"]);
    expect(getCrossedLoops(doc, "inner", null).map(({ id }) => id))
      .toEqual(["inner", "middle", "outer"]);
  });

  test("[TD-10] canonicalizes numeric and string identities", () => {
    const doc = nestedDoc();

    expect(idsMatch(1, "1")).toBe(true);
    expect(getLoopAncestry(doc, String("inner")).map(({ id }) => id))
      .toEqual(["inner", "middle", "outer"]);
  });

  test("[TD-09] diagnoses duplicate, self, and cyclic branches by type", () => {
    const doc = {
      timeline: [
        { id: 1, type: "trial", name: "One" },
        { id: 2, type: "trial", name: "Two" },
      ],
      loops: [],
      trials: [
        { id: 1, name: "One", branches: [1, 2, 2] },
        { id: 2, name: "Two", branches: [1] },
      ],
    };

    const graph = buildExperimentGraph(doc);
    expect(graph.diagnostics.map(({ code }) => code)).toEqual(
      expect.arrayContaining([
        "BRANCH_DUPLICATE",
        "BRANCH_SELF_REFERENCE",
        "BRANCH_CYCLE",
      ]),
    );
    expect(graph.edges).toEqual([]);
  });
});
