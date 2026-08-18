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

describe("DynamicPlugin hard teardown on external core cleanup (P2 final)", () => {
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

  it("A. pending response end + external abort before the next rAF → no handoff, scheduler stopped", async () => {
    const registerHandoff = vi.fn(() => ({ status: "pending" as const }));
    jsPsych = fakeJsPsych({
      timing: {
        acquireTrialOrigin: vi.fn(() => null),
        registerHandoff,
        getTransitionOutcome: vi.fn(() => null),
      },
    });

    const { promise, display } = startTrialWithDisplay(
      jsPsych,
      baseTrial({ timing_continuous: true }),
    );
    await vi.advanceTimersByTimeAsync(21000);
    stepRaf(1700); // fresh origin + commit
    stepRaf(1984); // commit
    vi.spyOn(performance, "now").mockReturnValue(1991);
    window.dispatchEvent(keydown(1991)); // accepted → pending post-commit end

    display.innerHTML = ""; // core cleanupTrial
    await vi.advanceTimersByTimeAsync(0); // flush MutationObserver

    stepRaf(2000); // stale frame: must NOT finalize
    await vi.advanceTimersByTimeAsync(0);

    expect(registerHandoff).not.toHaveBeenCalled();
    expect(pendingRafCount()).toBe(0);
    // The plugin promise must stay pending (the core settles the trial);
    // nothing to await here — just ensure no stray work was scheduled.
    expect(promise).toBeDefined();
  });

  it("B. trial_duration future + abort before the due frame → scheduler stopped, no finalize", async () => {
    const registerHandoff = vi.fn(() => ({ status: "pending" as const }));
    jsPsych = fakeJsPsych({
      timing: {
        acquireTrialOrigin: vi.fn(() => null),
        registerHandoff,
        getTransitionOutcome: vi.fn(() => null),
      },
    });

    const { display } = startTrialWithDisplay(
      jsPsych,
      baseTrial({ timing_continuous: true, trial_duration: 300 }),
    );
    await vi.advanceTimersByTimeAsync(21000);
    stepRaf(1700); // origin + commit

    display.innerHTML = ""; // abort BEFORE the due frame
    await vi.advanceTimersByTimeAsync(0);

    stepRaf(2000); // due frame arrives after abort
    await vi.advanceTimersByTimeAsync(0);

    expect(registerHandoff).not.toHaveBeenCalled();
    expect(pendingRafCount()).toBe(0);
  });

  it("C. legacy host-absent abort leaves no stale persistent state", async () => {
    const { display } = startTrialWithDisplay(
      jsPsych, // no jsPsych.timing → legacy path
      baseTrial({ trial_duration: 300 }),
    );
    await vi.advanceTimersByTimeAsync(21000);
    stepRaf(1700);
    stepRaf(1716);

    // Frame-boundary trial: the persistent visual surface exists.
    expect(document.getElementById("jspsych-dynamic-persistent-visual")).not.toBeNull();

    display.innerHTML = ""; // external abort
    await vi.advanceTimersByTimeAsync(0);

    // The aborted trial's persistent surface must not survive.
    expect(document.getElementById("jspsych-dynamic-persistent-visual")).toBeNull();
    expect(document.getElementById("jspsych-dynamic-visual-bridge")).toBeNull();
    expect(document.getElementById("jspsych-dynamic-plugin-container")).toBeNull();
  });

  it("E. normal end is not interpreted as external teardown", async () => {
    const registerHandoff = vi.fn(() => ({ status: "pending" as const }));
    jsPsych = fakeJsPsych({
      timing: {
        acquireTrialOrigin: vi.fn(() => null),
        registerHandoff,
        getTransitionOutcome: vi.fn(() => null),
      },
    });

    const { promise } = startTrialWithDisplay(
      jsPsych,
      baseTrial({ timing_continuous: true, trial_duration: 300 }),
    );
    await vi.advanceTimersByTimeAsync(21000);
    stepRaf(1700);
    stepRaf(1716);
    stepRaf(2000); // due → commit → post-commit finalize

    const data: any = await promise;
    expect(data.trial_end_alignment).toBe("post_commit");
    expect(data.trial_end_commit_time).toBe(2000);
    expect(registerHandoff).toHaveBeenCalledTimes(1);
    expect(registerHandoff.mock.calls[0][0]).toBe(2000);
  });
});
