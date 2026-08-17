import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  installFakeRaf,
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

function fakeJsPsych() {
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

describe("DynamicPlugin integration scenarios", () => {
  let restoreWebGL: (() => void) | null = null;
  let jsPsych: any;

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    installFakeRaf();
    restoreWebGL = installFakeWebGL();
    installFakeImageDimensions();
    vi.stubGlobal("ResizeObserver", FakeResizeObserver);
    jsPsych = fakeJsPsych();
    // Fresh plugin module per scenario: the persistent visual handoff
    // state machine is module-level and must not leak between scenarios.
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

  it("Scenario A: fresh rAF origin, WebGL commit frame, event timestamp RT", async () => {
    const dataPromise = startTrial(jsPsych, baseTrial());
    await vi.advanceTimersByTimeAsync(21000);
    stepRaf(1000);
    vi.spyOn(performance, "now").mockReturnValue(1260);
    window.dispatchEvent(keydown(1250));
    const data: any = await dataPromise;

    expect(data.timing_schema_version).toBe(2);
    expect(data.trial_time_origin).toBe(1000);
    expect(data.trial_time_origin_source).toBe("fresh_raf");
    expect(data.trial_onset_time).toBe(1000);
    expect(data.rt_raw).toBe(250);
    expect(data.rt).toBe(250);
    const stimulusRecords = JSON.parse(data.stimulus_timing);
    expect(stimulusRecords[0].frame_onset_abs).toBe(1000);
    expect(stimulusRecords[0].physical_onset_abs).toBeNull();
    expect(data.trial_duration_policy).toBeNull();
    expect(data.stimulus_onset_policy).toBe("nearest");
  });

  it("Scenario B: delayed response gate keeps rt_raw and adds rt_from_allowed_onset", async () => {
    const dataPromise = startTrial(
      jsPsych,
      baseTrial({
        response_allowed_from: { from: "trial_onset", at_ms: 300 },
      }),
    );
    await vi.advanceTimersByTimeAsync(21000);
    stepRaf(1000);
    vi.spyOn(performance, "now").mockReturnValue(1460);
    window.dispatchEvent(keydown(1450));
    const data: any = await dataPromise;

    expect(data.trial_time_origin).toBe(1000);
    expect(data.rt_raw).toBe(450);
    expect(data.rt).toBe(450);
    expect(data.rt_from_allowed_onset).toBe(150);
    expect(data.response_allowed_from_abs).toBe(1300);
  });

  it("Scenario C: not-before trial duration never ends early", async () => {
    const dataPromise = startTrial(
      jsPsych,
      baseTrial({ trial_duration: 500 }),
    );
    await vi.advanceTimersByTimeAsync(21000);
    stepRaf(1000);
    stepRaf(1488);
    stepRaf(1505);
    const data: any = await dataPromise;

    expect(data.trial_time_origin).toBe(1000);
    expect(data.trial_duration_policy).toBe("not_before");
    expect(data.trial_offset_time).toBe(1505);
    expect(data.actual_trial_duration).toBe(505);
  });

  it("handoff state is resolved by the next trial and cannot leak across a non-boundary trial", async () => {
    // Trial A: frame-boundary visual trial that creates a handoff.
    const trialA = startTrial(jsPsych, baseTrial({ trial_duration: 300 }));
    await vi.advanceTimersByTimeAsync(21000);
    stepRaf(1700);
    stepRaf(2000);
    const dataA: any = await trialA;
    expect(dataA.visual_frame_boundary_handoff).toBe(true);

    // Trial B: non-frame-boundary trial. It must consume/resolve the
    // handoff state created by A. Depending on microtask/timer ordering the
    // loss is recorded as the surface removal or the macrotask expiry; both
    // prove the state was resolved here, not leaked.
    const trialB = startTrial(jsPsych, baseTrial());
    await vi.advanceTimersByTimeAsync(21000);
    stepRaf(2100);
    vi.spyOn(performance, "now").mockReturnValue(2210);
    window.dispatchEvent(keydown(2200));
    const dataB: any = await trialB;
    expect(dataB.visual_frame_boundary_handoff).toBe(false);
    expect(dataB.visual_handoff_lost).toBe(true);
    expect(["surface_removed", "expired_before_consume"]).toContain(
      dataB.visual_handoff_lost_reason,
    );
    expect(dataB.visual_handoff_from_trial_sequence).toBeNull();

    // Trial C: frame-boundary trial. It must NOT observe A's state: the
    // handoff it sees was never set (not_available), not A's lost handoff.
    const trialC = startTrial(jsPsych, baseTrial({ trial_duration: 300 }));
    await vi.advanceTimersByTimeAsync(21000);
    stepRaf(2400);
    stepRaf(2700);
    const dataC: any = await trialC;
    expect(dataC.visual_handoff_available).toBe(false);
    expect(dataC.visual_handoff_lost_reason).toBe("not_available");
    expect(dataC.visual_handoff_from_trial_sequence).toBeNull();
    expect(dataC.visual_handoff_consumed).toBe(false);
    expect(dataC.trial_time_origin).toBe(2400);
    expect(dataC.trial_time_origin_source).toBe("fresh_raf");
  });

  it("Scenario D: lost handoff falls back to a fresh rAF origin", async () => {
    const frameBoundaryTrial = baseTrial({ trial_duration: 300 });
    const first = startTrial(jsPsych, frameBoundaryTrial);
    await vi.advanceTimersByTimeAsync(21000);
    stepRaf(1700);
    stepRaf(2000);
    const data1: any = await first;
    expect(data1.visual_frame_boundary_handoff).toBe(true);

    // The handoff expires on the next macrotask boundary.
    vi.advanceTimersByTime(0);

    const second = startTrial(jsPsych, baseTrial({ trial_duration: 300 }));
    await vi.advanceTimersByTimeAsync(21000);
    stepRaf(2400);
    stepRaf(2700);
    const data2: any = await second;

    expect(data2.visual_handoff_lost).toBe(true);
    expect(data2.visual_handoff_lost_reason).toBe("expired_before_consume");
    expect(data2.visual_handoff_available).toBe(false);
    expect(data2.trial_time_origin).toBe(2400);
    expect(data2.trial_time_origin_source).toBe("fresh_raf");
  });

  it("Scenario E: button pointerdown then click yields one response and one finish", async () => {
    const dataPromise = startTrial(
      jsPsych,
      baseTrial({
        components: [],
        response_components: [
          {
            type: "ButtonResponseComponent",
            name: "ButtonResponseComponent_1",
            choices: ["A"],
            button_html: () => `<button>A</button>`,
            enable_button_after: 0,
            zIndex: 0,
          },
        ],
      }),
    );
    await vi.advanceTimersByTimeAsync(21000);
    stepRaf(1000);
    vi.spyOn(performance, "now").mockReturnValue(1260);
    // Grab the button reference before the pointerdown dispatch: a
    // successful manager response ends the trial synchronously and clears
    // the display element.
    const button = document.body.querySelector(
      "#jspsych-button-response-component-btngroup button",
    ) as HTMLButtonElement;
    window.dispatchEvent(
      (() => {
        const event = new PointerEvent("pointerdown", {
          clientX: 0,
          clientY: 0,
          pointerType: "mouse",
        });
        Object.defineProperty(event, "timeStamp", { value: 1250 });
        return event;
      })(),
    );
    const click = new MouseEvent("click");
    Object.defineProperty(click, "timeStamp", { value: 1260 });
    button.dispatchEvent(click);
    const data: any = await dataPromise;

    expect(data.response_event_type).toBe("pointerdown");
    expect(data.rt_raw).toBe(250);
    expect(data.rt).toBe(250);
    expect(data.ButtonResponseComponent_1_response).toBe("A");
    expect(data.ButtonResponseComponent_1_response_event_type).toBe(
      "pointerdown",
    );
  });
});
