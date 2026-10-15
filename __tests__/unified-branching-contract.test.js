import { createLoopBranch } from "../server/routes/timeline/loopBranching/createLoopBranch.js";
import { assertTrialBranching } from "../server/routes/timeline/branchContract.js";
import { buildExperimentGraph } from "../server/routes/timeline/graph/buildExperimentGraph.js";
import { moveItemToScope } from "../server/routes/timeline/graph/ownership.js";
import {
  groupItemsInLoop,
  ungroupLoop,
  updateLoop,
} from "../server/routes/timeline/loops/mutations.js";

const trial = (id, branches = [], defaultNextTrialId = null) => ({
  id,
  name: String(id),
  parentLoopId: null,
  branches,
  branchConditions: [],
  defaultNextTrialId,
});
const document = () => ({
  entryItemId: 1,
  trials: [trial(1, [2], 2), trial(2, [1], 1)],
  loops: [],
  timeline: [
    { id: 2, type: "trial" },
    { id: 1, type: "trial" },
  ],
});

test("cycles keep an explicit entry independently of storage order", () => {
  const graph = buildExperimentGraph(document());
  expect(graph.diagnostics).toEqual([]);
  expect(graph.root.entryItemId).toBe(1);
  expect(graph.edges).toHaveLength(2);
});

test("the default and conditions must reference configured edges", () => {
  const doc = document();
  expect(() =>
    assertTrialBranching(doc, { ...trial(1), defaultNextTrialId: 2 }),
  ).toThrow();
  expect(() =>
    assertTrialBranching(doc, {
      ...trial(1),
      branchConditions: [{ id: 1, rules: [], nextTrialId: 2 }],
    }),
  ).toThrow();
  expect(() => assertTrialBranching(doc, trial(1, [2], 2))).not.toThrow();
});

test("a missing explicit default is invalid", () => {
  const doc = document();
  const invalid = { ...doc.trials[0] };
  delete invalid.defaultNextTrialId;
  expect(() => assertTrialBranching(doc, invalid)).toThrow();
});

test("renaming and moving within the same scope preserve its explicit entry", () => {
  const doc = document();
  moveItemToScope(doc, 1, null, 1);
  expect(doc.entryItemId).toBe(1);
});

test("grouping and ungrouping preserve the entry and loop continuation", () => {
  const doc = {
    entryItemId: 1,
    trials: [trial(1, [2], 2), trial(2, [3], 3), trial(3)],
    loops: [],
    timeline: [1, 2, 3].map((id) => ({ id, type: "trial" })),
  };
  const loop = {
    id: "rows",
    parentLoopId: null,
    trials: [1, 2],
    entryItemId: 1,
    nextItemId: null,
  };
  groupItemsInLoop(doc, loop);
  expect(doc.entryItemId).toBe("rows");
  expect(loop.entryItemId).toBe(1);
  expect(loop.nextItemId).toBe(3);
  ungroupLoop(doc, loop);
  expect(doc.entryItemId).toBe(1);
  expect(doc.trials[1].defaultNextTrialId).toBe(3);
});

test("a loop continuation must be a live item in its parent scope before mutation", () => {
  const doc = document();
  const loop = {
    id: "rows",
    parentLoopId: null,
    trials: [],
    entryItemId: null,
    nextItemId: null,
  };
  groupItemsInLoop(doc, loop);
  const before = structuredClone(doc);
  expect(() => updateLoop(doc, loop, { nextItemId: "missing" })).toThrow();
  expect(doc).toEqual(before);
});

test("sequential insertion into an ancestor keeps explicit connections consistent", () => {
  const source = {
    ...trial(1, [2, 3], 2),
    parentLoopId: "rows",
    branchConditions: [{ id: 7, rules: [], nextTrialId: 3 }],
  };
  const doc = {
    entryItemId: "rows",
    trials: [source, { ...trial(2), parentLoopId: "rows" }, trial(3)],
    loops: [
      {
        id: "rows",
        parentLoopId: null,
        trials: [1, 2],
        entryItemId: 1,
        nextItemId: null,
      },
    ],
    timeline: [
      { id: "rows", type: "loop" },
      { id: 3, type: "trial" },
    ],
  };
  const result = createLoopBranch(doc, source, null, "sequential");
  expect(result.trial.defaultNextTrialId).toBe(3);
  expect(source.branchConditions[0].nextTrialId).toBe(result.trial.id);
  expect(buildExperimentGraph(doc).diagnostics).toEqual([]);
});

test('compilation diagnoses an invalid structural loop continuation', () => {
  const doc = document();
  doc.loops = [{ id: 'rows', trials: [], entryItemId: null, nextItemId: 'missing' }];
  doc.timeline.push({ id: 'rows', type: 'loop' });
  expect(buildExperimentGraph(doc).diagnostics).toContainEqual(expect.objectContaining({ code: 'BRANCH_INVALID', itemId: 'rows' }));
});

test('grouping nested loops keeps structural continuations inside each parent', () => {
  const doc = { entryItemId: 1, trials: [trial(1, [2], 2), trial(2, [3], 3), trial(3)], loops: [],
    timeline: [1, 2, 3].map(id => ({ id, type: 'trial' })) };
  const inner = { id: 'inner', parentLoopId: null, trials: [1, 2], entryItemId: 1, nextItemId: null };
  groupItemsInLoop(doc, inner);
  const outer = { id: 'outer', parentLoopId: null, trials: ['inner'], entryItemId: 'inner', nextItemId: null };
  groupItemsInLoop(doc, outer);
  expect(inner.nextItemId).toBeNull();
  expect(outer.nextItemId).toBe(3);
  expect(buildExperimentGraph(doc).diagnostics).toEqual([]);
});
