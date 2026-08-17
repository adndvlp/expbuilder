import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createPrecisionTiming, getResponseRT } from "../utils/PrecisionTiming";
import {
  installFakeRaf,
  pendingRafCount,
  restoreFakeRaf,
  stepRaf,
} from "./helpers/fakeRaf";

describe("getResponseRT shared event timing", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  function eventWithTimestamp(timeStamp: number): Event {
    const event = new Event("input");
    Object.defineProperty(event, "timeStamp", { value: timeStamp });
    return event;
  }

  it("uses the event timestamp when timing is absent and keeps source consistent", () => {
    const target: any = { start_time: 1000 };
    vi.spyOn(performance, "now").mockReturnValue(1270);
    const rt = getResponseRT(target, undefined, eventWithTimestamp(1250));
    expect(rt).toBe(250);
    expect(target.responseTimestampSource).toBe("event.timeStamp");
  });

  it("falls back to performance.now for an invalid event timestamp", () => {
    const target: any = { start_time: 1000 };
    vi.spyOn(performance, "now").mockReturnValue(1270);
    const rt = getResponseRT(target, undefined, eventWithTimestamp(0));
    expect(rt).toBe(270);
    expect(target.responseTimestampSource).toBe("performance.now_fallback");
  });

  it("marks the fallback source when no event exists", () => {
    const target: any = { start_time: 1000 };
    vi.spyOn(performance, "now").mockReturnValue(1270);
    const rt = getResponseRT(target, undefined);
    expect(rt).toBe(270);
    expect(target.responseTimestampSource).toBe("performance.now_fallback");
  });

  it("keeps the shared timing path when timing is present", () => {
    installFakeRaf();
    try {
      const timing = createPrecisionTiming({ expectedFrameMs: 20 });
      timing.startAt(1000, "fresh_raf");
      const target: any = { start_time: null };
      vi.spyOn(performance, "now").mockReturnValue(1270);
      const rt = getResponseRT(target, timing, eventWithTimestamp(1250));
      expect(rt).toBe(250);
      expect(target.responseTimestampSource).toBe("event.timeStamp");
    } finally {
      restoreFakeRaf();
    }
  });
});

describe("PrecisionTiming origin", () => {
  beforeEach(() => {
    installFakeRaf();
  });

  afterEach(() => {
    restoreFakeRaf();
  });

  it("start() does not set origin before the first rAF frame", () => {
    const timing = createPrecisionTiming({ expectedFrameMs: 20 });
    timing.start();
    expect(timing.getTrialTimeOrigin()).toBeNull();
    expect(timing.getTrialTimeOriginSource()).toBeNull();
    expect(pendingRafCount()).toBe(1);
  });

  it("start() sets origin to the rAF timestamp with source fresh_raf", () => {
    const timing = createPrecisionTiming({ expectedFrameMs: 20 });
    timing.start();
    stepRaf(1000);
    expect(timing.getTrialTimeOrigin()).toBe(1000);
    expect(timing.getTrialTimeOriginSource()).toBe("fresh_raf");
  });

  it("startAt(t, 'visual_handoff') sets exact origin and source", () => {
    const timing = createPrecisionTiming({ expectedFrameMs: 20 });
    timing.startAt(777, "visual_handoff");
    expect(timing.getTrialTimeOrigin()).toBe(777);
    expect(timing.getTrialTimeOriginSource()).toBe("visual_handoff");
  });

  it("second start/startAt cannot re-origin active timing", () => {
    const timing = createPrecisionTiming({ expectedFrameMs: 20 });
    timing.startAt(500, "fresh_raf");
    timing.startAt(900, "visual_handoff");
    timing.start();
    expect(timing.getTrialTimeOrigin()).toBe(500);
    expect(timing.getTrialTimeOriginSource()).toBe("fresh_raf");
  });

  it("getOnsetTime() remains a compatibility alias of getTrialTimeOrigin()", () => {
    const timing = createPrecisionTiming({ expectedFrameMs: 20 });
    timing.startAt(640, "fresh_raf");
    expect(timing.getOnsetTime()).toBe(640);
  });

  it("getSummary exposes canonical origin fields and compatibility onsetTime", () => {
    const timing = createPrecisionTiming({ expectedFrameMs: 20 });
    timing.startAt(1000, "visual_handoff");
    const summary = timing.getSummary(1250);
    expect(summary.trialTimeOrigin).toBe(1000);
    expect(summary.trialTimeOriginSource).toBe("visual_handoff");
    expect(summary.onsetTime).toBe(1000);
    expect(summary.actualDuration).toBe(250);
  });
});

