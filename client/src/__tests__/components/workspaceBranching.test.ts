import { expect, it, vi } from "vitest";
import {
  saveBranchingIntent,
  addBranchingRule,
} from "../../pages/ExperimentBuilder/modules/experiment-authoring/intents/branching";
import type { Trial } from "../../pages/ExperimentBuilder/components/ConfigurationPanel/types";
it("the actual panel intent does not retain a removed destination in branches", async () => {
  const updateTrial = vi.fn();
  const trial = {
    id: 1,
    name: "A",
    type: "Trial",
    parameters: {},
    trialCode: "",
    defaultNextTrialId: 2,
    branches: [2, 3],
    branchConditions: [{ id: 1, kind: "route", rules: [], nextTrialId: 3 }],
  } satisfies Trial;
  await saveBranchingIntent({
    item: trial,
    conditions: [],
    isBranchTarget: () => true,
    dependencies: { updateTrial, updateLoop: vi.fn() },
  });
  expect(updateTrial.mock.calls[0][1].branches).toEqual([2]);
});
it("adding a component rule activates the routing-only Then as a real condition", () => {
  const result = addBranchingRule(
    [{ id: 1, kind: "route", rules: [], nextTrialId: 3 }],
    1,
  );
  expect(result[0].kind).toBe("condition");
});
