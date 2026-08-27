import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getPreloadedAudioBuffer,
  preloadAudioBuffer,
  sampleAudioClock,
  toContextTime,
  toPerformanceTime,
} from "../utils/AudioTiming";
import AudioComponent from "../components/AudioComponent";
import { createPrecisionTiming } from "../utils/PrecisionTiming";
import { createFakeAudioContext } from "./helpers/fakeAudioContext";
import { installFakeRaf, restoreFakeRaf } from "./helpers/fakeRaf";

const TEST_BUFFER = { duration: 2, sampleRate: 48000 };

function stubFetch() {
  const fetchMock = vi.fn().mockResolvedValue({
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("AudioTiming clock bridge", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("falls back to currentTime + performance.now pairing", () => {
    const context = createFakeAudioContext({
      currentTime: 0.25,
      outputTimestamp: null,
    });
    vi.spyOn(performance, "now").mockReturnValue(1234);
    const snapshot = sampleAudioClock(context as any);
    expect(snapshot.contextTime).toBe(0.25);
    expect(snapshot.performanceTime).toBe(1234);
    expect(snapshot.source).toBe("currentTime_performanceNow");
  });

  it("selects the getOutputTimestamp path when values are valid", () => {
    const context = createFakeAudioContext({
      currentTime: 0.25,
      outputTimestamp: { contextTime: 0.5, performanceTime: 950 },
    });
    vi.spyOn(performance, "now").mockReturnValue(999);
    const snapshot = sampleAudioClock(context as any);
    expect(snapshot.contextTime).toBe(0.5);
    expect(snapshot.performanceTime).toBe(950);
    expect(snapshot.source).toBe("getOutputTimestamp");
  });

  it("toContextTime applies the exact lab.js-style formula", () => {
    const snapshot = {
      contextTime: 0.5,
      performanceTime: 950,
      baseLatency: 0.01,
      source: "getOutputTimestamp" as const,
    };
    // (1000 - 950)/1000 + 0.5 - 0.01 = 0.54
    expect(toContextTime(1000, snapshot)).toBe(0.54);
  });

  it("toPerformanceTime is the inverse mapping", () => {
    const snapshot = {
      contextTime: 0.5,
      performanceTime: 950,
      baseLatency: 0.01,
      source: "getOutputTimestamp" as const,
    };
    const contextTime = toContextTime(1000, snapshot);
    expect(toPerformanceTime(contextTime, snapshot)).toBeCloseTo(1000, 9);
  });

  it("includes baseLatency exactly once", () => {
    const base = {
      contextTime: 0.5,
      performanceTime: 950,
      baseLatency: 0,
      source: "getOutputTimestamp" as const,
    };
    const withLatency = { ...base, baseLatency: 0.01 };
    expect(toContextTime(1000, base)).toBe(0.55);
    expect(toContextTime(1000, withLatency)).toBe(0.54);
    expect(toPerformanceTime(0.54, withLatency)).toBeCloseTo(1000, 9);
  });

  it("decoded buffer cache deduplicates the same context+URL", async () => {
    const fetchMock = stubFetch();
    const context = createFakeAudioContext() as any;
    const a = preloadAudioBuffer(context, "audio.wav", 1000);
    const b = preloadAudioBuffer(context, "audio.wav", 1000);
    expect(a).toBe(b);
    await a;
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(getPreloadedAudioBuffer(context, "audio.wav")).not.toBeNull();
    // A second context decodes again.
    const context2 = createFakeAudioContext() as any;
    await preloadAudioBuffer(context2, "audio.wav", 1000);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("clears the preload timeout when fetch/decode wins the race", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    try {
      const fetchMock = stubFetch();
      const context = createFakeAudioContext() as any;
      const promise = preloadAudioBuffer(context, "audio.wav", 10000);
      await vi.advanceTimersByTimeAsync(0);
      await promise;
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(getPreloadedAudioBuffer(context, "audio.wav")).not.toBeNull();
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it("resolves null on timeout and does not cache the buffer", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    try {
      vi.stubGlobal("fetch", vi.fn().mockReturnValue(new Promise(() => {})));
      const context = createFakeAudioContext() as any;
      const promise = preloadAudioBuffer(context, "audio.wav", 500);
      await vi.advanceTimersByTimeAsync(500);
      const result: any = await promise;
      expect(result).toBeNull();
      expect(getPreloadedAudioBuffer(context, "audio.wav")).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("AudioComponent WebAudio scheduled path", () => {
  beforeEach(() => installFakeRaf());
  afterEach(() => {
    restoreFakeRaf();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    document.body.innerHTML = "";
  });

  function fakeJsPsych(context: any) {
    return {
      pluginAPI: {
        audioContext: () => context,
        getAudioPlayer: vi.fn().mockResolvedValue({
          play: vi.fn().mockResolvedValue(undefined),
          pause: vi.fn(),
          stop: vi.fn(),
          ended: false,
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
        }),
      },
    };
  }

  function startedTiming() {
    return timingAt(1000);
  }

  function timingAt(origin: number) {
    const cancel = () => {};
    return createPrecisionTiming({
      expectedFrameMs: 20,
      trialContext: {
        id: "audio-test-context",
        getFrameIntervalEstimate: () => 20,
        start: vi.fn(),
        stop: vi.fn(),
        onStart: (callback: any) => {
          callback(origin, {
            source: "frame_engine_raf",
            scheduledTimestamp: origin,
          });
          return cancel;
        },
        onFrame: () => cancel,
        onFrameCommit: () => cancel,
        onPostCommit: () => cancel,
        scheduleAt: vi.fn(() => cancel),
        requestBoundary: vi.fn(() => true),
        replaceBoundary: vi.fn(() => true),
        queuePostCritical: vi.fn(() => ({ cancel })),
        setNextAudioDeadline: vi.fn(),
        recordStimulusCommit: vi.fn(),
        getTransitionTelemetry: () => [],
      } as any,
    });
  }

  it("never creates an HTMLAudio player for the precision no-controls path", async () => {
    const getAudioPlayer = vi.fn();
    const jsPsych = {
      pluginAPI: {
        audioContext: () => null,
        getAudioPlayer,
      },
    };
    const component = new AudioComponent(jsPsych as any);
    const preparation = component.prepare(document.body, {
      stimulus: "required.wav",
      autoplay: true,
      show_controls: false,
    });

    expect(preparation).toBeNull();
    expect(getAudioPlayer).not.toHaveBeenCalled();
    expect(component.getResourceReadinessState({
      stimulus: "required.wav",
      show_controls: false,
    }).resourceReady).toBe(false);
    component.arm();
    component.activate({ timestamp: 100 });
    expect(getAudioPlayer).not.toHaveBeenCalled();
    component.destroy();
  });

  it("scheduled source receives an explicit target context time", async () => {
    stubFetch();
    const context = createFakeAudioContext({
      currentTime: 0.5,
      baseLatency: 0.01,
      outputTimestamp: { contextTime: 0.5, performanceTime: 950 },
    });
    (context.decodeAudioData as any) = vi.fn().mockResolvedValue(TEST_BUFFER);
    await preloadAudioBuffer(context as any, "audio.wav", 1000);

    const jsPsych = fakeJsPsych(context);
    const component = new AudioComponent(jsPsych as any);
    const container = document.createElement("div");
    document.body.appendChild(container);
    await component.render(container, {
      name: "Audio_1",
      stimulus: "audio.wav",
      autoplay: true,
      __timing: startedTiming(),
    });

    const source = context.createdSources[0];
    // (1000 - 950)/1000 + 0.5 - 0.01 = 0.54
    expect(source.startArgs).toEqual([0.54]);
    expect(source.connectedTo).toBe(context.destination);
    // Known duration: stop is scheduled on the audio clock.
    expect(source.stopArgs).toEqual([0.54 + 2]);
    const diagnostics = component.getDiagnostics();
    expect(diagnostics.audio_backend).toBe("webaudio_scheduled");
    expect(diagnostics.audio_clock_bridge_available).toBe(true);
    expect(diagnostics.audio_timing_degraded).toBe(false);
    expect(diagnostics.physical_audio_onset_abs).toBeNull();
    component.destroy();
  });

  it("pre-arms a decoded successor on its known future boundary", async () => {
    stubFetch();
    const context = createFakeAudioContext({
      currentTime: 0.5,
      baseLatency: 0.01,
      outputTimestamp: { contextTime: 0.5, performanceTime: 950 },
    });
    (context.decodeAudioData as any) = vi.fn().mockResolvedValue(TEST_BUFFER);
    await preloadAudioBuffer(context as any, "audio.wav", 1000);
    vi.spyOn(performance, "now").mockReturnValue(900);

    const component = new AudioComponent(fakeJsPsych(context) as any);
    await component.prepare(document.body, {
      name: "Audio_1",
      stimulus: "audio.wav",
      autoplay: true,
    });
    component.arm({
      scheduledTimestamp: 990,
      predictedSelectedFrameTime: 1000,
    });

    expect(context.createdSources).toHaveLength(1);
    expect(context.createdSources[0].startArgs).toEqual([0.54]);
    expect(component.getDiagnostics()).toMatchObject({
      audio_prearmed: true,
      audio_arm_lead_ms: 100,
      audio_requested_performance_time: 1000,
      audio_requested_ideal_performance_time: 990,
      audio_predicted_selected_frame_time: 1000,
    });

    component.activate({ timestamp: 1000 });
    expect(context.createdSources).toHaveLength(1);
    component.destroy();
  });

  it("cancels and re-arms a pre-scheduled source when the selected boundary frame changes", async () => {
    stubFetch();
    const context = createFakeAudioContext({
      currentTime: 0.5,
      baseLatency: 0.01,
      outputTimestamp: { contextTime: 0.5, performanceTime: 950 },
    });
    (context.decodeAudioData as any) = vi.fn().mockResolvedValue(TEST_BUFFER);
    await preloadAudioBuffer(context as any, "audio.wav", 1000);
    vi.spyOn(performance, "now").mockReturnValue(900);

    const component = new AudioComponent(fakeJsPsych(context) as any);
    await component.prepare(document.body, {
      name: "Audio_1",
      stimulus: "audio.wav",
      autoplay: true,
    });
    component.arm({
      scheduledTimestamp: 990,
      predictedSelectedFrameTime: 1000,
    });
    component.arm({
      scheduledTimestamp: 975,
      predictedSelectedFrameTime: 983.333,
    });

    expect(context.createdSources).toHaveLength(2);
    expect(context.createdSources[0].stopArgs.at(-1)).toBe(-1);
    expect(context.createdSources[1].startArgs[0]).toBeCloseTo(0.523333, 6);
    expect(component.getDiagnostics()).toMatchObject({
      audio_requested_performance_time: 983.333,
      audio_requested_ideal_performance_time: 975,
      audio_predicted_selected_frame_time: 983.333,
      audio_previous_requested_performance_time: 1000,
      audio_rearmed: true,
      audio_rearm_count: 1,
    });

    component.activate({ timestamp: 983.333 });
    expect(context.createdSources).toHaveLength(2);
    component.destroy();
  });

  it("clamps past targets and records lateness", async () => {
    stubFetch();
    const context = createFakeAudioContext({
      currentTime: 0.5,
      baseLatency: 0.01,
      outputTimestamp: { contextTime: 0.5, performanceTime: 950 },
    });
    (context.decodeAudioData as any) = vi.fn().mockResolvedValue(TEST_BUFFER);
    await preloadAudioBuffer(context as any, "audio.wav", 1000);

    const jsPsych = fakeJsPsych(context);
    const component = new AudioComponent(jsPsych as any);
    const container = document.createElement("div");
    document.body.appendChild(container);
    // origin 800 → target 0.34 < currentTime 0.5 → clamped, 160ms late
    const timing = timingAt(800);
    await component.render(container, {
      name: "Audio_1",
      stimulus: "audio.wav",
      autoplay: true,
      __timing: timing,
    });

    const source = context.createdSources[0];
    expect(source.startArgs).toEqual([0.5]);
    const diagnostics = component.getDiagnostics();
    expect(diagnostics.audio_schedule_late_by_ms).toBe(160);
    expect(diagnostics.audio_scheduled_context_time).toBe(0.5);
    component.destroy();
  });

  it("HTMLAudio fallback marks the audio timing degraded", async () => {
    const jsPsych = fakeJsPsych(null);
    const component = new AudioComponent(jsPsych as any);
    const container = document.createElement("div");
    document.body.appendChild(container);
    await component.render(container, {
      name: "Audio_1",
      stimulus: "audio.wav",
      autoplay: true,
      show_controls: true,
      __timing: startedTiming(),
    });
    await Promise.resolve();
    await Promise.resolve();
    const diagnostics = component.getDiagnostics();
    expect(diagnostics.audio_backend).toBe("htmlaudio_fallback");
    expect(diagnostics.audio_timing_degraded).toBe(true);
    expect(diagnostics.audio_timing_degraded_reason).toBe(
      "html_audio_presentation_unobservable",
    );
    expect(diagnostics.physical_audio_onset_abs).toBeNull();
    component.destroy();
  });
});
