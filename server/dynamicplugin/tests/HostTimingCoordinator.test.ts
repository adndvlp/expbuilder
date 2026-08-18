import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { installFakeRaf, restoreFakeRaf, stepRaf } from "./helpers/fakeRaf";

let DynamicPlugin: any = null;

function installFakeWebGL() {
  const gl: any = {
    VERTEX_SHADER: 35633,
    FRAGMENT_SHADER: 35632,
    ARRAY_BUFFER: 34962,
    TEXTURE_2D: 3553,
    RGBA: 6408,
    UNSIGNED_BYTE: 5121,
    BLEND: 3042,
    ONE_MINUS_SRC_ALPHA: 771,
    ONE: 1,
    TRIANGLES: 4,
    COLOR_BUFFER_BIT: 16384,
    COMPILE_STATUS: 35713,
    LINK_STATUS: 35714,
    TEXTURE0: 33984,
    CLAMP_TO_EDGE: 33071,
    NEAREST: 9728,
    LINEAR: 9729,
    TEXTURE_WRAP_S: 10242,
    TEXTURE_WRAP_T: 10243,
    TEXTURE_MIN_FILTER: 10241,
    TEXTURE_MAG_FILTER: 10240,
    UNPACK_PREMULTIPLY_ALPHA_WEBGL: 37440,
    STATIC_DRAW: 35044,
    FLOAT: 5126,
    createShader: () => ({}),
    createProgram: () => ({}),
    createBuffer: () => ({}),
    createTexture: () => ({}),
    shaderSource: () => {},
    compileShader: () => {},
    getShaderParameter: () => true,
    attachShader: () => {},
    linkProgram: () => {},
    getProgramParameter: () => true,
    bindBuffer: () => {},
    bufferData: () => {},
    getAttribLocation: () => 0,
    getUniformLocation: () => ({}),
    viewport: () => {},
    useProgram: () => {},
    uniform2f: () => {},
    uniform4f: () => {},
    uniform1i: () => {},
    enable: () => {},
    blendFunc: () => {},
    clearColor: () => {},
    clear: () => {},
    bindTexture: () => {},
    texParameteri: () => {},
    texImage2D: () => {},
    pixelStorei: () => {},
    activeTexture: () => {},
    enableVertexAttribArray: () => {},
    vertexAttribPointer: () => {},
    drawArrays: () => {},
    getExtension: () => null,
  };
  const originalGetContext = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (
    this: HTMLCanvasElement,
    type: string,
    _options?: any,
  ) {
    if (type === "2d") return null as any;
    return gl as any;
  } as any;
  return () => {
    HTMLCanvasElement.prototype.getContext = originalGetContext;
  };
}

class FakeResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

function installFakeImageDimensions() {
  Object.defineProperty(HTMLImageElement.prototype, "naturalWidth", {
    get: () => 200,
    configurable: true,
  });
  Object.defineProperty(HTMLImageElement.prototype, "naturalHeight", {
    get: () => 200,
    configurable: true,
  });
}

/**
 * Minimal P0-contract mock: register stores a slot keyed by the registrar
 * index, acquire validates the immediate successor and consumes once,
 * outcomes are persisted per successor index.
 */
function createContractCoordinator() {
  const state: {
    slot: null | { timestamp: number; from: number };
    registrarIndex: number;
    outcomes: Map<number, any>;
  } = {
    slot: null,
    registrarIndex: 0,
    outcomes: new Map(),
  };
  const acquireTrialOrigin = vi.fn((index: number) => {
    const slot = state.slot;
    if (!slot || slot.from + 1 !== index) return null;
    const origin = {
      timestamp: slot.timestamp,
      source: "host_coordinator",
      fromTrialIndex: slot.from,
      frameIndex: null,
      acquiredAt: slot.timestamp + 1,
    };
    state.outcomes.set(index, {
      fromTrialIndex: slot.from,
      toTrialIndex: index,
      status: "acquired",
      reason: null,
    });
    state.slot = null; // consume-once
    return origin;
  });
  const registerHandoff = vi.fn((timestamp: number, meta?: any) => {
    state.slot = { timestamp, from: state.registrarIndex };
    return { status: "pending" as const };
  });
  const getTransitionOutcome = vi.fn((index: number) => state.outcomes.get(index) ?? null);
  return { state, acquireTrialOrigin, registerHandoff, getTransitionOutcome };
}

