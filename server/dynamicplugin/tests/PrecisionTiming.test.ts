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

describe("PrecisionTiming post-commit queue (P2)", () => {
  beforeEach(() => {
    installFakeRaf();
  });
  afterEach(() => {
    restoreFakeRaf();
  });

  it("runs post-commit callbacks exactly once, after the commit phase, with the commit timestamp", () => {
    const timing = createPrecisionTiming();
    const order: string[] = [];
    timing.onFrameCommit((timestamp) => {
      order.push(`commit:${timestamp}`);
    });
    timing.queuePostCommit((timestamp) => {
      order.push(`postCommit:${timestamp}`);
    });

    timing.start();
    stepRaf(1000);

    expect(order).toEqual(["commit:1000", "postCommit:1000"]);
    // The post-commit callback observes the frame as committed.
    let observedCommitted: number | null = null;
    timing.queuePostCommit(() => {
      observedCommitted = timing.getSummary(performance.now()).latestCommittedFrameTime;
    });
    stepRaf(1016);
    expect(observedCommitted).toBe(1016);
  });

  it("is FIFO and one-shot; callbacks queued during post-commit run on the NEXT frame", () => {
    const timing = createPrecisionTiming();
    const order: string[] = [];
    let queuedLate = false;
    timing.queuePostCommit((timestamp) => {
      order.push(`first:${timestamp}`);
      if (!queuedLate) {
        queuedLate = true;
        timing.queuePostCommit((lateTimestamp) => {
          order.push(`late:${lateTimestamp}`);
        });
      }
    });
    timing.queuePostCommit((timestamp) => {
      order.push(`second:${timestamp}`);
    });

    timing.start();
    stepRaf(1000);
    stepRaf(1016);

    expect(order).toEqual(["first:1000", "second:1000", "late:1016"]);
  });

  it("supports cancellation via the returned unsubscribe", () => {
    const timing = createPrecisionTiming();
    const callback = vi.fn();
    const unsubscribe = timing.queuePostCommit(callback);
    unsubscribe();
    unsubscribe(); // idempotent

    timing.start();
    stepRaf(1000);

    expect(callback).not.toHaveBeenCalled();
  });

  it("F. a post-commit callback that stops the scheduler prevents the remaining snapshot callbacks", () => {
    const timing = createPrecisionTiming();
    const calls: string[] = [];

    timing.queuePostCommit((timestamp) => {
      calls.push(`A:${timestamp}`);
      timing.stop();
      // Queued DURING the phase, AFTER stop(): the loop clears the queue
      // again on break — nothing may survive a stop.
      timing.queuePostCommit((lateTimestamp) => {
        calls.push(`late:${lateTimestamp}`);
      });
    });
    timing.queuePostCommit((timestamp) => {
      calls.push(`B:${timestamp}`);
    });

    timing.start();
    stepRaf(1000); // A runs → stop → B (snapshot) must NOT run

    expect(calls).toEqual(["A:1000"]);
    // The queue is literally empty: a subsequent frame runs nothing.
    expect(pendingRafCount()).toBe(0);
    stepRaf(1016);
    expect(calls).toEqual(["A:1000"]);
  });

  it("clears pending post-commit callbacks on stop", () => {
    const timing = createPrecisionTiming();
    const callback = vi.fn();

    timing.start();
    stepRaf(1000); // initial frame
    timing.queuePostCommit(callback);
    timing.stop();

    stepRaf(1016); // any stale frame
    expect(callback).not.toHaveBeenCalled();
  });

  it("does not run post-commit when a due event stops the trial before the commit phase", () => {
    const timing = createPrecisionTiming();
    const order: string[] = [];
    timing.onFrameCommit(() => {
      order.push("commit");
    });

    timing.start();
    stepRaf(1000); // commit (initial frame)
    stepRaf(1016); // commit (establishes estimate)

    timing.queuePostCommit(() => {
      order.push("postCommit");
    });
    timing.scheduleAt(300, () => {
      order.push("due");
      timing.stop(); // stops during runDueEvents → no commit/postCommit
    });
    stepRaf(1300); // due fires → stop

    expect(order).toEqual(["commit", "commit", "due"]);
  });

  it("shares the same observable phase ordering between startAt and tick", () => {
    const timing = createPrecisionTiming();
    const order: string[] = [];
    timing.onFrameCommit(() => {
      order.push("commit");
    });
    timing.queuePostCommit(() => {
      order.push("postCommit");
    });
    timing.scheduleAt(0, () => {
      order.push("due:0");
    });

    timing.startAt(1000, "host_coordinator");

    // startAt must run: due → commit → postCommit, all for the initial frame.
    expect(order).toEqual(["due:0", "commit", "postCommit"]);
    expect(timing.getSummary(performance.now()).latestCommittedFrameTime).toBe(1000);
  });
});

