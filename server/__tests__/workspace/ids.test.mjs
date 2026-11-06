import { test } from "node:test";
import assert from "node:assert/strict";
import { executeWorkspaceCommand } from "../../routes/workspace/executeCommand.js";
const t = (id, next = null) => ({
  id,
  name: String(id),
  parentLoopId: null,
  defaultNextTrialId: next,
  branches: next ? [next] : [],
  branchConditions: [],
});
test("real allocators never recycle removed trial or loop IDs within a fixed clock tick", () => {
  const data = {
    trials: [
      {
        experimentID: "test",
        updatedAt: "seed",
        entryItemId: "A",
        trials: [t("A", "B"), t("B")],
        loops: [],
        timeline: ["A", "B"].map((id) => ({ id, type: "trial" })),
      },
    ],
    mutationReceipts: [],
  };
  let key = 0,
    revision = "seed";
  const run = (kind, args = {}) => {
    const r = executeWorkspaceCommand(
      data,
      "test",
      { kind, args, expectedRevision: revision },
      String(key++),
    );
    revision = r.revision;
    return r;
  };
  const now = Date.now;
  Date.now = () => 100;
  try {
    run("convertWorkspace");
    const first = run("addTrial").result;
    run("deleteItems", { ids: [first] });
    const second = run("addTrial").result;
    assert.equal(typeof second, "number");
    assert.ok(second > first);
    const loop = run("groupLoop", { ids: ["A", "B"] }).result;
    run("deleteLoop", { loopId: loop });
    const next = run("groupLoop", { ids: ["A", "B"] }).result;
    assert.notEqual(next, loop);
  } finally {
    Date.now = now;
  }
});
test("a second conversion validates and preserves the converted document and its revision", () => {
  const data = {
    trials: [
      {
        experimentID: "test",
        updatedAt: "seed",
        entryItemId: 1,
        trials: [t(1)],
        loops: [],
        timeline: [{ id: 1, type: "trial" }],
      },
    ],
    mutationReceipts: [],
  };
  const first = executeWorkspaceCommand(
    data,
    "test",
    { kind: "convertWorkspace", args: {}, expectedRevision: "seed" },
    "first",
  );
  const second = executeWorkspaceCommand(
    data,
    "test",
    { kind: "convertWorkspace", args: {}, expectedRevision: first.revision },
    "second",
  );
  assert.deepEqual(second.document, first.document);
  assert.equal(second.revision, first.revision);
});
