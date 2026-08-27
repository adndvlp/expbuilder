import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import DynamicPlugin from "../index";
import { preloadAudioBuffer } from "../utils/AudioTiming";
import { preloadBitmap } from "../utils/PrecisionTiming";
import { createFakeAudioContext } from "./helpers/fakeAudioContext";
import { Timeline } from "@expbuilder-jspsych/packages/jspsych/src/timeline/Timeline";
import { TrialFinalizationQueue } from "@expbuilder-jspsych/packages/jspsych/src/timeline/TrialFinalizationQueue";
import { createFrameEngine } from "@expbuilder-jspsych/packages/jspsych/src/timeline/FrameEngine";
import { createTimingCoordinator } from "@expbuilder-jspsych/packages/jspsych/src/timeline/TimingCoordinator";
import { PromiseWrapper } from "@expbuilder-jspsych/packages/jspsych/src/timeline/util";

type GpuCounters = {
  createTexture: number;
  texImage2D: number;
  deleteTexture: number;
  responseWindowGpuCalls: number;
};

function createInstrumentedGl(
  counters: GpuCounters,
  isResponseSensitive: () => boolean,
) {
  const record = (key: "createTexture" | "texImage2D" | "deleteTexture") => {
    counters[key] += 1;
    if (isResponseSensitive()) counters.responseWindowGpuCalls += 1;
  };
  return {
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
    createTexture: () => {
      record("createTexture");
      return {};
    },
    deleteTexture: () => record("deleteTexture"),
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
    texImage2D: () => record("texImage2D"),
    pixelStorei: () => {},
    activeTexture: () => {},
    enableVertexAttribArray: () => {},
    vertexAttribPointer: () => {},
    drawArrays: () => {},
    getExtension: () => null,
  } as any;
}

function realLeaf(imageUrl: string, audioUrl: string | null) {
  return {
    components: [
      {
        type: "ImageComponent",
        name: "real-image",
        stimulus: imageUrl,
        stimulus_onset: null,
        stimulus_duration: null,
        coordinates: { x: 0, y: 0 },
        zIndex: 0,
      },
      ...(audioUrl
        ? [
            {
              type: "AudioComponent",
              name: "real-audio",
              stimulus: audioUrl,
              stimulus_onset: null,
              stimulus_duration: null,
              autoplay: true,
              show_controls: false,
            },
          ]
        : []),
    ],
    response_components: [
      {
        type: "KeyboardResponseComponent",
        name: "real-keyboard",
        choices: "ALL_KEYS",
      },
    ],
    trial_duration: 50,
    response_ends_trial: false,
    response_timing_enabled: true,
    preload_assets: true,
    prefetch_next_trials: false,
    dynamic_csv_diagnostics: "off",
    diagnostics_level: "off",
    render_backend: "webgl-strict",
    record_gpu_timing: false,
    __canvasStyles: { width: 1024, height: 768 },
  };
}