function fakeJsPsych(overrides: Record<string, any> = {}) {
  return {
    pluginAPI: {
      preloadAudio: (_files: string[], complete: () => void) => complete(),
      preloadVideo: (_files: string[], complete: () => void) => complete(),
      audioContext: () => null,
      getAudioPlayer: () =>
        Promise.resolve({
          play: () => Promise.resolve(),
          pause: () => {},
          stop: () => {},
          ended: false,
          addEventListener: () => {},
          removeEventListener: () => {},
        }),
    },
    timeline: { description: [] },
    getProgress: () => ({ current_trial_global: 0 }),
    getDisplayContainerElement: () => document.body,
    getDisplayElement: () => document.body,
    getInitSettings: () => ({}),
    ...overrides,
  };
}

const IMAGE_COMPONENT = {
  type: "ImageComponent",
  name: "ImageComponent_1",
  stimulus: "https://example.com/image.png",
  stimulus_onset: null,
  stimulus_duration: null,
  zIndex: 0,
  coordinates: { x: 0, y: 0 },
};

const KEYBOARD_COMPONENT = {
  type: "KeyboardResponseComponent",
  name: "KeyboardResponseComponent_1",
  choices: "ALL_KEYS",
};

function baseTrial(overrides: Record<string, any> = {}) {
  return {
    components: [IMAGE_COMPONENT],
    response_components: [KEYBOARD_COMPONENT],
    preload_assets: true,
    asset_preload_timeout: 10000,
    prefetch_next_trials: false,
    response_timing_enabled: true,
    dynamic_csv_diagnostics: "full",
    trial_duration: null,
    response_ends_trial: true,
    render_backend: "webgl-strict",
    record_gpu_timing: false,
    __canvasStyles: { width: 1024, height: 768 },
    ...overrides,
  };
}

function startTrial(jsPsych: any, config: Record<string, any>) {
  const display = document.createElement("div");
  document.body.appendChild(display);
  const plugin = new DynamicPlugin(jsPsych as any);
  return plugin.trial(display, config as any);
}

function keydown(timeStamp: number, key = "a") {
  const event = new KeyboardEvent("keydown", { key });
  Object.defineProperty(event, "timeStamp", { value: timeStamp });
  return event;
}

