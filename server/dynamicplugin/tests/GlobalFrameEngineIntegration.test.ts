import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const componentTrace = vi.hoisted(() => [] as string[]);

vi.mock("../components/ImageComponent", () => ({
  default: class MockImageComponent {
    private element: HTMLElement | null = null;
    private name = "";
    private ready = true;

    render(container: HTMLElement, config: any) {
      this.name = config.name;
      this.ready = config.stimulus !== "fail.png";
      componentTrace.push(`prepare:${this.name}`);
      componentTrace.push(
        `defer-offset:${this.name}:${config.__deferOffsetToTrialBoundary}`,
      );
      this.element = document.createElement("div");
      this.element.dataset.mockStimulus = this.name;
      this.element.style.visibility = "hidden";
      container.appendChild(this.element);
      const stimulus = config.__timing.registerStimulus(
        this.name,
        config.stimulus_onset,
        config.stimulus_duration,
        config.__componentId,
        { renderBackend: "webgl", timestampSemantics: "webgl_commit_frame" },
      );
      config.__timing.onStart((timestamp: number) => {
        if (this.element) this.element.style.visibility = "visible";
        componentTrace.push(`activate:${this.name}:${timestamp.toFixed(3)}`);
        stimulus.markOnset(timestamp, { frameTimestamp: timestamp });
      });
      return this.element;
    }

    getPrecisionReadiness() {
      return {
        ready: this.ready,
        reason: this.ready ? "mock_drawable_ready" : "mock_drawable_not_ready",
        fallbackReason: this.ready ? "" : "image_resource_load_or_decode_failed",
        resourceReadyAt: this.ready ? performance.now() : null,
        gpuReadyAt: this.ready ? performance.now() : null,
      };
    }

    hide() {
      if (this.element) this.element.style.visibility = "hidden";
      componentTrace.push(`deactivate:${this.name}`);
    }

    destroy() {
      componentTrace.push(`destroy:${this.name}`);
      this.element?.remove();
      this.element = null;
    }
  },
}));

import { createFrameEngine } from "../../../../expbuilder-jspsych/packages/jspsych/src/timeline/FrameEngine";
import { createPrecisionTiming } from "../utils/PrecisionTiming";

class FakeResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

function trial(name: string, stimulus: string) {
  return {
    components: [
      {
        type: "ImageComponent",
        name,
        stimulus,
        stimulus_onset: null,
        stimulus_duration: 50,
        coordinates: { x: 0, y: 0 },
        zIndex: 0,
      },
    ],
    response_components: [],
    trial_duration: 50,
    response_ends_trial: false,
    preload_assets: false,
    prefetch_next_trials: false,
    dynamic_csv_diagnostics: "off",
    diagnostics_level: "off",
    render_backend: "webgl-strict",
    record_gpu_timing: false,
    __canvasStyles: { width: 1024, height: 768 },
  };
}

function keyboardTrial(name: string, stimulus: string) {
  return {
    ...trial(name, stimulus),
    components: trial(name, stimulus).components.map((component) => ({
      ...component,
      stimulus_duration: null,
    })),
    response_components: [
      {
        type: "KeyboardResponseComponent",
        name: `${name}_keyboard`,
        choices: "ALL_KEYS",
      },
    ],
    trial_duration: null,
    response_ends_trial: true,
    response_timing_enabled: true,
  };
}

