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

function fakeJsPsych(overrides: Record<string, any> = {}) {
  return {
    pluginAPI: {
      preloadAudio: (_files: string[], complete: () => void) => complete(),
      preloadVideo: (_files: string[], complete: () => void) => complete(),
      getVideoBuffer: () => undefined,
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

function startTrialWithDisplay(jsPsych: any, config: Record<string, any>) {
  const display = document.createElement("div");
  document.body.appendChild(display);
  const plugin = new DynamicPlugin(jsPsych as any);
  return { promise: plugin.trial(display, config as any), display };
}

function keydown(timeStamp: number, key = "a") {
  const event = new KeyboardEvent("keydown", { key });
  Object.defineProperty(event, "timeStamp", { value: timeStamp });
  return event;
}

describe("P3 prepared presentation (static resource prewarm)", () => {
  let restoreWebGL: (() => void) | null = null;
  let jsPsych: any;
  let imagesCreated: string[] = [];

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    installFakeRaf();
    restoreWebGL = installFakeWebGL();
    installFakeImageDimensions();
    vi.stubGlobal("ResizeObserver", FakeResizeObserver);
    jsPsych = fakeJsPsych();
    imagesCreated = [];

    // Deterministic resource counter: track every Image construction and its
    // src without changing jsdom behavior (preloads resolve via timeouts).
    const RealImage = globalThis.Image;
    const originalSrcSetter = Object.getOwnPropertyDescriptor(
      RealImage.prototype,
      "src",
    )?.set;
    const CountingImage = function (this: any, ...args: any[]) {
      const img = new (RealImage as any)(...args);
      let srcValue = "";
      Object.defineProperty(img, "src", {
        configurable: true,
        get() {
          return srcValue;
        },
        set(value: string) {
          srcValue = String(value);
          imagesCreated.push(String(value));
          if (originalSrcSetter) originalSrcSetter.call(img, value);
        },
      });
      return img;
    } as any;
    vi.stubGlobal("Image", CountingImage);

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

  const imagesFor = (urlPart: string) =>
    imagesCreated.filter((src) => src.includes(urlPart));

  const hostTiming = (overrides: Record<string, any> = {}) => ({
    acquireTrialOrigin: vi.fn(() => null),
    registerHandoff: vi.fn(() => ({ status: "pending" as const })),
    getTransitionOutcome: vi.fn(() => null),
    ...overrides,
  });

  it("1. prewarms B's static image during A — before A finalizes", async () => {
    const timing = hostTiming();
    jsPsych = fakeJsPsych({ timing });

    const { promise: promiseA } = startTrialWithDisplay(
      jsPsych,
      baseTrial({
        trial_duration: 300,
        prepare_next_manifest: {
          stableTrialId: "trial-b",
          images: ["https://example.com/b.png"],
        },
      }),
    );
    await vi.advanceTimersByTimeAsync(21000); // A preload → startPresentation
    stepRaf(1700);
    await vi.advanceTimersByTimeAsync(21000); // prepare image+bitmap timeouts

    // B's image resource was requested BEFORE A ends (prepare phase).
    expect(imagesFor("b.png").length).toBeGreaterThanOrEqual(1);

    stepRaf(1716);
    stepRaf(2000); // A due → commit → finalize
    await promiseA;
  });

  it("2. never evaluates B's parameter functions during prepare", async () => {
    const stimulusFn = vi.fn(() => "https://example.com/from-function.png");
    const timing = hostTiming();
    jsPsych = fakeJsPsych({ timing });

    const { promise: promiseA } = startTrialWithDisplay(
      jsPsych,
      baseTrial({
        trial_duration: 300,
        prepare_next_manifest: {
          stableTrialId: "trial-b",
          images: ["https://example.com/b.png"],
        },
      }),
    );
    await vi.advanceTimersByTimeAsync(21000);
    stepRaf(1700);
    await vi.advanceTimersByTimeAsync(21000);
    stepRaf(1716);
    stepRaf(2000);
    await promiseA;

    // B's real config (function-valued) was never seen or evaluated by A.
    expect(stimulusFn).not.toHaveBeenCalled();

    // B with a function-valued stimulus cannot be reused from the static
    // manifest: it must MISS and fall back to the normal path.
    const { promise: promiseB } = startTrialWithDisplay(
      jsPsych,
      baseTrial({
        components: [{ ...IMAGE_COMPONENT, stimulus: stimulusFn }],
        trial_duration: 300,
      }),
    );
    await vi.advanceTimersByTimeAsync(21000);
    stepRaf(2300);
    stepRaf(2316);
    stepRaf(2600);
    const dataB: any = await promiseB;
    expect(dataB.timing_prepare_status).toBe("miss");
    // In this harness the PLUGIN never evaluates parameter functions (that is
    // the core's job in processParameters). The guarantee tested here: the
    // prepare path and the plugin never evaluate it, and the prepared state
    // was not reused for a function-valued stimulus.
    expect(stimulusFn).not.toHaveBeenCalled();
  });

  it("3. reuses a valid prepared image at B activation (no second preload request)", async () => {
    const timing = hostTiming();
    jsPsych = fakeJsPsych({ timing });

    const { promise: promiseA } = startTrialWithDisplay(
      jsPsych,
      baseTrial({
        trial_duration: 300,
        prepare_next_manifest: {
          stableTrialId: "trial-b",
          images: ["https://example.com/b.png"],
        },
      }),
    );
    await vi.advanceTimersByTimeAsync(21000);
    stepRaf(1700);
    await vi.advanceTimersByTimeAsync(21000);
    stepRaf(1716);
    stepRaf(2000);
    await promiseA;

    imagesCreated = [];

    const { promise: promiseB } = startTrialWithDisplay(
      jsPsych,
      baseTrial({
        __stableTrialId: "trial-b",
        components: [{ ...IMAGE_COMPONENT, stimulus: "https://example.com/b.png" }],
        trial_duration: 300,
      }),
    );
    await vi.advanceTimersByTimeAsync(21000);
    stepRaf(2300);
    stepRaf(2316);
    stepRaf(2600);
    const dataB: any = await promiseB;

    expect(dataB.timing_prepare_status).toBe("reused");
    // No NEW preload request for b.png during B (reused from module cache).
    expect(imagesFor("b.png").length).toBe(0);
  });

  it("4. mismatched prepared image → miss, B loads its real image normally", async () => {
    const timing = hostTiming();
    jsPsych = fakeJsPsych({ timing });

    const { promise: promiseA } = startTrialWithDisplay(
      jsPsych,
      baseTrial({
        trial_duration: 300,
        prepare_next_manifest: {
          stableTrialId: "trial-b",
          images: ["https://example.com/x.png"],
        },
      }),
    );
    await vi.advanceTimersByTimeAsync(21000);
    stepRaf(1700);
    await vi.advanceTimersByTimeAsync(21000);
    stepRaf(1716);
    stepRaf(2000);
    await promiseA;

    const { promise: promiseB } = startTrialWithDisplay(
      jsPsych,
      baseTrial({
        __stableTrialId: "trial-b",
        components: [{ ...IMAGE_COMPONENT, stimulus: "https://example.com/y.png" }],
        trial_duration: 300,
      }),
    );
    await vi.advanceTimersByTimeAsync(21000);
    stepRaf(2300);
    stepRaf(2316);
    stepRaf(2600);
    const dataB: any = await promiseB;

    expect(dataB.timing_prepare_status).toBe("miss");
    // B requested its real image y.png during its own lifecycle.
    expect(imagesFor("y.png").length).toBeGreaterThan(0);
  });

  it("5. no visible B side effects during prepare", async () => {
    const timing = hostTiming();
    jsPsych = fakeJsPsych({ timing });

    const { promise: promiseA } = startTrialWithDisplay(
      jsPsych,
      baseTrial({
        trial_duration: 300,
        prepare_next_manifest: {
          stableTrialId: "trial-b",
          images: ["https://example.com/b.png"],
        },
      }),
    );
    await vi.advanceTimersByTimeAsync(21000);
    stepRaf(1700);
    await vi.advanceTimersByTimeAsync(21000);

    // Only A's container exists; no B container/overlay/listeners/acquire.
    expect(document.querySelectorAll("#jspsych-dynamic-plugin-container")).toHaveLength(1);
    expect(timing.acquireTrialOrigin).not.toHaveBeenCalled();

    stepRaf(1716);
    stepRaf(2000);
    await promiseA;
  });

  it("6. abort invalidates the prepared state (B reports not_attempted)", async () => {
    const timing = hostTiming();
    jsPsych = fakeJsPsych({ timing });

    const { display } = startTrialWithDisplay(
      jsPsych,
      baseTrial({
        trial_duration: 300,
        prepare_next_manifest: {
          stableTrialId: "trial-b",
          images: ["https://example.com/b.png"],
        },
      }),
    );
    await vi.advanceTimersByTimeAsync(21000);
    stepRaf(1700);
    await vi.advanceTimersByTimeAsync(21000);

    display.innerHTML = ""; // hard teardown
    await vi.advanceTimersByTimeAsync(0);

    const { promise: promiseB } = startTrialWithDisplay(
      jsPsych,
      baseTrial({
        __stableTrialId: "trial-b",
        components: [{ ...IMAGE_COMPONENT, stimulus: "https://example.com/b.png" }],
        trial_duration: 300,
      }),
    );
    await vi.advanceTimersByTimeAsync(21000);
    stepRaf(2300);
    stepRaf(2316);
    stepRaf(2600);
    const dataB: any = await promiseB;

    expect(dataB.timing_prepare_status).toBe("not_attempted");
  });

  it("7. A→B host continuity + reuse: origin T intact, prepare time never part of RT", async () => {
    const registerHandoff = vi.fn(() => ({ status: "pending" as const }));
    const outcomes = new Map<number, any>();
    outcomes.set(1, { fromTrialIndex: 0, toTrialIndex: 1, status: "acquired", reason: null });
    let slot: { timestamp: number; from: number } | null = null;
    const timing = hostTiming({
      registerHandoff,
      getTransitionOutcome: vi.fn((index: number) => outcomes.get(index) ?? null),
      acquireTrialOrigin: vi.fn((index: number) => {
        if (!slot || slot.from + 1 !== index) return null;
        const origin = {
          timestamp: slot.timestamp,
          source: "host_coordinator",
          fromTrialIndex: slot.from,
          frameIndex: null,
          acquiredAt: slot.timestamp + 1,
        };
        slot = null;
        return origin;
      }),
    });
    let currentIndex = 0;
    const sharedJsPsych = fakeJsPsych({
      timing,
      getProgress: () => ({ current_trial_global: currentIndex }),
    });

    const { promise: promiseA } = startTrialWithDisplay(
      sharedJsPsych,
      baseTrial({
        timing_continuous: true,
        trial_duration: 300,
        prepare_next_manifest: {
          stableTrialId: "trial-b",
          images: ["https://example.com/b.png"],
        },
      }),
    );
    await vi.advanceTimersByTimeAsync(21000);
    stepRaf(1700); // A origin (fresh)
    await vi.advanceTimersByTimeAsync(21000); // prepare completes during A
    stepRaf(1716);
    stepRaf(2000); // due → commit → postCommit finalize → registerHandoff(2000)
    await promiseA;
    expect(registerHandoff).toHaveBeenCalledWith(2000, expect.anything());
    slot = { timestamp: 2000, from: 0 };

    currentIndex = 1;
    const { promise: promiseB } = startTrialWithDisplay(
      sharedJsPsych,
      baseTrial({
        __stableTrialId: "trial-b",
        timing_continuous: true,
        components: [{ ...IMAGE_COMPONENT, stimulus: "https://example.com/b.png" }],
      }),
    );
    await vi.advanceTimersByTimeAsync(21000);
    vi.spyOn(performance, "now").mockReturnValue(2266);
    window.dispatchEvent(keydown(2250)); // E
    stepRaf(2266); // commit → post-commit finalize
    const dataB: any = await promiseB;

    expect(dataB.trial_time_origin).toBe(2000);
    expect(dataB.trial_time_origin_source).toBe("host_coordinator");
    expect(dataB.rt).toBe(250); // E - T, prepare time never involved
    expect(dataB.timing_prepare_status).toBe("reused");
    // Both prepare diagnostics live in the performance.now() domain and are
    // NEVER trial origins: only their internal ordering is asserted here.
    expect(typeof dataB.timing_prepare_started_at).toBe("number");
    expect(dataB.timing_prepare_started_at).toBeLessThanOrEqual(dataB.timing_prepare_ready_at);
    expect(dataB.timing_prepare_ready_at).not.toBeNull();
  });

  it("8. isolates prepared state between two concurrent jsPsych instances", async () => {
    const runPrepare = async (jsPsychInstance: any, stableId: string, imageUrl: string) => {
      const { promise } = startTrialWithDisplay(
        jsPsychInstance,
        baseTrial({
          trial_duration: 300,
          prepare_next_manifest: { stableTrialId: stableId, images: [imageUrl] },
        }),
      );
      await vi.advanceTimersByTimeAsync(21000);
      stepRaf(1700);
      await vi.advanceTimersByTimeAsync(21000);
      stepRaf(1716);
      stepRaf(2000);
      await promise;
    };

    const timing1 = hostTiming();
    const timing2 = hostTiming();
    const j1 = fakeJsPsych({ timing: timing1 });
    const j2 = fakeJsPsych({ timing: timing2 });

    await runPrepare(j1, "b1", "https://example.com/b1.png");
    await runPrepare(j2, "b2", "https://example.com/b2.png");

    const runB = async (jsPsychInstance: any, stableId: string, imageUrl: string) => {
      const { promise } = startTrialWithDisplay(
        jsPsychInstance,
        baseTrial({
          __stableTrialId: stableId,
          components: [{ ...IMAGE_COMPONENT, stimulus: imageUrl }],
          trial_duration: 300,
        }),
      );
      await vi.advanceTimersByTimeAsync(21000);
      stepRaf(2300);
      stepRaf(2316);
      stepRaf(2600);
      return promise;
    };

    const dataB1: any = await runB(j1, "b1", "https://example.com/b1.png");
    const dataB2: any = await runB(j2, "b2", "https://example.com/b2.png");

    expect(dataB1.timing_prepare_status).toBe("reused");
    expect(dataB2.timing_prepare_status).toBe("reused");
    expect(timing1.acquireTrialOrigin).not.toHaveBeenCalled();
    expect(timing2.acquireTrialOrigin).not.toHaveBeenCalled();
  });

  it("9. typed validation: video-only manifest + VideoComponent → reused", async () => {
    const timing = hostTiming();
    jsPsych = fakeJsPsych({ timing });

    const { promise: promiseA } = startTrialWithDisplay(
      jsPsych,
      baseTrial({
        trial_duration: 300,
        prepare_next_manifest: { stableTrialId: "trial-b", video: ["https://example.com/v.mp4"] },
      }),
    );
    await vi.advanceTimersByTimeAsync(21000);
    stepRaf(1700);
    await vi.advanceTimersByTimeAsync(21000);
    stepRaf(1716);
    stepRaf(2000);
    await promiseA;

    const { promise: promiseB } = startTrialWithDisplay(
      jsPsych,
      baseTrial({
        __stableTrialId: "trial-b",
        components: [
          { type: "VideoComponent", name: "VideoComponent_1", stimulus: ["https://example.com/v.mp4"], zIndex: 0, coordinates: { x: 0, y: 0 } },
        ],
        trial_duration: 300,
      }),
    );
    await vi.advanceTimersByTimeAsync(21000);
    stepRaf(2300);
    stepRaf(2316);
    stepRaf(2600);
    const dataB: any = await promiseB;

    expect(dataB.timing_prepare_status).toBe("reused");
  });

  it("10. typed validation: audio URL misplaced in manifest.images → miss", async () => {
    const timing = hostTiming();
    jsPsych = fakeJsPsych({ timing });

    const { promise: promiseA } = startTrialWithDisplay(
      jsPsych,
      baseTrial({
        trial_duration: 300,
        prepare_next_manifest: { stableTrialId: "trial-b", images: ["https://example.com/a1.mp3"] },
      }),
    );
    await vi.advanceTimersByTimeAsync(21000);
    stepRaf(1700);
    await vi.advanceTimersByTimeAsync(21000);
    stepRaf(1716);
    stepRaf(2000);
    await promiseA;

    const { promise: promiseB } = startTrialWithDisplay(
      jsPsych,
      baseTrial({
        __stableTrialId: "trial-b",
        components: [
          { type: "AudioComponent", name: "AudioComponent_1", stimulus: "https://example.com/a1.mp3", zIndex: 0 },
        ],
        trial_duration: 300,
      }),
    );
    await vi.advanceTimersByTimeAsync(21000);
    stepRaf(2300);
    stepRaf(2316);
    stepRaf(2600);
    const dataB: any = await promiseB;

    expect(dataB.timing_prepare_status).toBe("miss");
  });

  it("11. typed validation: multiple assets per type and superset manifests", async () => {
    const timing = hostTiming();
    jsPsych = fakeJsPsych({ timing });

    // Superset: manifest contains extra images not used by B.
    const { promise: promiseA } = startTrialWithDisplay(
      jsPsych,
      baseTrial({
        trial_duration: 300,
        prepare_next_manifest: {
          stableTrialId: "trial-b",
          images: ["https://example.com/i1.png", "https://example.com/i2.png", "https://example.com/unused.png"],
        },
      }),
    );
    await vi.advanceTimersByTimeAsync(21000);
    stepRaf(1700);
    await vi.advanceTimersByTimeAsync(21000);
    stepRaf(1716);
    stepRaf(2000);
    await promiseA;

    const { promise: promiseB } = startTrialWithDisplay(
      jsPsych,
      baseTrial({
        __stableTrialId: "trial-b",
        components: [
          { ...IMAGE_COMPONENT, stimulus: "https://example.com/i1.png" },
          { ...IMAGE_COMPONENT, name: "ImageComponent_2", stimulus: "https://example.com/i2.png" },
        ],
        trial_duration: 300,
      }),
    );
    await vi.advanceTimersByTimeAsync(21000);
    stepRaf(2300);
    stepRaf(2316);
    stepRaf(2600);
    const dataB: any = await promiseB;

    expect(dataB.timing_prepare_status).toBe("reused");
  });

  it("12. explicit stale async completion: late generation-1 result cannot mark generation-2 ready", async () => {
    const timing = hostTiming();
    let pendingAudioComplete: (() => void) | null = null;
    jsPsych = fakeJsPsych({
      timing,
      pluginAPI: {
        preloadAudio: (_files: string[], complete: () => void) => {
          pendingAudioComplete = complete;
        },
        preloadVideo: (_files: string[], complete: () => void) => complete(),
        audioContext: () => null,
        getAudioPlayer: () => Promise.resolve({ play: () => Promise.resolve(), pause: () => {}, stop: () => {}, ended: false, addEventListener: () => {}, removeEventListener: () => {} }),
      },
    });

    // A1: generation 1, audio preload left pending.
    const { promise: promiseA1 } = startTrialWithDisplay(
      jsPsych,
      baseTrial({
        trial_duration: 300,
        prepare_next_manifest: { stableTrialId: "stale-b", audio: ["https://example.com/a1.mp3"] },
      }),
    );
    await vi.advanceTimersByTimeAsync(21000);
    stepRaf(1700);
    await vi.advanceTimersByTimeAsync(21000);
    stepRaf(1716);
    stepRaf(2000);
    await promiseA1;
    expect(pendingAudioComplete).not.toBeNull();

    // A2: generation 2 replaces the candidate (image-based, completes).
    const { promise: promiseA2 } = startTrialWithDisplay(
      jsPsych,
      baseTrial({
        trial_duration: 300,
        prepare_next_manifest: { stableTrialId: "final-b", images: ["https://example.com/g2.png"] },
      }),
    );
    await vi.advanceTimersByTimeAsync(21000);
    stepRaf(2700);
    await vi.advanceTimersByTimeAsync(21000);
    stepRaf(2716);
    stepRaf(3000);
    await promiseA2;

    // Generation 1 completes LATE: it must be discarded, not mark gen 2.
    pendingAudioComplete!();
    await vi.advanceTimersByTimeAsync(0);

    const { promise: promiseB } = startTrialWithDisplay(
      jsPsych,
      baseTrial({
        __stableTrialId: "final-b",
        components: [{ ...IMAGE_COMPONENT, stimulus: "https://example.com/g2.png" }],
        trial_duration: 300,
      }),
    );
    await vi.advanceTimersByTimeAsync(21000);
    stepRaf(3300);
    stepRaf(3316);
    stepRaf(3600);
    const dataB: any = await promiseB;

    expect(dataB.timing_prepare_status).toBe("reused");
    expect(dataB.timing_prepare_started_at).not.toBeNull();
    expect(dataB.timing_prepare_ready_at).not.toBeNull();
  });
});