describe("DynamicPlugin host TimingCoordinator (P1)", () => {
  let restoreWebGL: (() => void) | null = null;
  let jsPsych: any;

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    installFakeRaf();
    restoreWebGL = installFakeWebGL();
    installFakeImageDimensions();
    vi.stubGlobal("ResizeObserver", FakeResizeObserver);
    jsPsych = fakeJsPsych();
    vi.resetModules();
    const pluginModule = await import("../index");
    DynamicPlugin = pluginModule.default;
  });

  afterEach(() => {
    restoreFakeRaf();
    restoreWebGL?.();
    vi.unstubAllGlobals();
    vi.useRealTimers();
    vi.restoreAllMocks();
    document.body.innerHTML = "";
  });

  it("A. host present, acquire success → startAt(T, host_coordinator), rt = E - T", async () => {
    const coordinator = createContractCoordinator();
    coordinator.state.slot = { timestamp: 1000, from: 0 };
    coordinator.state.outcomes.set(1, {
      fromTrialIndex: 0,
      toTrialIndex: 1,
      status: "acquired",
      reason: null,
    });
    jsPsych = fakeJsPsych({
      getProgress: () => ({ current_trial_global: 1 }),
      timing: {
        acquireTrialOrigin: coordinator.acquireTrialOrigin,
        registerHandoff: coordinator.registerHandoff,
        getTransitionOutcome: coordinator.getTransitionOutcome,
      },
    });

    const dataPromise = startTrial(
      jsPsych,
      baseTrial({ timing_continuous: true }),
    );
    await vi.advanceTimersByTimeAsync(21000);
    // No rAF step: host origin must be set synchronously via startAt.
    vi.spyOn(performance, "now").mockReturnValue(1260);
    window.dispatchEvent(keydown(1250));
    const data: any = await dataPromise;

    expect(coordinator.acquireTrialOrigin).toHaveBeenCalledTimes(1);
    expect(coordinator.acquireTrialOrigin).toHaveBeenCalledWith(1); // current trial global index
    expect(data.trial_time_origin).toBe(1000);
    expect(data.trial_time_origin_source).toBe("host_coordinator");
    expect(data.rt).toBe(250); // event 1250 - host origin 1000
    expect(data.timing_continuity).toBe("acquired");
    expect(data.timing_lost_reason).toBeNull();
    expect(data.timing_handoff_from_trial_index).toBe(0);
    expect(data.timing_handoff_frame_index).toBeNull();
    expect(data.timing_handoff_acquired_at).toBe(1001);
    // A is continuous: it registers its own outgoing handoff at the end.
    expect(coordinator.registerHandoff).toHaveBeenCalledTimes(1);
    expect(coordinator.registerHandoff.mock.calls[0][0]).toBe(1000);
    expect(data.timing_handoff_register_status).toBe("pending");
    expect(data.visual_handoff_available).toBe(false);
    expect(data.visual_handoff_consumed).toBe(false);
    expect(data.visual_handoff_lost).toBe(false);
  });

  it("B. host present, acquire null + outcome lost → fresh_raf + timing_lost_reason", async () => {
    const coordinator = createContractCoordinator();
    coordinator.state.outcomes.set(1, {
      fromTrialIndex: 0,
      toTrialIndex: 1,
      status: "lost",
      reason: "frame_elapsed",
    });
    jsPsych = fakeJsPsych({
      getProgress: () => ({ current_trial_global: 1 }),
      timing: {
        acquireTrialOrigin: coordinator.acquireTrialOrigin,
        registerHandoff: coordinator.registerHandoff,
        getTransitionOutcome: coordinator.getTransitionOutcome,
      },
    });

    const dataPromise = startTrial(
      jsPsych,
      baseTrial({ timing_continuous: true }),
    );
    await vi.advanceTimersByTimeAsync(21000);
    stepRaf(1050); // fresh_raf origin
    vi.spyOn(performance, "now").mockReturnValue(1260);
    window.dispatchEvent(keydown(1250));
    const data: any = await dataPromise;

    expect(coordinator.acquireTrialOrigin).toHaveBeenCalledTimes(1);
    expect(data.trial_time_origin_source).toBe("fresh_raf");
    expect(data.trial_time_origin).toBe(1050);
    expect(data.timing_continuity).toBe("lost");
    expect(data.timing_lost_reason).toBe("frame_elapsed");
    expect(data.visual_handoff_available).toBe(false);
    expect(data.visual_handoff_consumed).toBe(false);
  });

  it("C. host absent → legacy VisualHandoff still works (no regression)", async () => {
    // A: frame-boundary trial creates a legacy handoff.
    const first = startTrial(jsPsych, baseTrial({ trial_duration: 300 }));
    await vi.advanceTimersByTimeAsync(21000);
    stepRaf(1700);
    stepRaf(2000);
    const dataA: any = await first;
    expect(dataA.visual_frame_boundary_handoff).toBe(true);
    expect(dataA.trial_time_origin_source).toBe("fresh_raf");

    // B: consumes the legacy handoff.
    const second = startTrial(jsPsych, baseTrial({ trial_duration: 300 }));
    await vi.advanceTimersByTimeAsync(21000);
    stepRaf(2300);
    stepRaf(2600);
    const dataB: any = await second;

    expect(dataB.trial_time_origin_source).toBe("visual_handoff");
    expect(dataB.trial_time_origin).toBe(2000);
    expect(dataB.timing_continuity).toBeUndefined();
    expect(dataB.timing_lost_reason).toBeUndefined();
  });

  it("D. precedence: host present + legacy pending → legacy ignored, fresh_raf", async () => {
    // Create a legacy pending handoff with a host-less trial.
    const first = startTrial(jsPsych, baseTrial({ trial_duration: 300 }));
    await vi.advanceTimersByTimeAsync(21000);
    stepRaf(1700);
    stepRaf(2000);
    await first;

    // Now a host-present CONTINUOUS trial whose acquire returns null: it must
    // ignore the legacy pending handoff entirely.
    const coordinator = createContractCoordinator();
    coordinator.state.outcomes.set(1, {
      fromTrialIndex: 0,
      toTrialIndex: 1,
      status: "lost",
      reason: "never_registered",
    });
    jsPsych = fakeJsPsych({
      getProgress: () => ({ current_trial_global: 1 }),
      timing: {
        acquireTrialOrigin: coordinator.acquireTrialOrigin,
        registerHandoff: coordinator.registerHandoff,
        getTransitionOutcome: coordinator.getTransitionOutcome,
      },
    });

    const dataPromise = startTrial(
      jsPsych,
      baseTrial({ timing_continuous: true }),
    );
    await vi.advanceTimersByTimeAsync(21000);
    stepRaf(2300);
    vi.spyOn(performance, "now").mockReturnValue(2460);
    window.dispatchEvent(keydown(2450));
    const data: any = await dataPromise;

    expect(data.trial_time_origin_source).toBe("fresh_raf");
    expect(data.trial_time_origin).toBe(2300); // NOT the legacy 2000
    expect(data.visual_handoff_available).toBe(false);
    expect(data.visual_handoff_consumed).toBe(false);
    expect(data.timing_continuity).toBe("lost");
    expect(data.timing_lost_reason).toBe("never_registered");
  });

  it("E. first trial (index 0): no acquire, fresh_raf, continuity none, outgoing handoff still registered", async () => {
    const coordinator = createContractCoordinator();
    coordinator.state.registrarIndex = 0;
    jsPsych = fakeJsPsych({
      getProgress: () => ({ current_trial_global: 0 }),
      timing: {
        acquireTrialOrigin: coordinator.acquireTrialOrigin,
        registerHandoff: coordinator.registerHandoff,
        getTransitionOutcome: coordinator.getTransitionOutcome,
      },
    });

    const dataPromise = startTrial(
      jsPsych,
      baseTrial({ timing_continuous: true, trial_duration: 300 }),
    );
    await vi.advanceTimersByTimeAsync(21000);
    stepRaf(1700); // start + commit
    stepRaf(2000); // due event ends the trial BEFORE this frame's commit phase
    const data: any = await dataPromise;

    expect(coordinator.acquireTrialOrigin).not.toHaveBeenCalled();
    expect(data.trial_time_origin_source).toBe("fresh_raf");
    expect(data.trial_time_origin).toBe(1700);
    expect(data.timing_continuity).toBe("none");
    expect(data.timing_lost_reason).toBeNull();

    expect(coordinator.registerHandoff).toHaveBeenCalledTimes(1);
    const [timestamp, meta] = coordinator.registerHandoff.mock.calls[0];
    // Last COMMITTED frame (1700), NOT the due-event frame timestamp (2000).
    expect(timestamp).toBe(1700);
    expect(meta.frameIntervalEstimateMs).toBeGreaterThan(0);
    expect(data.timing_handoff_register_status).toBe("pending");
  });

  it("F. chain A→B→C: B acquires A's committed frame, C acquires B's — never TA", async () => {
    const coordinator = createContractCoordinator();

    const runTrial = async (
      index: number,
      frames: number[],
      continuous: boolean,
    ) => {
      coordinator.state.registrarIndex = index;
      jsPsych = fakeJsPsych({
        getProgress: () => ({ current_trial_global: index }),
        timing: {
          acquireTrialOrigin: coordinator.acquireTrialOrigin,
          registerHandoff: coordinator.registerHandoff,
          getTransitionOutcome: coordinator.getTransitionOutcome,
        },
      });
      const promise = startTrial(
        jsPsych,
        baseTrial({ timing_continuous: continuous, trial_duration: 300 }),
      );
      await vi.advanceTimersByTimeAsync(21000);
      for (const frame of frames) {
        stepRaf(frame);
      }
      return promise;
    };

    const dataA: any = await runTrial(0, [1700, 1984, 2000], true);
    expect(dataA.trial_time_origin_source).toBe("fresh_raf");
    expect(dataA.timing_handoff_register_status).toBe("pending");
    // A registered its last COMMITTED frame (1984), not the due frame (2000).
    expect(coordinator.registerHandoff.mock.calls[0][0]).toBe(1984);

    const dataB: any = await runTrial(1, [2184, 2284], true);
    expect(dataB.trial_time_origin_source).toBe("host_coordinator");
    expect(dataB.trial_time_origin).toBe(1984); // A's handoff TA (committed)
    expect(dataB.timing_continuity).toBe("acquired");
    expect(dataB.timing_handoff_from_trial_index).toBe(0);
    // B registered its last committed frame (2184), not its due frame (2284).
    expect(coordinator.registerHandoff.mock.calls[1][0]).toBe(2184);

    const dataC: any = await runTrial(2, [2384, 2484], true);
    expect(dataC.trial_time_origin_source).toBe("host_coordinator");
    expect(dataC.trial_time_origin).toBe(2184); // B's handoff TB, never TA
    expect(dataC.timing_handoff_from_trial_index).toBe(1);

    expect(coordinator.acquireTrialOrigin).toHaveBeenCalledTimes(2); // index 0 skipped
    expect(coordinator.acquireTrialOrigin.mock.calls[0][0]).toBe(1);
    expect(coordinator.acquireTrialOrigin.mock.calls[1][0]).toBe(2);
  });

  it.each([
    ["frame_elapsed"],
    ["gap_interposed"],
    ["stale_at_register"],
    ["invalid_timestamp"],
    ["never_registered"],
  ])("G. loss reason %s → fresh_raf + timing_lost_reason", async (reason) => {
    const coordinator = createContractCoordinator();
    coordinator.state.outcomes.set(1, {
      fromTrialIndex: 0,
      toTrialIndex: 1,
      status: "lost",
      reason,
    });
    jsPsych = fakeJsPsych({
      getProgress: () => ({ current_trial_global: 1 }),
      timing: {
        acquireTrialOrigin: coordinator.acquireTrialOrigin,
        registerHandoff: coordinator.registerHandoff,
        getTransitionOutcome: coordinator.getTransitionOutcome,
      },
    });

    const dataPromise = startTrial(
      jsPsych,
      baseTrial({ timing_continuous: true }),
    );
    await vi.advanceTimersByTimeAsync(21000);
    stepRaf(1050);
    vi.spyOn(performance, "now").mockReturnValue(1260);
    window.dispatchEvent(keydown(1250));
    const data: any = await dataPromise;

    expect(coordinator.acquireTrialOrigin).toHaveBeenCalledTimes(1);
    expect(coordinator.acquireTrialOrigin).toHaveBeenCalledWith(1);
    expect(data.trial_time_origin_source).toBe("fresh_raf");
    expect(data.timing_continuity).toBe("lost");
    expect(data.timing_lost_reason).toBe(reason);
  });

  it("G2. B normal (A continuous → B normal): never acquires, reports successor_not_continuous", async () => {
    const coordinator = createContractCoordinator();
    coordinator.state.outcomes.set(1, {
      fromTrialIndex: 0,
      toTrialIndex: 1,
      status: "lost",
      reason: "successor_not_continuous",
    });
    jsPsych = fakeJsPsych({
      getProgress: () => ({ current_trial_global: 1 }),
      timing: {
        acquireTrialOrigin: coordinator.acquireTrialOrigin,
        registerHandoff: coordinator.registerHandoff,
        getTransitionOutcome: coordinator.getTransitionOutcome,
      },
    });

    // B is a NORMAL trial: no timing_continuous.
    const dataPromise = startTrial(jsPsych, baseTrial());
    await vi.advanceTimersByTimeAsync(21000);
    stepRaf(1050);
    vi.spyOn(performance, "now").mockReturnValue(1260);
    window.dispatchEvent(keydown(1250));
    const data: any = await dataPromise;

    expect(coordinator.acquireTrialOrigin).not.toHaveBeenCalled();
    expect(data.trial_time_origin_source).toBe("fresh_raf");
    expect(data.timing_continuity).toBe("lost");
    expect(data.timing_lost_reason).toBe("successor_not_continuous");
  });

  it("H. registerHandoff rejected → recorded in data, no legacy handoff activated", async () => {
    const coordinator = createContractCoordinator();
    coordinator.state.registrarIndex = 0;
    coordinator.registerHandoff.mockReturnValue({
      status: "rejected",
      reason: "stale_at_register",
    });
    jsPsych = fakeJsPsych({
      getProgress: () => ({ current_trial_global: 0 }),
      timing: {
        acquireTrialOrigin: coordinator.acquireTrialOrigin,
        registerHandoff: coordinator.registerHandoff,
        getTransitionOutcome: coordinator.getTransitionOutcome,
      },
    });

    const dataPromise = startTrial(
      jsPsych,
      baseTrial({ timing_continuous: true, trial_duration: 300 }),
    );
    await vi.advanceTimersByTimeAsync(21000);
    stepRaf(1700);
    stepRaf(2000);
    const data: any = await dataPromise;

    expect(data.timing_handoff_register_status).toBe("rejected:stale_at_register");
    expect(data.visual_handoff_available).toBe(false);
    expect(data.visual_handoff_consumed).toBe(false);
    expect(data.visual_handoff_lost).toBe(false);
  });

  it("H2. partial host without registerHandoff API → skipped_no_register_api, no legacy fallback", async () => {
    const coordinator = createContractCoordinator();
    coordinator.state.registrarIndex = 0;
    jsPsych = fakeJsPsych({
      getProgress: () => ({ current_trial_global: 0 }),
      timing: {
        acquireTrialOrigin: coordinator.acquireTrialOrigin,
        getTransitionOutcome: coordinator.getTransitionOutcome,
        // registerHandoff INTENTIONALLY absent
      },
    });

    const dataPromise = startTrial(
      jsPsych,
      baseTrial({ timing_continuous: true, trial_duration: 300 }),
    );
    await vi.advanceTimersByTimeAsync(21000);
    stepRaf(1700);
    stepRaf(2000);
    const data: any = await dataPromise;

    expect(data.timing_handoff_register_status).toBe("skipped_no_register_api");
    expect(data.visual_handoff_available).toBe(false);
    expect(data.visual_handoff_lost).toBe(false);
  });

  it("I. host present but no prior transition and no outcome → continuity none", async () => {
    const coordinator = createContractCoordinator();
    jsPsych = fakeJsPsych({
      getProgress: () => ({ current_trial_global: 1 }),
      timing: {
        acquireTrialOrigin: coordinator.acquireTrialOrigin,
        registerHandoff: coordinator.registerHandoff,
        getTransitionOutcome: coordinator.getTransitionOutcome,
      },
    });

    const dataPromise = startTrial(
      jsPsych,
      baseTrial({ timing_continuous: true }),
    );
    await vi.advanceTimersByTimeAsync(21000);
    stepRaf(1050);
    vi.spyOn(performance, "now").mockReturnValue(1260);
    window.dispatchEvent(keydown(1250));
    const data: any = await dataPromise;

    expect(coordinator.acquireTrialOrigin).toHaveBeenCalledTimes(1); // acquire null, no outcome
    expect(data.trial_time_origin_source).toBe("fresh_raf");
    expect(data.timing_continuity).toBe("none");
    expect(data.timing_lost_reason).toBeNull();
  });

  it("J. never_registered CREATED during acquire is consumed (no pre-seeded outcome)", async () => {
    // P0-realistic mock: no slot, no outcome before acquire; acquire itself
    // records the loss and returns null.
    const acquireOrder: string[] = [];
    const outcomes = new Map<number, any>();
    const acquireTrialOrigin = vi.fn((index: number) => {
      acquireOrder.push("acquire");
      outcomes.set(index, {
        fromTrialIndex: index - 1,
        toTrialIndex: index,
        status: "lost",
        reason: "never_registered",
      });
      return null;
    });
    const getTransitionOutcome = vi.fn((index: number) => {
      acquireOrder.push("outcome");
      return outcomes.get(index) ?? null;
    });
    jsPsych = fakeJsPsych({
      getProgress: () => ({ current_trial_global: 1 }),
      timing: { acquireTrialOrigin, registerHandoff: vi.fn(() => ({ status: "pending" })), getTransitionOutcome },
    });

    const dataPromise = startTrial(
      jsPsych,
      baseTrial({ timing_continuous: true }),
    );
    await vi.advanceTimersByTimeAsync(21000);
    stepRaf(1050);
    vi.spyOn(performance, "now").mockReturnValue(1260);
    window.dispatchEvent(keydown(1250));
    const data: any = await dataPromise;

    // acquire ran BEFORE the outcome lookup that matters.
    expect(acquireOrder.indexOf("acquire")).toBeGreaterThanOrEqual(0);
    expect(acquireOrder[acquireOrder.length - 1]).toBe("outcome");
    expect(data.trial_time_origin_source).toBe("fresh_raf");
    expect(data.timing_continuity).toBe("lost");
    expect(data.timing_lost_reason).toBe("never_registered");
  });

  it("K. expired CREATED during acquire is consumed (slot ages out inside acquire)", async () => {
    const outcomes = new Map<number, any>();
    const acquireTrialOrigin = vi.fn((index: number) => {
      // P0-realistic: a slot exists but ages beyond maxAge during acquire,
      // which records the loss and returns null.
      outcomes.set(index, {
        fromTrialIndex: index - 1,
        toTrialIndex: index,
        status: "lost",
        reason: "expired",
      });
      return null;
    });
    const getTransitionOutcome = vi.fn((index: number) => outcomes.get(index) ?? null);
    jsPsych = fakeJsPsych({
      getProgress: () => ({ current_trial_global: 1 }),
      timing: { acquireTrialOrigin, registerHandoff: vi.fn(() => ({ status: "pending" })), getTransitionOutcome },
    });

    const dataPromise = startTrial(
      jsPsych,
      baseTrial({ timing_continuous: true }),
    );
    await vi.advanceTimersByTimeAsync(21000);
    stepRaf(1050);
    vi.spyOn(performance, "now").mockReturnValue(1260);
    window.dispatchEvent(keydown(1250));
    const data: any = await dataPromise;

    expect(data.trial_time_origin_source).toBe("fresh_raf");
    expect(data.timing_continuity).toBe("lost");
    expect(data.timing_lost_reason).toBe("expired");
  });
});
