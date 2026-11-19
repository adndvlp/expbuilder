import { test } from "node:test";
import assert from "node:assert/strict";
import { executionRevision } from "./dist/executionRevision.js";
const t = (id, next = null) => ({
  id,
  defaultNextTrialId: next,
  branchConditions: [],
  parameters: { stimulus: "Hello" },
  parentLoopId: null,
});
const fixture = () => ({
  workspaceSchemaVersion: 2,
  entryItemId: 1,
  timeline: [
    { id: 1, type: "trial" },
    { id: 2, type: "trial" },
    { id: 3, type: "trial" },
  ],
  trials: [t(1, 2), t(2), t(3)],
  loops: [],
});
test("layout, authoring revision and detached edits preserve executable revision", async () => {
  const s = fixture(),
    first = await executionRevision(s);
  s.authoringRevision = "20";
  s.editorLayout = { positionsByItemId: { 3: { x: 200, y: 100 } } };
  s.trials[2].parameters.stimulus = "other";
  assert.equal(await executionRevision(s), first);
  s.trials[1].parameters.stimulus = "changed";
  assert.notEqual(await executionRevision(s), first);
});
test("execution resources and runtime contract version participate in revision", async () => {
  const s = fixture(),
    a = await executionRevision(s, [{ url: "a" }]);
  assert.notEqual(await executionRevision(s, [{ url: "b" }]), a);
  assert.notEqual(await executionRevision(s, [{ url: "a" }], "other"), a);
});

test("regenerable code caches do not affect execution identity, while opaque stored code does", async () => {
  const s = fixture();
  s.trials[0].plugin = "plugin-dynamic";
  s.trials[0].trialCode = "old cache";
  const first = await executionRevision(s);
  s.trials[0].trialCode = "new cache";
  assert.equal(await executionRevision(s), first);
  s.trials[0].plugin = "webgazer";
  delete s.trials[0].parameters.include_instructions;
  const opaque = await executionRevision(s);
  s.trials[0].trialCode = "changed stored source";
  assert.notEqual(await executionRevision(s), opaque);
  s.trials[0].trialCodeSource = "generated";
  const generated = await executionRevision(s);
  s.trials[0].trialCode = "another generated cache";
  assert.equal(await executionRevision(s), generated);
});
