import { describe, expect, it, vi } from "vitest";
import {
  loop,
  trial,
  timelineLoop,
  timelineTrial,
} from "../../../../../__tests__/helpers/trialFactories";
import {
  isBranchTargetFromUserContext,
  saveBranchingIntent,
} from "./branching";

describe("trial-only branch intents", () => {
  it("excludes loop targets even when old source metadata references them", () => {
    const selectedItem = trial({ branches: ["loop-1"] });
    expect(
      isBranchTargetFromUserContext({
        selectedItem,
        targetId: "loop-1",
        scopeTimeline: [
          timelineTrial({ id: selectedItem.id }),
          timelineLoop({ id: "loop-1" }),
        ],
      }),
    ).toBe(false);
  });

  it("rejects branch decisions from loops before invoking either writer", async () => {
    const dependencies = { updateTrial: vi.fn(), updateLoop: vi.fn() };
    await expect(
      saveBranchingIntent({
        item: loop(),
        conditions: [
          { id: 1, rules: [], nextTrialId: 2, customParameters: {} },
        ],
        isBranchTarget: () => true,
        dependencies,
      }),
    ).rejects.toThrow("Branch sources must be trials");
    expect(dependencies.updateLoop).not.toHaveBeenCalled();
    expect(dependencies.updateTrial).not.toHaveBeenCalled();
  });
});
