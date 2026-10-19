import { describe, expect, it } from "vitest";
import { nativeTimelineRuntime, nativeTrial, scopeManifest } from "../../helpers/nativeTimelineRuntime";

const manifest = () => scopeManifest({ root: [1, 2] });
const code = nativeTrial(1, "Source", { branches: [2], defaultNextTrialId: 2 }).timelineProps + nativeTrial(2, "Target").timelineProps;
const cursor = () => ({ kind: "cursor", targetId: "2", experimentRevision: "fixture-r1", afterCompleted: false, loops: [],
  globalRouting: { nativeTimeline: { entries: [{ id: "2", parameterTarget: "2", parameters: { stimulus: { source: "typed", value: "saved" } } }], index: 0 } } });

describe("navigation checkpoint validation", () => {
  it("[TJ-08] accepts only the current manifest and revision", async () => {
    const saved = cursor();
    saved.experimentRevision = "another-revision";
    await expect(nativeTimelineRuntime(code, manifest(), { resume: saved }).run()).rejects.toThrow("revision");
  });
  it("rejects a destination not compiled into the artifact", async () => {
    const saved = cursor();
    saved.targetId = "missing";
    await expect(nativeTimelineRuntime(code, manifest(), { resume: saved }).run()).rejects.toThrow("revision");
  });
  it("rejects a queue item that belongs to another scope", async () => {
    const saved = cursor();
    saved.globalRouting.nativeTimeline.entries[0].id = "missing";
    await expect(nativeTimelineRuntime(code, manifest(), { resume: saved }).run()).rejects.toThrow("destination");
  });
  it("rejects a cursor outside its saved queue", async () => {
    const saved = cursor();
    saved.globalRouting.nativeTimeline.index = 99;
    await expect(nativeTimelineRuntime(code, manifest(), { resume: saved }).run()).rejects.toThrow("cursor");
  });
  it("restores destination parameters once and retains terminal behavior", async () => {
    const rows = await nativeTimelineRuntime(code, manifest(), { resume: cursor() }).run();
    expect(rows.map(row => row.builder_id)).toEqual([2]);
    expect(rows[0].parameters).toEqual({ stimulus: { source: "typed", value: "saved" } });
  });
});