const macrotick = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("real-component precision runtime stack", () => {
  let counters: GpuCounters;
  let engineRef: ReturnType<typeof createFrameEngine> | null;
  let originalGetContext: typeof HTMLCanvasElement.prototype.getContext;

  beforeEach(() => {
    counters = {
      createTexture: 0,
      texImage2D: 0,
      deleteTexture: 0,
      responseWindowGpuCalls: 0,
    };
    engineRef = null;
    const gl = createInstrumentedGl(
      counters,
      () => engineRef?.getDiagnostics().response_sensitive === true,
    );
    const context2d: any = {
      fillStyle: "",
      clearRect: () => {},
      fillRect: () => {},
      getImageData: () => ({
        data: new Uint8ClampedArray([0, 0, 0, 0]),
      }),
    };
    originalGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type: string) {
      return type === "2d" ? context2d : gl;
    } as any;
    class ReadyImage {
      complete = true;
      naturalWidth = 64;
      naturalHeight = 32;
      width = 64;
      height = 32;
      onload: null | (() => void) = null;
      onerror: null | (() => void) = null;
      decode = () => Promise.resolve();
      set src(_value: string) {
        queueMicrotask(() => this.onload?.());
      }
    }
    vi.stubGlobal("Image", ReadyImage as any);
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn(async () => ({ width: 64, height: 32 })),
    );
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
      }),
    );
  });

  afterEach(() => {
    engineRef?.reset();
    HTMLCanvasElement.prototype.getContext = originalGetContext;
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    document.body.innerHTML = "";
  });

  it.each([
    { name: "Image+Keyboard", withAudio: false },
    { name: "Image+Audio+Keyboard", withAudio: true },
  ])("keeps 1,000 prepared $name trials atomic with real components", async ({
    withAudio,
  }) => {
    const imageUrl = `real-stack-${withAudio ? "audio" : "image"}.png`;
    const audioUrl = withAudio ? "real-stack-tone.wav" : null;
    const audioContext = createFakeAudioContext({
      currentTime: 0.5,
      baseLatency: 0,
      outputTimestamp: { contextTime: 0.5, performanceTime: 0 },
    });
    await preloadBitmap(imageUrl, 1_000);
    if (audioUrl) await preloadAudioBuffer(audioContext as any, audioUrl, 1_000);

    const display = document.createElement("div");
    document.body.appendChild(display);
    let rafCallback: FrameRequestCallback | null = null;
    const postedTasks: Array<() => void> = [];
    let now = 0;
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
      warmup: false,
    });
    engineRef = engine;
    vi.spyOn(performance, "now").mockImplementation(() => now);
    const timingCoordinator = createTimingCoordinator({ frameEngine: engine });
    const finalizationQueue = new TrialFinalizationQueue();
    const getAudioPlayer = vi.fn(() => {
      throw new Error("precision no-controls audio must not request a player");
    });
    let currentTrialGlobal = 0;
    const jsPsych = {
      precisionTiming: engine,
      timing: timingCoordinator,
      pluginAPI: {
        preloadAudio: (_files: string[], done: () => void) => done(),
        preloadVideo: (_files: string[], done: () => void) => done(),
        audioContext: () => audioContext,
        getAudioPlayer,
      },
      timeline: { description: [] },
      getProgress: () => ({ current_trial_global: currentTrialGlobal }),
      getDisplayContainerElement: () => document.body,
      getDisplayElement: () => display,
      getInitSettings: () => ({}),
    };
    const results: any[] = [];
    const drain = () => {
      let guard = 0;
      while (postedTasks.length > 0) {
        postedTasks.shift()!();
        if (++guard > 256) break;
      }
    };
    const dependencies: any = {
      onTrialStart: (trial: any) => {
        currentTrialGlobal = trial.index ?? currentTrialGlobal;
      },
      onTrialResultAvailable: (trial: any) => results.push(trial.getResult()),
      onTrialFinished: () => {},
      runOnStartExtensionCallbacks: () => {},
      runOnLoadExtensionCallbacks: () => {},
      runOnFinishExtensionCallbacks: async () => ({}),
      getSimulationMode: () => undefined,
      getGlobalSimulationOptions: () => ({}),
      instantiatePlugin: (pluginClass: any) => new pluginClass(jsPsych),
      getDisplayElement: () => display,
      getDefaultIti: () => 0,
      finishTrialPromise: new PromiseWrapper(),
      timingCoordinator,
      enqueueTrialFinalization: (entry: any) => finalizationQueue.enqueue(entry),
      flushTrialFinalizations: async (beforeTrialIndex?: number) => {
        let guard = 0;
        while (guard < 2_048) {
          engine.flushSafeTasks();
          await finalizationQueue.flush(beforeTrialIndex);
          const head = finalizationQueue.peek();
          if (
            beforeTrialIndex === undefined
              ? finalizationQueue.pendingCount === 0
              : !head || (head.trial as any).index >= beforeTrialIndex
          ) {
            return;
          }
          guard += 1;
        }
      },
      clearAllTimeouts: () => {},
    };
    const state = { ...realLeaf(imageUrl, audioUrl), type: DynamicPlugin };
    const timeline = new Timeline(dependencies, {
      timeline: [{ timeline: [state] }],
      timeline_variables: Array.from({ length: 1_000 }, (_, index) => ({ index })),
      precision_presentation_plan: {
        static: true,
        states: [state],
        lookahead: 3,
      },
    });

    const runPromise = timeline.run();
    for (let index = 0; index < 20; index++) {
      drain();
      await macrotick();
    }
    const period = 1000 / 60;
    let opportunities = 0;
    while (opportunities < 30_000) {
      now = opportunities * period;
      const callback = rafCallback;
      rafCallback = null;
      callback?.(now);
      opportunities += 1;
      drain();
      await macrotick();
      if (
        engine.getTransitions().length >= 1_000 &&
        finalizationQueue.pendingCount === 0
      ) {
        break;
      }
    }

    expect(engine.getTransitions()).toHaveLength(1_000);
    await runPromise;
    engine.flushSafeTasks();
    await finalizationQueue.flush();
    expect(results).toHaveLength(1_000);
    const internalNonAtomic = engine
      .getTransitions()
      .slice(0, -1)
      .filter((transition: any) => transition.atomic_transition_used !== true);
    expect(internalNonAtomic).toHaveLength(0);
    expect(
      engine
        .getTransitions()
        .some((transition: any) => transition.incoming_not_ready === true),
    ).toBe(false);
    expect(counters.responseWindowGpuCalls).toBe(0);
    expect(
      results.every(
        (row) =>
          row.runtime_materialization_dom_mutations === 0 &&
          row.runtime_materialization_layout_reads === 0 &&
          row.runtime_materialization_gpu_calls === 0,
      ),
    ).toBe(true);
    expect(getAudioPlayer).not.toHaveBeenCalled();
    if (withAudio) {
      expect(audioContext.createdSources.length).toBeGreaterThanOrEqual(1_000);
    }
  }, 120_000);
});
