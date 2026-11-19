import { describe, it, expect } from "vitest";
import {
  nativeTimelineRuntime,
  nativeTrial,
  scopeManifest,
} from "../helpers/nativeTimelineRuntime";
describe("workspace routing records in generated native execution", () => {
  it("does not run a routing-only Then as an unconditional IF", async () => {
    const a = nativeTrial(1, "A", {
        branches: [2, 3],
        defaultNextTrialId: 2,
        branchConditions: [{ id: 1, kind: "route", rules: [], nextTrialId: 3 }],
      }),
      b = nativeTrial(2, "B", { defaultNextTrialId: null }),
      c = nativeTrial(3, "C", { defaultNextTrialId: null });
    const runtime = nativeTimelineRuntime(
      a.timelineProps + b.timelineProps + c.timelineProps,
      scopeManifest({ root: [1, 2, 3] }),
    );
    expect((await runtime.run()).map((row) => row.builder_id)).toEqual([1, 2]);
  });
});
