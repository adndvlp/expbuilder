import { describe, expect, it } from "vitest";
import generateLoopCode from "../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/LoopsConfiguration/useLoopCode";
import {
  nativeTimelineRuntime,
  nativeTrial,
  scopeManifest,
} from "../../helpers/nativeTimelineRuntime";

const settings = {
  repetitions: 1,
  randomize: false,
  orders: false,
  stimuliOrders: [],
  categories: false,
  categoryData: [],
};
const loopCode = () =>
  generateLoopCode({
    ...settings,
    id: "outer",
    unifiedStimuli: [{ row: 1 }, { row: 2 }],
    trials: [
      {
        ...settings,
        isLoop: true,
        loopId: "inner",
        loopName: "Inner",
        unifiedStimuli: [{}],
        items: [nativeTrial("loop_trial", "Target")],
      },
    ],
  })();

describe("trial-only loop runtime", () => {
  it("generates only trial route state and no loop-owned branch decision or fallback", async () => {
    const code = loopCode();
    expect(code).not.toMatch(/ShouldBranchOnFinish|HasBranches/);
    expect(code).not.toContain("ExpBuilderBranching.decide");
    expect(code).not.toContain("branches[0]");
    const fixture = nativeTimelineRuntime(
      code,
      scopeManifest({
        root: ["outer"],
        outer: ["inner"],
        inner: ["loop_trial"],
      }),
    );
    expect((await fixture.run()).map((row) => row.builder_id)).toEqual([
      "loop_trial",
      "loop_trial",
    ]);
  });

  it.each(["outer", "inner", "loop_trial"])(
    "admits only real trial destinations through nested containers: %s",
    async (target) => {
      const entry = nativeTrial(0, "Entry", { branches: [target] });
      const fixture = nativeTimelineRuntime(
        entry.timelineProps + loopCode(),
        scopeManifest({
          root: [0, "outer"],
          outer: ["inner"],
          inner: ["loop_trial"],
        }),
      );
      if (target === "loop_trial") {
        const rows = await fixture.run();
        expect(rows.map((row) => row.builder_id)).toEqual([
          0,
          "loop_trial",
          "loop_trial",
        ]);
        expect(rows.slice(1).map((row) => row.timeline_variables)).toEqual([
          { row: 1 },
          { row: 2 },
        ]);
      } else {
        await expect(fixture.run()).rejects.toThrow(
          "branches must target trials",
        );
      }
    },
  );

  it.each([false, true])(
    "a terminal trial preserves a reached route and uses no loop branch flags (repeat=%s)",
    async (repeat) => {
      const entry = nativeTrial(1, "Entry", { branches: [2] });
      const target = nativeTrial(2, "Target", {
        repeatConditions: repeat
          ? [
              {
                id: 9,
                jumpToTrialId: 1,
                rules: [{ column: "response", op: "==", value: "never" }],
              },
            ]
          : [],
      });
      const later = nativeTrial(3, "Later");
      expect(target.timelineProps).not.toMatch(
        /ShouldBranchOnFinish|HasBranches/,
      );
      const fixture = nativeTimelineRuntime(
        entry.timelineProps + target.timelineProps + later.timelineProps,
        scopeManifest({ root: [1, 2, 3] }),
      );
      const rows = await fixture.run();
      expect(rows.map((row) => row.builder_id)).toEqual([1, 2]);
      expect(
        fixture.window.ExpBuilderRuntime.emit.mock.calls.filter(
          ([type]) => type === "branch-decision",
        ),
      ).toHaveLength(1);
    },
  );
});
