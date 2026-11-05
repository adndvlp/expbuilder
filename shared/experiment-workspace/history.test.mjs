import { test } from "node:test";
import assert from "node:assert/strict";
import { createDelta, applyDelta } from "./history.js";

test("undo changes only edited fields and preserves configuration saved afterwards", () => {
  const a = {
    entryItemId: 1,
    trials: [{ id: 1, branches: [2], parameters: { text: "old" } }, { id: 2 }],
    loops: [],
    timeline: [{ id: 1 }, { id: 2 }],
  };
  const b = structuredClone(a);
  b.trials[0].branches = [];
  const patch = createDelta(a, b);
  const later = structuredClone(b);
  later.trials[0].parameters.text = "new";
  const restored = applyDelta(later, patch, "undo");
  assert.deepEqual(restored.trials[0].branches, [2]);
  assert.equal(restored.trials[0].parameters.text, "new");
  assert.deepEqual(applyDelta(restored, patch, "redo"), later);
});
test("deleted full records restore at their previous index and leave the source unchanged", () => {
  const a = {
      trials: [{ id: 1, parameters: { csv: [1, 2] } }, { id: 2 }],
      loops: [],
      timeline: [{ id: 1 }, { id: 2 }],
    },
    b = { trials: [{ id: 2 }], loops: [], timeline: [{ id: 2 }] };
  const patch = createDelta(a, b);
  assert.deepEqual(applyDelta(b, patch, "undo"), a);
  assert.deepEqual(b.trials, [{ id: 2 }]);
});
test("undo detects conflicting changes and never returns a partially applied document", () => {
  const a = { trials: [{ id: 1, name: "A" }], loops: [] },
    b = { trials: [{ id: 1, name: "B" }], loops: [] },
    c = { trials: [{ id: 1, name: "C" }], loops: [] };
  assert.throws(() => applyDelta(c, createDelta(a, b), "undo"), /conflict/i);
  assert.equal(c.trials[0].name, "C");
});
