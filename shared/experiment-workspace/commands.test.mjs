import { test } from "node:test";
import assert from "node:assert/strict";
import { applyWorkspaceCommand, copyWorkspaceItems } from "./dist/commands.js";

const fixture = () => ({
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
      branches: [2],
      branchConditions: [],
      parameters: { components: [{ name: "Button", props: { text: "keep" } }] },
      customOnFinish: "user-code",
    },
    {
      id: 2,
      name: "B",
      parentLoopId: null,
      defaultNextTrialId: null,
      branches: [],
      branchConditions: [],
      paramsOverride: [
        {
          id: 1,
          rules: [{ trialId: 1, column: "response", op: "==", value: "yes" }],
          paramsToOverride: { kept: true },
        },
      ],
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
const cmd = (doc, kind, args = {}) =>
  applyWorkspaceCommand(doc, { kind, args }).document;

test("connect and disconnect use Default/Then and preserve complete payloads", () => {
  const before = fixture();
  let s = cmd(before, "connect", { sourceId: 1, targetId: 3 });
  assert.equal(s.trials[0].defaultNextTrialId, 2);
  assert.equal(s.trials[0].branchConditions[0].kind, "route");
  s = cmd(s, "removeConnection", { sourceId: 1, targetId: 3 });
  assert.deepEqual(s.trials[0].branches, [2]);
  assert.deepEqual(s.trials[0].parameters, before.trials[0].parameters);
  assert.equal(s.trials[0].customOnFinish, "user-code");
  assert.deepEqual(before, fixture());
});
test("removing an entry with only a conditional continuation chooses a surviving start", () => {
  const s = fixture();
  s.trials[0].defaultNextTrialId = null;
  s.trials[0].branchConditions = [{ id: 8, nextTrialId: 2, rules: [] }];
  const next = cmd(s, "deleteItems", { ids: [1] });
  assert.equal(next.entryItemId, 2);
  assert.deepEqual(
    next.trials.find((t) => t.id === 2).paramsOverride,
    s.trials[1].paramsOverride,
  );
});
test("grouping uses one repetition and deleting the last member prunes its empty loop", () => {
  let s = cmd(fixture(), "groupLoop", { ids: [1, 2], name: "Outer" });
  assert.equal(s.loops.length, 1);
  assert.equal(s.loops[0].repetitions, 1);
  assert.equal(s.entryItemId, s.loops[0].id);
  s = cmd(s, "deleteItems", { ids: [1, 2] });
  assert.equal(s.loops.length, 0);
  assert.equal(s.entryItemId, 3);
});
test("new trials are detached, preserve full configuration, and have real numeric IDs", () => {
  const result = applyWorkspaceCommand(fixture(), {
    kind: "addTrial",
    args: {
      trial: { name: "Detached", plugin: "custom", parameters: { x: 7 } },
      position: { x: 900, y: 80 },
    },
  });
  const added = result.document.trials.find(
    (t) => !fixture().trials.some((old) => old.id === t.id),
  );
  assert.equal(typeof added.id, "number");
  assert.equal(added.plugin, "custom");
  assert.equal(added.parameters.x, 7);
  assert.ok(result.document.editorLayout.positionsByItemId[String(added.id)]);
  assert.equal(result.document.entryItemId, 1);
});
test("source reconnection transfers rules and does not rewrite unrelated trial configuration", () => {
  const s = fixture();
  s.trials[0].branchConditions = [
    {
      id: 9,
      nextTrialId: 2,
      rules: [{ column: "response", op: "==", value: "yes" }],
      customParameters: { a: { source: "typed", value: 5 } },
    },
  ];
  const next = cmd(s, "reconnectSource", {
    sourceId: 1,
    targetId: 2,
    newSourceId: 3,
  });
  assert.deepEqual(next.trials.find((t) => t.id === 1).branches, []);
  const parent = next.trials.find((t) => t.id === 3);
  assert.equal(parent.defaultNextTrialId, 2);
  assert.deepEqual(
    parent.branchConditions[0].customParameters,
    s.trials[0].branchConditions[0].customParameters,
  );
});
test("trial and loop names remain unique across a single atomic operation", () => {
  let s = cmd(fixture(), "addTrial", { trial: { name: "A" } });
  assert.equal(s.trials.at(-1).name, "A 1");
  s = cmd(s, "addTrial", { trial: { name: "A" } });
  assert.equal(s.trials.at(-1).name, "A 2");
});

test("layout hints persist presentation only and reject non-finite or foreign item positions", () => {
  const s = fixture();
  const next = applyWorkspaceCommand(s, {
    kind: "removeConnection",
    args: {
      sourceId: 1,
      targetId: 2,
      layoutBefore: { 1: { x: 20, y: 30 }, 2: { x: 20, y: 180 } },
    },
  }).document;
  assert.deepEqual(next.editorLayout.positionsByItemId["2"], { x: 20, y: 180 });
  assert.throws(
    () =>
      applyWorkspaceCommand(s, {
        kind: "moveGroup",
        args: { itemId: 3, layoutBefore: { 999: { x: 1, y: 2 } } },
      }),
    /position/i,
  );
  assert.throws(
    () =>
      applyWorkspaceCommand(s, {
        kind: "removeConnection",
        args: {
          sourceId: 1,
          targetId: 2,
          layoutBefore: { 1: { x: NaN, y: 2 } },
        },
      }),
    /position/i,
  );
});

test("copy remaps internal data references, preserves external data and materializes inherited CSV", () => {
  const s = fixture();
  s.loops = [
    {
      id: "L",
      name: "Loop",
      parentLoopId: null,
      entryItemId: 1,
      nextItemId: null,
      trials: [1, 2],
      repetitions: 2,
      csvJson: [{ word: "hello" }],
      csvColumns: ["word"],
      orders: true,
      stimuliOrders: [[0]],
      categories: true,
      categoryData: [{ name: "one" }],
    },
  ];
  s.timeline = [
    { id: "L", type: "loop" },
    { id: 3, type: "trial" },
  ];
  s.entryItemId = "L";
  s.trials[0].parentLoopId = "L";
  s.trials[1].parentLoopId = "L";
  s.trials[1].csvFromLoop = true;
  s.trials[1].paramsOverride[0].rules.push({
    trialId: 3,
    column: "response",
    op: "==",
    value: "yes",
  });
  const fragment = copyWorkspaceItems(s, [1, 2]);
  const response = applyWorkspaceCommand(s, {
      kind: "pasteItems",
      args: { fragment },
    }),
    map = response.result.idMap;
  const copied = response.document.trials.find(
    (t) => t.id === response.idMap[map["2"]],
  );
  assert.equal(
    copied.paramsOverride[0].rules[0].trialId,
    response.idMap[map["1"]],
  );
  assert.equal(copied.paramsOverride[0].rules[1].trialId, 3);
  assert.equal(copied.csvFromLoop, false);
  assert.deepEqual(copied.csvJson, [{ word: "hello" }]);
  assert.equal(copied.orders, true);
  assert.equal(copied.customOnFinish, s.trials[1].customOnFinish);
});

test("panel updates reject missing and loop destinations instead of silently discarding them", () => {
  const s = fixture();
  assert.throws(
    () =>
      cmd(s, "updateTrial", {
        trialId: 1,
        updates: { defaultNextTrialId: 999 },
      }),
    /destination/i,
  );
  assert.throws(
    () =>
      cmd(s, "updateTrial", {
        trialId: 1,
        updates: { branchConditions: [{ id: 1, nextTrialId: 999, rules: [] }] },
      }),
    /destination/i,
  );
});

test("conversion and unrelated edits preserve a valid historical entry with an incoming disconnected route", () => {
  const old = fixture();
  old.trials[2].branches = [1];
  let converted = cmd(old, "convertWorkspace");
  assert.equal(converted.entryItemId, 1);
  assert.equal(converted.trials[2].defaultNextTrialId, null);
  converted = cmd(converted, "updateTrial", {
    trialId: 3,
    updates: { name: "Renamed" },
  });
  assert.equal(converted.entryItemId, 1);
  converted = cmd(converted, "addTrial", { trial: { name: "Other" } });
  assert.equal(converted.entryItemId, 1);
});

test("an aggregated edge descriptor cannot delete or reconnect any represented pair", () => {
  const s = cmd(fixture(), "connect", { sourceId: 1, targetId: 3 }),
    edgeRefs = [JSON.stringify(["1", "2"]), JSON.stringify(["1", "3"])];
  assert.throws(
    () => cmd(s, "removeConnection", { sourceId: 1, targetId: 2, edgeRefs }),
    /aggregated/i,
  );
  assert.throws(
    () =>
      cmd(s, "reconnectTarget", {
        sourceId: 1,
        oldTargetId: 2,
        targetId: 3,
        edgeRefs,
      }),
    /aggregated/i,
  );
  assert.deepEqual(s.trials[0].branches, [2, 3]);
});

test("structure insertion requires the canonical visual endpoints and rejects an unrelated exit", () => {
  const s = fixture();
  s.trials.push({
    id: 4,
    name: "Fourth",
    parentLoopId: null,
    defaultNextTrialId: null,
    branches: [],
    branchConditions: [],
  });
  const args = { itemId: 3, sourceId: 1, targetId: 2, mode: "sequential" };
  assert.throws(() => cmd(s, "insertStructure", args), /canonical.*endpoints/i);
  assert.throws(
    () =>
      cmd(s, "insertStructure", {
        ...args,
        endpoints: { entryId: 3, exitId: 4 },
      }),
    /endpoints/i,
  );
  const result = cmd(s, "insertStructure", {
    ...args,
    endpoints: { entryId: 3, exitId: 3 },
  });
  assert.equal(result.trials[0].defaultNextTrialId, 3);
  assert.equal(result.trials.find((t) => t.id === 3).defaultNextTrialId, 2);
});

test("a connection plan with a previous pair reconnects one endpoint instead of adding an extra edge", () => {
  const s = fixture(),
    next = cmd(s, "connect", {
      sourceId: 3,
      targetId: 2,
      previous: { source: 1, target: 2 },
    });
  assert.deepEqual(next.trials.find((t) => t.id === 1).branches, []);
  assert.equal(next.trials.find((t) => t.id === 3).defaultNextTrialId, 2);
  assert.throws(
    () =>
      cmd(s, "connect", {
        sourceId: 3,
        targetId: 1,
        previous: { source: 1, target: 2 },
      }),
    /one endpoint/,
  );
});