describe("PrecisionTiming scheduler policies", () => {
  beforeEach(() => {
    installFakeRaf();
  });

  afterEach(() => {
    restoreFakeRaf();
  });

  it("nearest policy chooses the current frame when errorNow <= errorNext", () => {
    const timing = createPrecisionTiming({ expectedFrameMs: 20 });
    timing.startAt(1000, "fresh_raf");
    const calls: number[] = [];
    timing.scheduleAt(10, (timestamp) => calls.push(timestamp));
    // target 1010: frame 1015 -> errorNow 5, errorNext 25
    stepRaf(1015);
    expect(calls).toEqual([1015]);
  });

  it("nearest policy waits when the next frame would be closer", () => {
    const timing = createPrecisionTiming({ expectedFrameMs: 20 });
    timing.startAt(1000, "fresh_raf");
    const calls: number[] = [];
    timing.scheduleAt(10, (timestamp) => calls.push(timestamp));
    // target 1010: frame 1001 -> errorNow 9, errorNext 11 -> wait
    stepRaf(1001);
    expect(calls).toEqual([]);
    // frame 1021 -> errorNow 11, errorNext 31 -> run
    stepRaf(1021);
    expect(calls).toEqual([1021]);
  });

  it("not_before policy never fires before the target", () => {
    const timing = createPrecisionTiming({ expectedFrameMs: 20 });
    timing.startAt(1000, "fresh_raf");
    const calls: number[] = [];
    timing.scheduleAt(30, (timestamp) => calls.push(timestamp), {
      policy: "not_before",
    });
    // target 1030. Nearest policy would run at 1021 (error 9 vs 29);
    // not_before must wait.
    stepRaf(1021);
    expect(calls).toEqual([]);
    stepRaf(1041);
    expect(calls).toEqual([1041]);
  });

  it("not_before fires on the first observed frame >= target", () => {
    const timing = createPrecisionTiming({ expectedFrameMs: 20 });
    const calls: number[] = [];
    timing.scheduleAt(0, (timestamp) => calls.push(timestamp), {
      policy: "not_before",
    });
    // target 1000: startAt runs due events immediately at 1000
    timing.startAt(1000, "fresh_raf");
    expect(calls).toEqual([1000]);
  });

  it("onset (due-event) callback runs before the frame commit callback", () => {
    const timing = createPrecisionTiming({ expectedFrameMs: 20 });
    const order: string[] = [];
    timing.scheduleAt(0, () => order.push("due"));
    timing.onFrameCommit(() => order.push("commit"));
    timing.startAt(1000, "fresh_raf");
    expect(order).toEqual(["due", "commit"]);
  });

  it("stop cancels the pending rAF", () => {
    const timing = createPrecisionTiming({ expectedFrameMs: 20 });
    timing.start();
    expect(pendingRafCount()).toBe(1);
    timing.stop();
    expect(pendingRafCount()).toBe(0);
  });
});

describe("PrecisionTiming frame diagnostics", () => {
  beforeEach(() => {
    installFakeRaf();
  });

  afterEach(() => {
    restoreFakeRaf();
  });

  it("frame estimator keeps at most the last 10 valid intervals", () => {
    const timing = createPrecisionTiming({ expectedFrameMs: 20 });
    timing.startAt(1000, "fresh_raf");
    // 12 frames: first 2 intervals are outliers, last 10 are 20ms apart.
    const frames = [1040, 1100];
    for (let i = 2; i < 12; i += 1) {
      frames.push(1100 + (i - 2) * 20);
    }
    for (const frame of frames) stepRaf(frame);
    expect(timing.getFrameIntervalEstimate()).toBe(20);
  });

  it("ignores non-finite and <= 0.25 ms intervals in the estimator", () => {
    const timing = createPrecisionTiming({ expectedFrameMs: 20 });
    timing.startAt(1000, "fresh_raf");
    stepRaf(1000.1);
    stepRaf(1020);
    stepRaf(1040);
    stepRaf(1060);
    expect(timing.getFrameIntervalEstimate()).toBe(20);
  });

  it("dropped frame count remains a baseline-based estimate", () => {
    const timing = createPrecisionTiming({ expectedFrameMs: 20 });
    timing.startAt(1000, "fresh_raf");
    stepRaf(1020);
    stepRaf(1040);
    stepRaf(1080); // one 40ms interval
    const summary = timing.getSummary(1080);
    // intervals [20, 20, 40], baseline 20 -> dropped = (40/20 - 1) = 1
    expect(summary.droppedFrameCount).toBe(1);
  });
});
