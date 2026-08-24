import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  installFakeRaf,
  pendingRafCount,
  restoreFakeRaf,
  stepRaf,
} from "./helpers/fakeRaf";

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

describe("P4 fast activation path", () => {
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

  const hostTiming = (overrides: Record<string, any> = {}) => ({
    acquireTrialOrigin: vi.fn(() => null),
    registerHandoff: vi.fn(() => ({ status: "pending" as const })),
    getTransitionOutcome: vi.fn(() => null),
    ...overrides,
  });

  it("1. warm P3 cache → B activation takes the fast path with ZERO new image resources", async () => {
    const timing = hostTiming();
    const shared = fakeJsPsych({ timing });

    // A warms B's image via the P3 manifest.
    const { promise: promiseA } = startTrialWithDisplay(
      shared,
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

    // B reuses the cached bitmap synchronously.
    const { promise: promiseB } = startTrialWithDisplay(
      shared,
      baseTrial({
        __stableTrialId: "trial-b",
        components: [
          { ...IMAGE_COMPONENT, stimulus: "https://example.com/b.png" },
        ],
        trial_duration: 300,
      }),
    );
    await vi.advanceTimersByTimeAsync(21000);
    stepRaf(2300);
    stepRaf(2316);
    stepRaf(2600);
    const dataB: any = await promiseB;

    expect(dataB.timing_activation_path).toBe("prepared_fast");
    expect(dataB.timing_prepared_resources_used).toBe(1);
    expect(imagesCreated.filter((src) => src.includes("b.png"))).toHaveLength(
      0,
    );
    expect(dataB.timing_prepare_status).toBe("reused");
  });

  it("2. cold cache (no manifest) → normal activation path, fallback intact", async () => {
    const timing = hostTiming();
    jsPsych = fakeJsPsych({ timing });

    const { promise: promiseB } = startTrialWithDisplay(
      jsPsych,
      baseTrial({ trial_duration: 300 }),
    );
    await vi.advanceTimersByTimeAsync(21000);
    stepRaf(1700);
    stepRaf(1716);
    stepRaf(2000);
    const dataB: any = await promiseB;

    expect(dataB.timing_activation_path).toBe("normal");
    // The fallback path requested the image resource during activation.
    expect(
      imagesCreated.filter((src) => src.includes("image.png")).length,
    ).toBeGreaterThanOrEqual(1);
  });

  it("3. fast preparation never turns a retired host timestamp into a frame origin", async () => {
    const registerHandoff = vi.fn(() => ({ status: "pending" as const }));
    const outcomes = new Map<number, any>();
    outcomes.set(1, {
      fromTrialIndex: 0,
      toTrialIndex: 1,
      status: "acquired",
      reason: null,
    });
    let slot: { timestamp: number; from: number } | null = null;
    const timing = hostTiming({
      registerHandoff,
      getTransitionOutcome: vi.fn(
        (index: number) => outcomes.get(index) ?? null,
      ),
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
    const shared = fakeJsPsych({
      timing,
      getProgress: () => ({ current_trial_global: currentIndex }),
    });

    const { promise: promiseA } = startTrialWithDisplay(
      shared,
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
    stepRaf(1700);
    await vi.advanceTimersByTimeAsync(21000);
    stepRaf(1716);
    stepRaf(2000);
    await promiseA;
    expect(registerHandoff).toHaveBeenCalledWith(2000, expect.anything());
    slot = { timestamp: 2000, from: 0 };

    currentIndex = 1;
    const { promise: promiseB } = startTrialWithDisplay(
      shared,
      baseTrial({
        __stableTrialId: "trial-b",
        timing_continuous: true,
        components: [
          { ...IMAGE_COMPONENT, stimulus: "https://example.com/b.png" },
        ],
      }),
    );
    await vi.advanceTimersByTimeAsync(21000);
    stepRaf(2100);
    vi.spyOn(performance, "now").mockReturnValue(2266);
    window.dispatchEvent(keydown(2250)); // E
    stepRaf(2266); // commit → post-commit finalize
    const dataB: any = await promiseB;

    expect(dataB.trial_time_origin).toBe(2100);
    expect(dataB.trial_time_origin_source).toBe("fresh_raf");
    expect(dataB.rt).toBe(150);
    expect(dataB.timing_continuity).toBe("logical_only");
    expect(dataB.timing_activation_path).toBe("prepared_fast");
  });

  it("4. fast path creates NO extra rAF and no manual commit", async () => {
    const timing = hostTiming();
    const shared = fakeJsPsych({ timing });

    const { promise: promiseA } = startTrialWithDisplay(
      shared,
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

    const { promise: promiseB } = startTrialWithDisplay(
      shared,
      baseTrial({
        __stableTrialId: "trial-b",
        components: [
          { ...IMAGE_COMPONENT, stimulus: "https://example.com/b.png" },
        ],
        trial_duration: 300,
      }),
    );
    await vi.advanceTimersByTimeAsync(21000);

    // Only the scheduler's own frame is queued (no P4-driven rAF).
    expect(pendingRafCount()).toBe(1);

    stepRaf(2300);
    stepRaf(2316);
    stepRaf(2600);
    const dataB: any = await promiseB;
    expect(dataB.timing_activation_path).toBe("prepared_fast");
  });

  it("5. response immediately after first commit is captured with correct RT", async () => {
    const timing = hostTiming();
    const shared = fakeJsPsych({ timing });

    const { promise: promiseA } = startTrialWithDisplay(
      shared,
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

    const { promise: promiseB } = startTrialWithDisplay(
      shared,
      baseTrial({
        __stableTrialId: "trial-b",
        components: [
          { ...IMAGE_COMPONENT, stimulus: "https://example.com/b.png" },
        ],
      }),
    );
    await vi.advanceTimersByTimeAsync(21000);
    stepRaf(2300); // first commit of B (fresh_raf origin)
    // Response right after the first commit:
    vi.spyOn(performance, "now").mockReturnValue(2350);
    window.dispatchEvent(keydown(2340));
    stepRaf(2352);
    const dataB: any = await promiseB;

    expect(dataB.rt).toBe(40); // 2340 - origin 2300
    expect(dataB.trial_time_origin).toBe(2300);
  });

  it("6. repeated fast path A→B→C keeps working", async () => {
    const timing = hostTiming();
    const shared = fakeJsPsych({ timing });

    const runTrial = async (
      prepare: any,
      stableId: string,
      stimulus: string,
      frames: number[],
    ) => {
      const { promise } = startTrialWithDisplay(
        shared,
        baseTrial({
          __stableTrialId: stableId,
          ...(prepare ? { prepare_next_manifest: prepare } : {}),
          components: [{ ...IMAGE_COMPONENT, stimulus }],
          trial_duration: 300,
        }),
      );
      await vi.advanceTimersByTimeAsync(21000);
      if (prepare) await vi.advanceTimersByTimeAsync(21000);
      for (const frame of frames) stepRaf(frame);
      return promise;
    };

    await runTrial(
      { stableTrialId: "tb", images: ["https://example.com/b.png"] },
      "ta",
      "https://example.com/a.png",
      [1700, 1716, 2000],
    );
    const dataB: any = await runTrial(
      { stableTrialId: "tc", images: ["https://example.com/c.png"] },
      "tb",
      "https://example.com/b.png",
      [2300, 2316, 2600],
    );
    const dataC: any = await runTrial(
      null,
      "tc",
      "https://example.com/c.png",
      [2900, 2916, 3200],
    );

    expect(dataB.timing_activation_path).toBe("prepared_fast");
    expect(dataC.timing_activation_path).toBe("prepared_fast");
  });

  it("7. legacy host-absent + warm cache also takes the fast activation path", async () => {
    // jsPsych WITHOUT timing: legacy origin path, but activation preload
    // short-circuit still applies to cached resources.
    const shared = fakeJsPsych(); // no timing

    // A warms the cache and ends by RESPONSE (non-boundary → no legacy
    // visual handoff state), leaving a warm bitmap for B.
    const { promise: promiseA } = startTrialWithDisplay(
      shared,
      baseTrial({
        // Explicitly partial visual window: this remains a legacy
        // non-boundary response trial even though whole-window keyboard
        // trials are now eligible for the persistent frame engine.
        components: [{ ...IMAGE_COMPONENT, stimulus_duration: 100 }],
        prepare_next_manifest: {
          stableTrialId: "trial-b",
          images: ["https://example.com/b.png"],
        },
      }),
    );
    await vi.advanceTimersByTimeAsync(21000);
    stepRaf(1700);
    await vi.advanceTimersByTimeAsync(21000);
    vi.spyOn(performance, "now").mockReturnValue(1710);
    window.dispatchEvent(keydown(1705));
    stepRaf(1712);
    await promiseA;

    const { promise: promiseB } = startTrialWithDisplay(
      shared,
      baseTrial({
        __stableTrialId: "trial-b",
        components: [
          { ...IMAGE_COMPONENT, stimulus: "https://example.com/b.png" },
        ],
        trial_duration: 300,
      }),
    );
    await vi.advanceTimersByTimeAsync(21000);
    stepRaf(2300);
    stepRaf(2316);
    stepRaf(2600);
    const dataB: any = await promiseB;

    expect(dataB.timing_activation_path).toBe("prepared_fast");
    expect(dataB.trial_time_origin_source).toBe("fresh_raf");
  });

  it("8. cached-but-not-ready image (timeout resolution, zero dimensions) → normal path + recovery", async () => {
    // Simulate an image whose cache entry resolved via the preload timeout
    // while the element still has zero intrinsic dimensions.
    let naturalWidthValue = 0;
    let naturalHeightValue = 0;
    Object.defineProperty(HTMLImageElement.prototype, "naturalWidth", {
      get: () => naturalWidthValue,
      configurable: true,
    });
    Object.defineProperty(HTMLImageElement.prototype, "naturalHeight", {
      get: () => naturalHeightValue,
      configurable: true,
    });

    const timing = hostTiming();
    const shared = fakeJsPsych({ timing });

    // A prewarms b.png; the load times out → cache holds a NON-ready element.
    const { promise: promiseA } = startTrialWithDisplay(
      shared,
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
    await vi.advanceTimersByTimeAsync(21000); // preload timeout resolves
    stepRaf(1716);
    stepRaf(2000);
    await promiseA;

    // B starts while the cached resource is NOT ready for sync drawing.
    const { promise: promiseB } = startTrialWithDisplay(
      shared,
      baseTrial({
        __stableTrialId: "trial-b",
        timing_continuous: true,
        components: [
          { ...IMAGE_COMPONENT, stimulus: "https://example.com/b.png" },
        ],
        trial_duration: 300,
      }),
    );
    await vi.advanceTimersByTimeAsync(21000);
    stepRaf(2300); // B origin (fresh)
    await vi.advanceTimersByTimeAsync(1); // flush loader microtasks
    stepRaf(2316); // draw fails: not ready → async fallback retry armed
    await vi.advanceTimersByTimeAsync(1); // flush retry microtasks

    // The SAME cached element finally loads (dimensions become valid)…
    naturalWidthValue = 200;
    naturalHeightValue = 200;

    stepRaf(2332); // retry frame: drawable prepares and shows
    stepRaf(2600); // due → commit → finalize
    const dataB: any = await promiseB;

    expect(dataB.timing_activation_path).toBe("normal");
    // Recovery: the stimulus was eventually prepared and its onset marked.
    const stimulusRecords = JSON.parse(dataB.stimulus_timing);
    const imageRecord = stimulusRecords.find(
      (record: any) =>
        record.name === "ImageComponent_1" || record.component_id,
    );
    expect(imageRecord).toBeDefined();
    expect(imageRecord.frame_onset).not.toBeNull();
  });
});
