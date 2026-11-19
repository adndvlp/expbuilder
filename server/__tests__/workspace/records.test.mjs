import { test } from "node:test";
import assert from "node:assert/strict";
import { workspaceRecords } from "../../routes/workspace/records.js";
test("reading a loop includes its nested full records once, at one snapshot", () => {
  const document = {
    loops: [
      { id: "outer", parentLoopId: null },
      { id: "inner", parentLoopId: "outer" },
    ],
    trials: [
      { id: 1, parentLoopId: "outer", parameters: { text: "one" } },
      { id: 2, parentLoopId: "inner", parameters: { text: "two" } },
      { id: 3, parentLoopId: null },
    ],
  };
  const records = workspaceRecords(document, new Set(["outer", "inner"]));
  assert.deepEqual(
    records.map((i) => i.id),
    [1, 2, "outer", "inner"],
  );
  records[1].parameters.text = "changed";
  assert.equal(document.trials[1].parameters.text, "two");
  assert.throws(() => workspaceRecords(document, new Set(["missing"])), {
    code: "REVISION_CONFLICT",
  });
});