describe("PrecisionTiming committed-frame authority", () => {
  beforeEach(() => {
    installFakeRaf();
  });
  afterEach(() => {
    restoreFakeRaf();
  });

  it("distinguishes the latest observed frame from the last committed frame", () => {
    const timing = createPrecisionTiming({ recordFrameTiming: true });

    timing.start();
    stepRaf(1700); // start frame: origin + commit phase runs → committed = 1700
    stepRaf(1716); // establishes a realistic ~16 ms frame interval estimate
    stepRaf(1732);

    let dueFired = false;
    timing.scheduleAt(300, () => {
      dueFired = true;
      timing.stop(); // trial ends during runDueEvents, before the commit phase
    });

    stepRaf(1984); // tick: commits normally → committed = 1984
    stepRaf(2000); // tick: latestFrameTime = 2000; due fires; stop; NO commit phase

    expect(dueFired).toBe(true);
    const summary = timing.getSummary(2000);
    expect(summary.latestFrameTime).toBe(2000);
    expect(summary.latestCommittedFrameTime).toBe(1984);
  });

  it("exposes null latestCommittedFrameTime before any commit", () => {
    const timing = createPrecisionTiming();
    expect(timing.getSummary(performance.now()).latestCommittedFrameTime).toBeNull();
  });
});