describe("DynamicPlugin + core persistent FrameEngine", () => {
  let DynamicPlugin: any;

  beforeEach(async () => {
    componentTrace.length = 0;
    vi.stubGlobal("ResizeObserver", FakeResizeObserver);
    DynamicPlugin = (await import("../index")).default;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    document.body.innerHTML = "";
  });

  it("does not replay an inherited timestamp as a new observed frame", () => {
    let rafCallback: FrameRequestCallback | null = null;
    const engine = createFrameEngine({
      requestAnimationFrame: (callback) => {
        rafCallback = callback;
        return 1;
      },
      cancelAnimationFrame: () => {
        rafCallback = null;
      },
    });
    const context = engine.createTrialContext({ id: "fresh-frame-only" });
    context.markReady(0);
    const timing = createPrecisionTiming({ trialContext: context });
    const starts: number[] = [];
    timing.onStart((timestamp) => starts.push(timestamp));

    timing.startAt(123, "visual_handoff");
    expect(starts).toEqual([]);
    expect(rafCallback).not.toBeNull();
    const callback = rafCallback!;
    rafCallback = null;
    callback(500);

    expect(starts).toEqual([500]);
    expect(timing.getSummary().trialTimeOrigin).toBe(500);
    expect(timing.getSummary().trialTimeOriginSource).toBe("frame_engine_raf");
    engine.reset();
  });

  it("shares one display teardown observer across many prepared trials", async () => {
    const NativeMutationObserver = globalThis.MutationObserver;
    let created = 0;
    let disconnected = 0;
    class CountingMutationObserver {
      private readonly inner: MutationObserver;

      constructor(callback: MutationCallback) {
        created += 1;
        this.inner = new NativeMutationObserver(callback);
      }

      observe(target: Node, options?: MutationObserverInit) {
        this.inner.observe(target, options);
      }

      disconnect() {
        disconnected += 1;
        this.inner.disconnect();
      }

      takeRecords() {
        return this.inner.takeRecords();
      }
    }
    vi.stubGlobal("MutationObserver", CountingMutationObserver as any);

    const engine = createFrameEngine({
      requestAnimationFrame: () => 1,
      cancelAnimationFrame: () => {},
    });
    const jsPsych = {
      precisionTiming: engine,
      pluginAPI: {
        preloadAudio: (_files: string[], done: () => void) => done(),
        preloadVideo: (_files: string[], done: () => void) => done(),
        audioContext: () => null,
      },
      timeline: { description: [] },
      getProgress: () => ({ current_trial_global: 0 }),
      getDisplayContainerElement: () => document.body,
      getDisplayElement: () => document.body,
      getInitSettings: () => ({}),
    };
    const display = document.createElement("div");
    document.body.appendChild(display);

    for (let index = 0; index < 25; index++) {
      const plugin = new DynamicPlugin(jsPsych as any);
      await plugin.prepareTrial(
        display,
        trial(`state-${index}`, `${index}.png`) as any,
        {
          trialIndex: index,
          frameEngine: engine,
          timingContinuous: true,
        },
      );
    }

    expect(created).toBe(1);
    display.innerHTML = "";
    await Promise.resolve();
    expect(disconnected).toBe(1);
    engine.reset();
  });

  it("never advertises atomic precision onset when the drawable is not ready", async () => {
    const engine = createFrameEngine({
      requestAnimationFrame: () => 1,
      cancelAnimationFrame: () => {},
    });
    const jsPsych = {
      precisionTiming: engine,
      pluginAPI: {
        preloadAudio: (_files: string[], done: () => void) => done(),
        preloadVideo: (_files: string[], done: () => void) => done(),
        audioContext: () => null,
      },
      timeline: { description: [] },
      getProgress: () => ({ current_trial_global: 0 }),
      getDisplayContainerElement: () => document.body,
      getDisplayElement: () => document.body,
      getInitSettings: () => ({}),
    };
    const display = document.createElement("div");
    document.body.appendChild(display);
    const plugin = new DynamicPlugin(jsPsych as any);

    await plugin.prepareTrial(display, trial("not-ready", "fail.png") as any, {
      trialIndex: 0,
      frameEngine: engine,
      timingContinuous: true,
    });

    expect(plugin.isPreparedTrialReady()).toBe(false);
    expect(plugin.getPreparedTrialFallbackReason()).toBe(
      "precision_prepare_failed:image_resource_load_or_decode_failed",
    );
    expect(engine.getTransitions()).toHaveLength(0);
    expect(engine.getDiagnostics().live_contexts).toBe(0);
    expect(componentTrace).not.toContainEqual(
      expect.stringMatching(/^activate:not-ready:/),
    );
    engine.reset();
  });

  it("activates B at A's boundary before A's administrative promise resolves", async () => {
    let now = 0;
    vi.spyOn(performance, "now").mockImplementation(() => now);
    let rafCallback: FrameRequestCallback | null = null;
    const postedTasks: Array<() => void> = [];
    const engine = createFrameEngine({
      now: () => now,
      requestAnimationFrame: (callback) => {
        rafCallback = callback;
        return 1;
      },
      cancelAnimationFrame: () => {
        rafCallback = null;
      },
      postTask: (task) => postedTasks.push(task),
    });
    const fire = (timestamp: number) => {
      now = timestamp;
      const callback = rafCallback;
      rafCallback = null;
      expect(callback).not.toBeNull();
      callback!(timestamp);
    };
    const jsPsych = {
      precisionTiming: engine,
      pluginAPI: {
        preloadAudio: (_files: string[], done: () => void) => done(),
        preloadVideo: (_files: string[], done: () => void) => done(),
        audioContext: () => null,
      },
      timeline: { description: [] },
      getProgress: () => ({ current_trial_global: 0 }),
      getDisplayContainerElement: () => document.body,
      getDisplayElement: () => document.body,
      getInitSettings: () => ({}),
    };
    const display = document.createElement("div");
    document.body.appendChild(display);
    const aConfig = trial("A", "white.png");
    const bConfig = trial("B", "black.png");
    const a = new DynamicPlugin(jsPsych as any);
    const b = new DynamicPlugin(jsPsych as any);

    await a.prepareTrial(display, aConfig as any, {
      trialIndex: 0,
      frameEngine: engine,
      timingContinuous: true,
    });
    await b.prepareTrial(display, bConfig as any, {
      trialIndex: 1,
      frameEngine: engine,
      timingContinuous: true,
    });
    expect(componentTrace).toContain("defer-offset:A:true");
    expect(componentTrace).toContain("defer-offset:B:true");

    let aResolved = false;
    const aResult = a.trial(display, aConfig as any).then((result: any) => {
      aResolved = true;
      return result;
    });
    engine.start();
    const period = 1000 / 60;
    fire(0);
    fire(period);
    fire(2 * period);
    componentTrace.push("boundary-tick");
    fire(3 * period);

    expect(componentTrace).toContain("deactivate:A");
    expect(componentTrace).toContain("activate:B:50.000");
    expect(componentTrace.indexOf("deactivate:A")).toBeLessThan(
      componentTrace.indexOf("activate:B:50.000"),
    );
    expect(aResolved).toBe(false);
    expect(postedTasks.length).toBeGreaterThan(0);

    while (postedTasks.length > 0) postedTasks.shift()!();
    const aData: any = await aResult;
    expect(aResolved).toBe(true);
    expect(componentTrace.indexOf("activate:B:50.000")).toBeLessThan(
      componentTrace.indexOf("destroy:A"),
    );
    expect(aData).toMatchObject({
      precision_path: "global_frame_engine",
      precision_path_active: true,
      precision_ready: true,
      early_transition_eligible: true,
      boundary_policy: "frame_tolerant_not_before",
      target_frame_index: 3,
      actual_frame_index: 3,
      frames_presented: 3,
      target_time: 50,
      actual_raf_timestamp: 50,
      deadline_error_ms: 0,
      incoming_ready_before_boundary: true,
      atomic_transition_used: true,
      visual_commit_count_for_boundary: 1,
    });

    const bResult = b.trial(display, bConfig as any);
    fire(4 * period);
    fire(5 * period);
    fire(6 * period);
    while (postedTasks.length > 0) postedTasks.shift()!();
    await bResult;
    engine.reset();
  });

  it("turns a keyboard event into a next-real-frame boundary for an indefinite trial", async () => {
    let now = 0;
    vi.spyOn(performance, "now").mockImplementation(() => now);
    let rafCallback: FrameRequestCallback | null = null;
    const postedTasks: Array<() => void> = [];
    const engine = createFrameEngine({
      now: () => now,
      requestAnimationFrame: (callback) => {
        rafCallback = callback;
        return 1;
      },
      cancelAnimationFrame: () => {
        rafCallback = null;
      },
      postTask: (task) => postedTasks.push(task),
    });
    const fire = (timestamp: number) => {
      now = timestamp;
      const callback = rafCallback;
      rafCallback = null;
      expect(callback).not.toBeNull();
      callback!(timestamp);
    };
    const jsPsych = {
      precisionTiming: engine,
      pluginAPI: {
        preloadAudio: (_files: string[], done: () => void) => done(),
        preloadVideo: (_files: string[], done: () => void) => done(),
        audioContext: () => null,
      },
      timeline: { description: [] },
      getProgress: () => ({ current_trial_global: 0 }),
      getDisplayContainerElement: () => document.body,
      getDisplayElement: () => document.body,
      getInitSettings: () => ({}),
    };
    const display = document.createElement("div");
    document.body.appendChild(display);
    const aConfig = keyboardTrial("response-A", "white.png");
    const bConfig = trial("response-B", "black.png");
    const a = new DynamicPlugin(jsPsych as any);
    const b = new DynamicPlugin(jsPsych as any);
    await a.prepareTrial(display, aConfig as any, {
      trialIndex: 0,
      frameEngine: engine,
      timingContinuous: true,
    });
    await b.prepareTrial(display, bConfig as any, {
      trialIndex: 1,
      frameEngine: engine,
      timingContinuous: true,
    });

    const aResult = a.trial(display, aConfig as any);
    engine.start();
    const period = 1000 / 60;
    fire(0);
    fire(period);
    fire(2 * period);

    now = 42;
    const event = new KeyboardEvent("keydown", { key: "x" });
    Object.defineProperty(event, "timeStamp", { value: 42 });
    window.dispatchEvent(event);
    expect(componentTrace).not.toContain("activate:response-B:50.000");
    fire(3 * period);

    expect(componentTrace).toContain("deactivate:response-A");
    expect(componentTrace).toContain("activate:response-B:50.000");
    expect(engine.getTransitions()[0]).toEqual(
      expect.objectContaining({
        target_time: 42,
        actual_rAF_timestamp: 50,
        deadline_error: 8,
        reason: "response",
      }),
    );

    while (postedTasks.length > 0) postedTasks.shift()!();
    const result = await aResult;
    expect(result.response_time).toBe(42);
    expect(result.rt_trial_origin).toBe(42);

    const bResult = b.trial(display, bConfig as any);
    fire(4 * period);
    fire(5 * period);
    fire(6 * period);
    while (postedTasks.length > 0) postedTasks.shift()!();
    await bResult;
    engine.reset();
  });
});
