import { test } from "node:test";
import assert from "node:assert/strict";
import { workspaceModel } from "./dist/modelServices.js";

test("restore rejects an incomplete JSON header instead of claiming a complete model", () => {
  const model = workspaceModel();
  assert.throws(
    () =>
      model.restore(
        JSON.stringify({
          schema: "branching-workspace-model/2",
          trials: [],
          loops: [],
        }),
      ),
    /Not a saved workspace demo/,
  );
});
test("restore preserves the complete saved model and opaque plugin configuration", () => {
  const model = workspaceModel();
  const trial = model.trial("A", "A");
  trial.parameters = {
    components: [{ name: "Button", props: { text: "keep" } }],
  };
  const state = model.makeState("saved", [trial], [], "A");
  state.anchors.A = { x: 100, y: 200 };
  state.scopeOrder.root = ["A"];
  assert.deepEqual(model.restore(model.serialize(state)), state);
});
