import { test } from "node:test";
import assert from "node:assert/strict";
import {
  deriveConnections,
  convertWorkspace,
  normalizeNavigation,
} from "./dist/navigation.js";

const make = () => ({
  experimentID: "fixture",
  entryItemId: 1,
  timeline: [
    { id: 1, type: "trial" },
    { id: 2, type: "trial" },
    { id: 3, type: "trial" },
  ],
  loops: [],
  trials: [
    {
      id: 1,
      name: "A",
      parentLoopId: null,
      defaultNextTrialId: 2,
      branches: [2, 3],
      branchConditions: [],
      parameters: { components: [{ name: "kept" }] },
    },
    {
      id: 2,
      name: "B",
      parentLoopId: null,
      defaultNextTrialId: null,
      branches: [],
      branchConditions: [],
    },
    {
      id: 3,
      name: "C",
      parentLoopId: null,
      defaultNextTrialId: null,
      branches: [],
      branchConditions: [],
    },
  ],
});

test("conversion preserves missing references as routing-only Then records without changing the original", () => {
  const before = make(),
    saved = structuredClone(before),
    next = convertWorkspace(before);
  assert.deepEqual(before, saved);
  assert.equal(next.workspaceSchemaVersion, 2);
  assert.deepEqual(next.trials[0].branches, [2, 3]);
  assert.deepEqual(
    next.trials[0].branchConditions.map((c) => ({
      kind: c.kind,
      target: c.nextTrialId,
      rules: c.rules,
    })),
    [{ kind: "route", target: 3, rules: [] }],
  );
  assert.deepEqual(next.trials[0].parameters, saved.trials[0].parameters);
  assert.deepEqual(convertWorkspace(next), next);
});
test("removing a Then removes its stale branch instead of unioning the previous branches", () => {
  const s = convertWorkspace(make()),
    t = s.trials[0];
  t.branchConditions = [];
  normalizeNavigation(t);
  assert.deepEqual(t.branches, [2]);
  assert.deepEqual(
    deriveConnections(s).map((e) => [e.sourceId, e.targetId]),
    [[1, 2]],
  );
});
test("a default and repeated conditions retain all references behind one edge", () => {
  const s = make();
  s.trials[0].branches = [2];
  s.trials[0].branchConditions = [
    { id: 4, nextTrialId: 2, rules: [], customParameters: { kept: true } },
    { id: 5, nextTrialId: 2, rules: [] },
  ];
  const next = convertWorkspace(s),
    edge = deriveConnections(next)[0];
  assert.equal(deriveConnections(next).length, 1);
  assert.equal(edge.refs.length, 3);
  assert.deepEqual(next.trials[0].branchConditions[0].customParameters, {
    kept: true,
  });
  assert.equal(next.trials[0].branchConditions[0].kind, "condition");
});
test("conversion preserves a terminal default while a new navigation edit opts into automatic defaults", () => {
  for (const terminal of [null, "FINISH_EXPERIMENT"]) {
    const s = make();
    s.trials[0].defaultNextTrialId = terminal;
    const t = convertWorkspace(s).trials[0];
    assert.equal(t.defaultNextTrialId, terminal);
    assert.equal(t.defaultPolicy, "preserve-terminal");
    normalizeNavigation(t);
    assert.equal(t.defaultNextTrialId, terminal);
    normalizeNavigation(t, { edited: true });
    assert.equal(t.defaultPolicy, "automatic");
    assert.equal(t.defaultNextTrialId, 2);
  }
});
test("automatic fallback promotion respects saved destination order and keeps conditions", () => {
  const t = {
    id: 1,
    defaultNextTrialId: null,
    defaultPolicy: "automatic",
    destinationOrder: [3, 2],
    branches: [99],
    branchConditions: [
      { id: 1, kind: "condition", nextTrialId: 2, rules: [] },
      { id: 2, kind: "route", nextTrialId: 3, rules: [] },
    ],
  };
  normalizeNavigation(t);
  assert.equal(t.defaultNextTrialId, 3);
  assert.deepEqual(t.branches, [3, 2]);
  assert.equal(t.branchConditions.length, 2);
});
test("conversion rejects targets that are loops or missing rather than dropping connections", () => {
  const s = make();
  s.trials[0].branches.push(999);
  assert.throws(() => convertWorkspace(s), /destination/i);
  const loop = make();
  loop.loops = [
    {
      id: "loop",
      trials: [],
      parentLoopId: null,
      entryItemId: null,
      nextItemId: null,
    },
  ];
  loop.trials[0].branches.push("loop");
  assert.throws(() => convertWorkspace(loop), /destination/i);
});
