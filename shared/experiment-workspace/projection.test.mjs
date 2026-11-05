import { test } from "node:test";
import assert from "node:assert/strict";
import { projectExecutable } from "./projection.js";
const t = (id, next = null, parent = null) => ({
  id,
  name: "T" + id,
  parentLoopId: parent,
  defaultNextTrialId: next,
  branches: next ? [next] : [],
  branchConditions: [],
});
const doc = (trials, loops = [], entry = 1) => ({
  workspaceSchemaVersion: 2,
  entryItemId: entry,
  trials,
  loops,
  timeline: [
    ...trials
      .filter((t) => !t.parentLoopId)
      .map((t) => ({ id: t.id, type: "trial" })),
    ...loops
      .filter((l) => !l.parentLoopId)
      .map((l) => ({ id: l.id, type: "loop" })),
  ],
});
const loop = (extra = {}) => ({
  id: "L",
  parentLoopId: null,
  entryItemId: 1,
  nextItemId: 3,
  trials: [1, 2],
  repetitions: 1,
  ...extra,
});
test("exports directed reachability and never an incoming disconnected structure", () => {
  const s = doc([t(1, 2), t(2), t(3, 2)]),
    p = projectExecutable(s);
  assert.deepEqual(
    p.trials.map((t) => t.id),
    [1, 2],
  );
  assert.equal(s.trials.length, 3);
});
test("conditional early exit with one repetition does not include an unvisited loop entry", () => {
  const s = doc(
    [
      t(1, null, "L"),
      {
        ...t(2, "FINISH_EXPERIMENT", "L"),
        branchConditions: [{ id: 1, nextTrialId: 4, rules: [] }],
      },
      t(3),
      t(4),
    ],
    [loop()],
    2,
  );
  assert.deepEqual(
    projectExecutable(s).trials.map((t) => t.id),
    [2, 4],
  );
});
test("loop completion follows continuation and repeating rows can reach its normal entry", () => {
  for (const config of [
    { repetitions: 2 },
    { csvJson: [{}, {}] },
    { isConditionalLoop: true },
  ]) {
    const s = doc(
      [t(1, null, "L"), t(2, null, "L"), t(3), t(4)],
      [loop(config)],
      2,
    );
    assert.deepEqual(
      projectExecutable(s).trials.map((t) => t.id),
      [1, 2, 3],
    );
  }
});
test("hard finish never makes the loop continuation reachable", () => {
  assert.deepEqual(
    projectExecutable(
      doc(
        [t(1, "FINISH_EXPERIMENT", "L"), t(2, null, "L"), t(3)],
        [loop({ repetitions: 5 })],
        "L",
      ),
    ).trials.map((t) => t.id),
    [1],
  );
});
test("ordinary external Default overrides continuation through nested loops", () => {
  const s = doc(
    [t(1, 4, "I"), t(2, null, "L"), t(3), t(4)],
    [
      loop({ entryItemId: "I", trials: ["I", 2] }),
      {
        ...loop({ id: "I", parentLoopId: "L", nextItemId: 2, trials: [1] }),
        entryItemId: 1,
      },
    ],
    "L",
  );
  assert.deepEqual(
    projectExecutable(s).trials.map((t) => t.id),
    [1, 4],
  );
});