describe("PrecisionTiming origin", () => {  beforeEach(() => {
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
    timing.scheduleAt(16, (timestamp) => calls.push(timestamp));
    // target 1016: frame 1005 -> errorNow 11, next 1025 -> error 9 -> wait
    // (the 5 ms interval is an outlier and must NOT collapse the period)
    stepRaf(1005);
    expect(calls).toEqual([]);
    // frame 1021 -> errorNow 5, errorNext 21 -> run
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

describe("P5 frame-phase predictor", () => {
  beforeEach(() => {
    installFakeRaf();
  });

  afterEach(() => {
    restoreFakeRaf();
  });

  const feed = (timing: ReturnType<typeof createPrecisionTiming>, frames: number[]) => {
    timing.startAt(frames[0], "fresh_raf");
    for (const frame of frames.slice(1)) stepRaf(frame);
    return timing.getSummary(frames[frames.length - 1]);
  };

  it("1. stabilizes at ~16.67 ms on a 60 Hz sequence", () => {
    const summary = feed(createPrecisionTiming(), [
      1000, 1016.7, 1033.4, 1050.1, 1066.8, 1083.5,
    ]);
    expect(Math.abs(summary.framePeriodEstimateMs - 16.67)).toBeLessThan(0.7);
  });

  it("2. stabilizes at ~8.33 ms on a 120 Hz sequence", () => {
    const summary = feed(createPrecisionTiming(), [
      1000, 1008.3, 1016.6, 1024.9, 1033.2, 1041.5, 1049.8,
    ]);
    expect(Math.abs(summary.framePeriodEstimateMs - 8.33)).toBeLessThan(0.5);
  });

  it("3. stabilizes at ~6.94 ms on a 144 Hz sequence", () => {
    const summary = feed(createPrecisionTiming(), [
      1000, 1006.94, 1013.88, 1020.82, 1027.76, 1034.7, 1041.64, 1048.58,
    ]);
    expect(Math.abs(summary.framePeriodEstimateMs - 6.94)).toBeLessThan(0.5);
  });

  it("4. stabilizes at ~4.17 ms on a 240 Hz sequence", () => {
    const summary = feed(createPrecisionTiming(), [
      1000, 1004.17, 1008.34, 1012.51, 1016.68, 1020.85, 1025.02, 1029.19, 1033.36,
    ]);
    expect(Math.abs(summary.framePeriodEstimateMs - 4.17)).toBeLessThan(0.4);
  });

  it("5. tolerates jitter without violent oscillation", () => {
    const summary = feed(createPrecisionTiming(), [
      1000, 1016.5, 1033.1, 1049.8, 1066.6, 1083.3,
    ]);
    expect(Math.abs(summary.framePeriodEstimateMs - 16.65)).toBeLessThan(0.35);
  });

  it("6. one dropped frame does not distort the period estimate", () => {
    const summary = feed(createPrecisionTiming(), [
      1000, 1016.7, 1033.4, 1066.8, 1083.5, 1100.2,
    ]);
    expect(Math.abs(summary.framePeriodEstimateMs - 16.7)).toBeLessThan(0.8);
  });

  it("7. a three-frame gap keeps the nominal period", () => {
    const summary = feed(createPrecisionTiming(), [
      1000, 1016.7, 1066.8, 1083.5, 1100.2,
    ]);
    expect(Math.abs(summary.framePeriodEstimateMs - 16.7)).toBeLessThan(1);
  });

  it("8. a short spurious interval does not collapse the estimate", () => {
    const summary = feed(createPrecisionTiming(), [
      1000, 1016.7, 1020, 1036.7, 1053.4, 1070.1,
    ]);
    expect(Math.abs(summary.framePeriodEstimateMs - 16.7)).toBeLessThan(1);
  });

  it("9. converges to a new refresh rate after a sustained transition", () => {
    const timing = createPrecisionTiming();
    const frames: number[] = [1000];
    let t = 1000;
    for (let i = 0; i < 20; i += 1) {
      t += 16.7;
      frames.push(t);
    }
    // mid-transition: a single 8.33 sample must not collapse the estimate
    const firstFastFrame = t + 8.33;
    timing.startAt(1000, "fresh_raf");
    for (const frame of frames.slice(1)) stepRaf(frame);
    stepRaf(firstFastFrame);
    expect(timing.getFrameIntervalEstimate()).toBeGreaterThan(10);
    // sustained fast rate
    t = firstFastFrame;
    for (let i = 0; i < 20; i += 1) {
      t += 8.33;
      stepRaf(t);
    }
    const summary = timing.getSummary(t);
    expect(Math.abs(summary.framePeriodEstimateMs - 8.33)).toBeLessThan(1);
  });

  it("10. nearest around the midpoint (period 16, frames 1000/1016/1032)", () => {
    const timing = createPrecisionTiming({ expectedFrameMs: 16 });
    timing.startAt(1000, "fresh_raf");
    stepRaf(1016);
    stepRaf(1032);

    const target1016 = createPrecisionTiming({ expectedFrameMs: 16 });
    target1016.startAt(1000, "fresh_raf");
    const calls: number[] = [];
    target1016.scheduleAt(16, (timestamp) => calls.push(timestamp)); // target 1016
    stepRaf(1016);
    expect(calls).toEqual([1016]);
    expect(timing.getFrameIntervalEstimate()).toBe(16);
  });

  it("11. nearest fires on the EARLIER frame on exact ties and never into the past", () => {
    const timing = createPrecisionTiming({ expectedFrameMs: 16 });
    const calls: number[] = [];
    timing.scheduleAt(8, (timestamp) => calls.push(timestamp)); // target 1008: tie 1000/1016
    timing.startAt(1000, "fresh_raf");
    expect(calls).toEqual([1000]); // tie → earlier frame (documented policy)

    const pastTarget = createPrecisionTiming({ expectedFrameMs: 16 });
    const pastCalls: number[] = [];
    pastTarget.scheduleAt(-10, (timestamp) => pastCalls.push(timestamp)); // target 990
    pastTarget.startAt(1000, "fresh_raf");
    expect(pastCalls).toEqual([1000]); // never before the first available frame
  });

  it("12. not_before boundaries: 1000→1000, 1000.1→1016, 1016→1016, 1016.1→1032", () => {
    const runCase = async (target: number, frames: number[]) => {
      const timing = createPrecisionTiming({ expectedFrameMs: 16 });
      const calls: number[] = [];
      timing.scheduleAt(target - 1000, (timestamp) => calls.push(timestamp), {
        policy: "not_before",
      });
      timing.startAt(1000, "fresh_raf");
      for (const frame of frames) stepRaf(frame);
      return calls;
    };
    return Promise.all([
      runCase(1000, [1016]).then((calls) => expect(calls).toEqual([1000])),
      runCase(1000.1, [1016]).then((calls) => expect(calls).toEqual([1016])),
      runCase(1016, [1016]).then((calls) => expect(calls).toEqual([1016])),
      runCase(1016.1, [1016, 1032]).then((calls) => expect(calls).toEqual([1032])),
    ]);
  });

  it("13. a late observed rAF fires the event with the OBSERVED timestamp", () => {
    const timing = createPrecisionTiming({ expectedFrameMs: 16 });
    const calls: number[] = [];
    timing.scheduleAt(300, (timestamp) => calls.push(timestamp), {
      policy: "not_before",
    });
    timing.startAt(1000, "fresh_raf");
    stepRaf(1016);
    stepRaf(1032);
    stepRaf(1317); // late delivery past target 1300
    expect(calls).toEqual([1317]);
  });

  it("14. startAt(T) keeps T as the trial origin regardless of predictor state", () => {
    const timing = createPrecisionTiming();
    timing.startAt(2000, "host_coordinator");
    stepRaf(2016.7);
    stepRaf(2033.4);
    const summary = timing.getSummary(2033.4);
    expect(summary.trialTimeOrigin).toBe(2000);
    expect(summary.trialTimeOriginSource).toBe("host_coordinator");
    expect(Math.abs(summary.framePeriodEstimateMs - 16.7)).toBeLessThan(0.7);
  });

  it("15. frameCount/frameIndex semantics remain observed-interval based", () => {
    const timing = createPrecisionTiming({ recordFrameTiming: true });
    timing.startAt(1000, "fresh_raf");
    stepRaf(1016.7);
    stepRaf(1050.1); // three-frame gap
    const summary = timing.getSummary(1050.1);
    expect(summary.frameCount).toBe(2); // observed intervals only
    expect(summary.frameIntervals).toHaveLength(2);
  });

  it("16. a fresh scheduler starts with the fallback period (cold start)", () => {
    const timing = createPrecisionTiming();
    const summary = timing.getSummary(performance.now());
    expect(Math.abs(summary.framePeriodEstimateMs - 1000 / 60)).toBeLessThan(0.01);
    expect(summary.framePredictorSamples).toBe(0);
    expect(summary.framePredictionErrorMs).toBeNull();
  });
});

describe("P5 regime-change and phase-ordinal corrections", () => {
  beforeEach(() => {
    installFakeRaf();
  });

  afterEach(() => {
    restoreFakeRaf();
  });

  it("17. 120→60 slow transition: one 2x frame does not adapt, sustained cadence does", () => {
    const timing = createPrecisionTiming();
    const frames: number[] = [];
    let t = 1000;
    for (let i = 0; i < 20; i += 1) {
      t += 8.33;
      frames.push(t);
    }
    timing.startAt(1000, "fresh_raf");
    for (const frame of frames.slice(0, -1)) stepRaf(frame);

    // One 2x frame: period must remain ~8.33.
    t += 16.67;
    stepRaf(t);
    expect(Math.abs(timing.getFrameIntervalEstimate() - 8.33)).toBeLessThan(1);

    // Sustained 16.67 cadence: must converge to ~16.67.
    for (let i = 0; i < 20; i += 1) {
      t += 16.67;
      stepRaf(t);
    }
    expect(Math.abs(timing.getFrameIntervalEstimate() - 16.67)).toBeLessThan(1.5);
  });

  it("18. 240→120 slow transition converges to the new cadence", () => {
    const timing = createPrecisionTiming();
    let t = 1000;
    timing.startAt(1000, "fresh_raf");
    for (let i = 0; i < 20; i += 1) {
      t += 4.17;
      stepRaf(t);
    }
    expect(Math.abs(timing.getFrameIntervalEstimate() - 4.17)).toBeLessThan(0.5);

    for (let i = 0; i < 20; i += 1) {
      t += 8.33;
      stepRaf(t);
    }
    expect(Math.abs(timing.getFrameIntervalEstimate() - 8.33)).toBeLessThan(1);
  });

  it("19. a single fast ~9.5 ms sample must not collapse the 16.67 estimate", () => {
    const timing = createPrecisionTiming();
    timing.startAt(1000, "fresh_raf");
    stepRaf(1016.7);
    stepRaf(1033.4);
    stepRaf(1042.9); // single ~9.5 ms delta
    expect(Math.abs(timing.getFrameIntervalEstimate() - 16.7)).toBeLessThan(0.5);
  });

  it("20. phase ordinals survive a three-interval gap without artificial 2-period error", () => {
    const timing = createPrecisionTiming();
    timing.startAt(1000, "fresh_raf");
    stepRaf(1016.7);
    stepRaf(1066.8); // 3 intervals from previous observed frame
    stepRaf(1083.5);
    const summary = timing.getSummary(1083.5);
    expect(Math.abs(summary.framePredictionErrorMs)).toBeLessThan(1);
    expect(Math.abs(summary.framePeriodEstimateMs - 16.7)).toBeLessThan(0.7);
  });

  it("21. an isolated three-interval gap never adopts a new period", () => {
    const timing = createPrecisionTiming();
    timing.startAt(1000, "fresh_raf");
    stepRaf(1016.7);
    stepRaf(1033.4);
    stepRaf(1083.5); // isolated 50 ms gap
    stepRaf(1100.2);
    stepRaf(1116.9);
    expect(Math.abs(timing.getFrameIntervalEstimate() - 16.7)).toBeLessThan(0.8);
  });
});

describe("P5 moderate-slow regime and predictor-sample semantics", () => {
  beforeEach(() => {
    installFakeRaf();
  });

  afterEach(() => {
    restoreFakeRaf();
  });

  const stabilize = (timing: ReturnType<typeof createPrecisionTiming>, start: number, period: number, count: number) => {
    let t = start;
    for (let i = 0; i < count; i += 1) {
      t += period;
      stepRaf(t);
    }
    return t;
  };

  it("22. 120→90 Hz: one 11.11 ms sample does not adapt, sustained cadence converges", () => {
    const timing = createPrecisionTiming();
    timing.startAt(1000, "fresh_raf");
    let t = stabilize(timing, 1000, 8.33, 20);
    expect(Math.abs(timing.getFrameIntervalEstimate() - 8.33)).toBeLessThan(1);

    t += 11.11; // single slow sample
    stepRaf(t);
    expect(Math.abs(timing.getFrameIntervalEstimate() - 8.33)).toBeLessThan(1);

    t = stabilize(timing, t, 11.11, 20);
    expect(Math.abs(timing.getFrameIntervalEstimate() - 11.11)).toBeLessThan(1);
  });

  it("23. 165→120 Hz equivalent (6.06 → 8.33 ms) converges", () => {
    const timing = createPrecisionTiming();
    timing.startAt(1000, "fresh_raf");
    let t = stabilize(timing, 1000, 6.06, 20);
    expect(Math.abs(timing.getFrameIntervalEstimate() - 6.06)).toBeLessThan(0.5);

    t = stabilize(timing, t, 8.33, 20);
    expect(Math.abs(timing.getFrameIntervalEstimate() - 8.33)).toBeLessThan(1);
  });

  it("24. a single slow outlier never changes the period", () => {
    const timing = createPrecisionTiming();
    timing.startAt(1000, "fresh_raf");
    let t = stabilize(timing, 1000, 16.7, 10);
    t += 24; // one slow outlier
    stepRaf(t);
    t = stabilize(timing, t, 16.7, 10);
    expect(Math.abs(timing.getFrameIntervalEstimate() - 16.7)).toBeLessThan(0.5);
  });

  it("25. a slow streak interrupted by a nominal sample resets the streak", () => {
    const timing = createPrecisionTiming();
    timing.startAt(1000, "fresh_raf");
    let t = stabilize(timing, 1000, 8.33, 20);
    // two slow samples…
    t += 11.11;
    stepRaf(t);
    t += 11.11;
    stepRaf(t);
    // …interrupted by a nominal sample (streak reset)…
    t += 8.33;
    stepRaf(t);
    // …then a single slow sample again: must NOT adopt yet.
    t += 11.11;
    stepRaf(t);
    expect(Math.abs(timing.getFrameIntervalEstimate() - 8.33)).toBeLessThan(1);
  });

  it("26. framePredictorSamples describes the CURRENT regime after adoption", () => {
    const timing = createPrecisionTiming();
    timing.startAt(1000, "fresh_raf");
    const t = stabilize(timing, 1000, 8.33, 20);
    expect(timing.getSummary(t).framePredictorSamples).toBeGreaterThan(5);

    stabilize(timing, t, 16.67, 20); // 120→60 slow adoption
    const summary = timing.getSummary(t + 20 * 16.67);
    // After adoption the counter reflects the NEW regime, not old history.
    expect(summary.framePredictorSamples).toBeLessThan(25);
    expect(Math.abs(summary.framePeriodEstimateMs - 16.67)).toBeLessThan(1.5);
  });
});

describe("P5 robustness: stable fast regime + mutually exclusive candidates", () => {
  beforeEach(() => {
    installFakeRaf();
  });

  afterEach(() => {
    restoreFakeRaf();
  });

  const stabilize = (timing: ReturnType<typeof createPrecisionTiming>, start: number, period: number, count: number) => {
    let t = start;
    for (let i = 0; i < count; i += 1) {
      t += period;
      stepRaf(t);
    }
    return t;
  };

  it("27. unstable fast deltas (8.3, 4.2, 11.5) do NOT adopt; stable 8.33s do", () => {
    const timing = createPrecisionTiming();
    timing.startAt(1000, "fresh_raf");
    let t = stabilize(timing, 1000, 16.7, 10);

    for (const delta of [8.3, 4.2, 11.5]) {
      t += delta;
      stepRaf(t);
    }
    expect(Math.abs(timing.getFrameIntervalEstimate() - 16.7)).toBeLessThan(0.7);

    for (const delta of [8.33, 8.34, 8.32]) {
      t += delta;
      stepRaf(t);
    }
    expect(Math.abs(timing.getFrameIntervalEstimate() - 8.33)).toBeLessThan(0.5);
  });

  it("28. a multi-frame gap interrupts a moderate-slow streak", () => {
    const timing = createPrecisionTiming();
    timing.startAt(1000, "fresh_raf");
    let t = stabilize(timing, 1000, 8.33, 20);

    // two slow samples…
    t += 11.11;
    stepRaf(t);
    t += 11.11;
    stepRaf(t);
    // …multi-frame gap (16.67 = 2× at 8.33) interrupts the streak…
    t += 16.67;
    stepRaf(t);
    // …a single slow sample again: must NOT adopt 11.11 yet.
    t += 11.11;
    stepRaf(t);
    expect(Math.abs(timing.getFrameIntervalEstimate() - 8.33)).toBeLessThan(1);

    // Three NEW stable slow samples adopt ~11.11.
    t += 11.11;
    stepRaf(t);
    t += 11.11;
    stepRaf(t);
    expect(Math.abs(timing.getFrameIntervalEstimate() - 11.11)).toBeLessThan(1);
  });
});
