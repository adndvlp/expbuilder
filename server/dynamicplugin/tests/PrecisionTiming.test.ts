import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import DynamicPlugin from "../index";
import { createPrecisionTiming } from "../utils/PrecisionTiming";

const createContext = () => {
  const listeners = {
    start: null as null | ((timestamp: number, info: any) => void),
    frame: null as null | ((timestamp: number, info: any) => void),
    post: null as null | ((timestamp: number, info: any) => void),
  };
  const cancel = () => {};
  return {
    listeners,
    context: {
      id: "global-test-context",
      setTrialIndex: vi.fn(),
      getOriginTime: vi.fn(() => null),
      getScheduledOriginTime: vi.fn(() => null),
      getLatestFrameTime: vi.fn(() => null),
      getLatestCommittedFrameTime: vi.fn(() => null),
      getFrameClock: vi.fn(() => ({ periodMs: 1000 / 60 })),
      getFrameIntervalEstimate: vi.fn(() => 1000 / 60),
      getFrameIndex: vi.fn(() => null),
      markReady: vi.fn(),
      setPresentationLifecycle: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
      onStart: vi.fn((callback) => {
        listeners.start = callback;
        return cancel;
      }),
      onFrame: vi.fn((callback) => {
        listeners.frame = callback;
        return cancel;
      }),
      onFrameCommit: vi.fn(() => cancel),
      onPostCommit: vi.fn((callback) => {
        listeners.post = callback;
        return cancel;
      }),
      scheduleAt: vi.fn(() => cancel),
      scheduleVisualTransition: vi.fn(() => cancel),
      scheduleVisualTransaction: vi.fn(() => cancel),
      requestBoundary: vi.fn(() => true),
      replaceBoundary: vi.fn(() => true),
      queuePostCritical: vi.fn(() => ({ cancel: vi.fn() })),
      recordStimulusCommit: vi.fn(),
      getTransitionTelemetry: vi.fn(() => []),
    },
  };
};

describe("PrecisionTiming global FrameEngine adapter", () => {
  it("fails fast when the core did not provide a TrialTimingContext", () => {
    expect(() => createPrecisionTiming({ trialContext: null as any })).toThrow(
      /FrameEngine TrialTimingContext/,
    );
  });

  it("delegates scheduling, boundaries and post-critical work to the context", () => {
    const { context } = createContext();
    const timing = createPrecisionTiming({ trialContext: context as any });
    const scheduled = vi.fn();
    const postCritical = vi.fn();

    timing.scheduleAt(12.5, scheduled, { policy: "not_before" });
    timing.requestBoundary({ targetTimeMs: 50, reason: "timeout" });
    timing.replaceBoundary({ targetTimeMs: 27.2, reason: "response" });
    timing.queuePostCritical(postCritical, {
      label: "finalize",
      responseSafe: true,
    });

    expect(timing.isGlobalFrameEngine()).toBe(true);
    expect(context.scheduleAt).toHaveBeenCalledWith(12.5, scheduled, {
      policy: "not_before",
    });
    expect(context.requestBoundary).toHaveBeenCalledOnce();
    expect(context.replaceBoundary).toHaveBeenCalledOnce();
    expect(context.queuePostCritical).toHaveBeenCalledWith(postCritical, {
      label: "finalize",
      responseSafe: true,
    });
  });

  it("derives its origin only from the context's observed start", () => {
    const { context, listeners } = createContext();
    const timing = createPrecisionTiming({ trialContext: context as any });

    expect(timing.getTrialTimeOrigin()).toBeNull();
    listeners.start?.(1016.667, {
      source: "frame_engine_raf",
      scheduledTimestamp: 1016.667,
    });

    expect(timing.getTrialTimeOrigin()).toBe(1016.667);
    expect(timing.getTrialTimeOriginSource()).toBe("frame_engine_raf");
  });

  it("contains no private animation-frame scheduler or temporal fallback", () => {
    const source = readFileSync("utils/PrecisionTiming.ts", "utf8");
    const postCriticalAdapter = source.slice(
      source.indexOf("const queuePostCritical"),
      source.indexOf("const setNextAudioDeadline"),
    );

    expect(source).not.toContain("requestAnimationFrame");
    expect(source).not.toContain("startAt");
    expect(source).not.toContain("ScheduledFrameEvent");
    expect(source).not.toContain("VisualHandoff");
    expect(postCriticalAdapter).not.toContain("setTimeout");
  });

  it.each([
    ["image", { components: [{ type: "ImageComponent" }] }, true],
    [
      "plain text",
      { components: [{ type: "TextComponent", text: "hello" }] },
      true,
    ],
    [
      "cloze text",
      { components: [{ type: "TextComponent", text: "A %answer%" }] },
      false,
    ],
    ["html", { components: [{ type: "HtmlComponent" }] }, false],
    ["video", { components: [{ type: "VideoComponent" }] }, false],
    ["sketchpad", { components: [{ type: "SketchpadComponent" }] }, false],
    [
      "visual buttons",
      { response_components: [{ type: "ButtonResponseComponent" }] },
      false,
    ],
  ])(
    "uses the global timing authority for supported %s trials",
    (_name, trial, earlyEligible) => {
      const { context } = createContext();
      const plugin = new DynamicPlugin({} as any);
      plugin.setTrialExecutionTiming({
        frameEngine: {} as any,
        trialContext: context as any,
        timingContinuous: earlyEligible,
        allowEarlyActivation: earlyEligible,
        earlyTransitionRejectedReason: earlyEligible
          ? null
          : "not_early_transition_eligible",
      });
      const timing = createPrecisionTiming({
        trialContext: plugin.getTrialTimingContext() as any,
      });

      expect(timing.isGlobalFrameEngine()).toBe(true);
      expect(timing.getTrialContext()).toBe(context);
      expect((DynamicPlugin as any).getTimingIntent(trial)).toBe(
        earlyEligible ? "timing_continuous" : "normal",
      );
    },
  );
});
