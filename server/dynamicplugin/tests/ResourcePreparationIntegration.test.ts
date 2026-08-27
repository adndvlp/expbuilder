import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ImageComponent, {
  prepareImageTexture,
} from "../components/ImageComponent";
import TextComponent from "../components/TextComponent";
import DynamicPlugin from "../index";
import { getCanvasStage, type CanvasStage } from "../renderer/CanvasStage";
import {
  configurePreparedBitmapCache,
  preloadBitmap,
} from "../utils/PrecisionTiming";
import { createFakeAudioContext } from "./helpers/fakeAudioContext";
import { createFrameEngine } from "@expbuilder-jspsych/packages/jspsych/src/timeline/FrameEngine";
import { createTimingCoordinator } from "@expbuilder-jspsych/packages/jspsych/src/timeline/TimingCoordinator";

type Counters = {
  createTexture: number;
  texImage2D: number;
  deleteTexture: number;
  measureText: number;
  fillText: number;
  layoutReads: number;
};

const createInstrumentedContexts = (counters: Counters) => {
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
    createTexture: () => {
      counters.createTexture += 1;
      return {};
    },
    deleteTexture: () => {
      counters.deleteTexture += 1;
    },
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
    texImage2D: () => {
      counters.texImage2D += 1;
    },
    pixelStorei: () => {},
    activeTexture: () => {},
    enableVertexAttribArray: () => {},
    vertexAttribPointer: () => {},
    drawArrays: () => {},
    getExtension: () => null,
  };
  const context2d: any = {
    font: "",
    fillStyle: "",
    strokeStyle: "",
    textAlign: "center",
    textBaseline: "middle",
    lineWidth: 0,
    save: () => {},
    restore: () => {},
    beginPath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    quadraticCurveTo: () => {},
    closePath: () => {},
    fill: () => {},
    stroke: () => {},
    fillRect: () => {},
    clearRect: () => {},
    translate: () => {},
    rotate: () => {},
    setTransform: () => {},
    fillText: () => {
      counters.fillText += 1;
    },
    measureText: (text: string) => {
      counters.measureText += 1;
      return { width: text.length * 8 };
    },
    getImageData: () => ({
      data: new Uint8ClampedArray([0, 0, 0, 0]),
    }),
  };
  return { gl, context2d };
};

const timing = {
  isGlobalFrameEngine: () => true,
  registerStimulus: vi.fn(() => ({
    markOnset: vi.fn(),
    markOffset: vi.fn(),
  })),
  scheduleVisualTransition: vi.fn(() => vi.fn()),
  onStart: vi.fn(),
  scheduleAt: vi.fn(() => vi.fn()),
};

describe("real Image/Text resource preparation", () => {
  let counters: Counters;
  let originalGetContext: typeof HTMLCanvasElement.prototype.getContext;
  let originalImage: typeof Image;
  let originalCreateImageBitmap: typeof window.createImageBitmap | undefined;
  const stages: CanvasStage[] = [];

  beforeEach(() => {
    counters = {
      createTexture: 0,
      texImage2D: 0,
      deleteTexture: 0,
      measureText: 0,
      fillText: 0,
      layoutReads: 0,
    };
    const { gl, context2d } = createInstrumentedContexts(counters);
    originalGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (_type: string) {
      return _type === "2d" ? context2d : gl;
    } as any;
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
      function () {
        counters.layoutReads += 1;
        return {
          x: 0,
          y: 0,
          left: 0,
          top: 0,
          right: 1024,
          bottom: 768,
          width: 1024,
          height: 768,
          toJSON: () => ({}),
        } as DOMRect;
      },
    );
    originalImage = window.Image;
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
    originalCreateImageBitmap = window.createImageBitmap;
    window.createImageBitmap = vi.fn(async () => ({
      width: 64,
      height: 32,
    })) as any;
  });

  afterEach(() => {
    for (const stage of stages.splice(0)) stage.destroy();
    HTMLCanvasElement.prototype.getContext = originalGetContext;
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    window.Image = originalImage;
    if (originalCreateImageBitmap) {
      window.createImageBitmap = originalCreateImageBitmap;
    } else {
      delete (window as any).createImageBitmap;
    }
    document.body.innerHTML = "";
  });

  const createStage = () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const stage = getCanvasStage(container, {
      width: 1024,
      height: 768,
      backgroundColor: "transparent",
      backend: "webgl-strict",
      recordGpuTiming: false,
    });
    stages.push(stage);
    return { container, stage };
  };

  it("closes an evicted ImageBitmap when the bounded bitmap cache advances", async () => {
    const firstClose = vi.fn();
    const secondClose = vi.fn();
    let bitmapIndex = 0;
    window.createImageBitmap = vi.fn(async () => ({
      width: 64,
      height: 32,
      close: bitmapIndex++ === 0 ? firstClose : secondClose,
    })) as any;
    configurePreparedBitmapCache({
      maxEntries: 1,
      maxEstimatedBytes: 1024 * 1024,
    });

    try {
      await preloadBitmap("cache-close-first.png");
      await preloadBitmap("cache-close-second.png");
      expect(firstClose).toHaveBeenCalledTimes(1);
      expect(secondClose).not.toHaveBeenCalled();
    } finally {
      configurePreparedBitmapCache({
        maxEntries: 256,
        maxEstimatedBytes: 256 * 1024 * 1024,
      });
    }
  });

  it("keeps bitmap-hot/texture-cold image work out of a response window", async () => {
    const url = `image-texture-cold-${Date.now()}.png`;
    await preloadBitmap(url, 1000);
    const { container, stage } = createStage();
    const config = {
      type: "ImageComponent",
      name: "image",
      stimulus: url,
      __canvasStage: stage,
      __canvasStyles: { width: 1024, height: 768 },
      __renderBackend: "webgl-strict",
      __precisionGlobalPath: true,
      __materializationOnly: true,
      __timing: timing,
    };
    const component = new ImageComponent({} as any);
    const gpuBeforeResponse = counters.texImage2D;

    expect(component.getResourceReadinessState(config)).toMatchObject({
      resourceReady: true,
      gpuResourceReady: false,
    });
    expect(counters.texImage2D - gpuBeforeResponse).toBe(0);

    // GPU_PREP executes only after the scheduler declares a SAFE phase.
    expect(prepareImageTexture(stage, url)).toBe(true);
    expect(component.getResourceReadinessState(config)).toMatchObject({
      resourceReady: true,
      gpuResourceReady: true,
    });

    const gpuBeforeMaterialization = counters.texImage2D;
    const layoutBeforeMaterialization = counters.layoutReads;
    const appendSpy = vi.spyOn(Node.prototype, "appendChild");
    const appendBefore = appendSpy.mock.calls.length;
    const result = component.prepare(container, config);

    expect(result).not.toBeInstanceOf(Promise);
    expect(counters.texImage2D - gpuBeforeMaterialization).toBe(0);
    expect(counters.layoutReads - layoutBeforeMaterialization).toBe(0);
    expect(appendSpy.mock.calls.length - appendBefore).toBe(0);
    expect(component.getPrecisionReadiness().ready).toBe(true);
  });

  it("does no text measure/raster/GPU work while a cold descriptor is inspected", () => {
    const { container, stage } = createStage();
    const config = {
      type: "TextComponent",
      name: "text",
      text: "A long first line that wraps\nA second line",
      width: 35,
      font_family: "sans-serif",
      font_size: 22,
      line_height: 1.4,
      __canvasStage: stage,
      __canvasStyles: { width: 1024, height: 768 },
      __renderBackend: "webgl-strict",
      __precisionGlobalPath: true,
      __materializationOnly: true,
      __timing: timing,
    };
    const component = new TextComponent({} as any);
    const responseSnapshot = { ...counters };

    expect(component.getResourceReadinessState(config)).toMatchObject({
      resourceReady: false,
      gpuResourceReady: false,
    });
    expect(counters.measureText - responseSnapshot.measureText).toBe(0);
    expect(counters.fillText - responseSnapshot.fillText).toBe(0);
    expect(counters.texImage2D - responseSnapshot.texImage2D).toBe(0);

    TextComponent.prepareMainResource(config);
    TextComponent.prepareGpuResource(stage, config);
    const hotSnapshot = { ...counters };
    const appendSpy = vi.spyOn(Node.prototype, "appendChild");
    const appendBefore = appendSpy.mock.calls.length;
    const result = component.prepare(container, config);

    expect(result).not.toBeInstanceOf(Promise);
    expect(counters.measureText - hotSnapshot.measureText).toBe(0);
    expect(counters.fillText - hotSnapshot.fillText).toBe(0);
    expect(counters.texImage2D - hotSnapshot.texImage2D).toBe(0);
    expect(counters.layoutReads - hotSnapshot.layoutReads).toBe(0);
    expect(appendSpy.mock.calls.length - appendBefore).toBe(0);
    expect(component.getPrecisionReadiness().ready).toBe(true);
  });

  it.each([2, 3])(
    "prepares long multiline text at DPR %i before bounded materialization",
    (dpr) => {
      Object.defineProperty(window, "devicePixelRatio", {
        configurable: true,
        value: dpr,
      });
      const { container, stage } = createStage();
      const config = {
        type: "TextComponent",
        name: `multiline-dpr-${dpr}`,
        text: `${"multiline content ".repeat(30)}\n${"second paragraph ".repeat(25)}`,
        width: 42,
        font_family: "serif",
        font_size: 19,
        font_weight: "700",
        font_style: "italic",
        line_height: 1.65,
        text_align: "left",
        font_color: "#234567",
        __canvasStage: stage,
        __canvasStyles: { width: 1024, height: 768 },
        __renderBackend: "webgl-strict",
        __precisionGlobalPath: true,
        __materializationOnly: true,
        __timing: timing,
      };
      const resource = TextComponent.prepareMainResource(config);
      expect(resource.textureCanvas.width).toBe(1024 * dpr);
      expect(resource.textureCanvas.height).toBe(768 * dpr);
      TextComponent.prepareGpuResource(stage, config);
      const hotSnapshot = { ...counters };

      const component = new TextComponent({} as any);
      component.prepare(container, config);

      expect(counters.measureText - hotSnapshot.measureText).toBe(0);
      expect(counters.fillText - hotSnapshot.fillText).toBe(0);
      expect(counters.texImage2D - hotSnapshot.texImage2D).toBe(0);
      expect(counters.layoutReads - hotSnapshot.layoutReads).toBe(0);
    },
  );

  it("waits for a custom webfont before measureText/fillText rasterization", async () => {
    const originalFonts = Object.getOwnPropertyDescriptor(document, "fonts");
    let ready = false;
    const fonts = {
      check: vi.fn(() => ready),
      load: vi.fn(async () => {
        expect(counters.measureText).toBe(0);
        expect(counters.fillText).toBe(0);
        ready = true;
        return [];
      }),
    };
    Object.defineProperty(document, "fonts", {
      configurable: true,
      value: fonts,
    });
    try {
      const config = {
        text: `custom-font-${Date.now()}`,
        font_family: "ExpBuilder Test Font, sans-serif",
        font_size: 24,
        font_weight: "700",
        font_style: "italic",
        __canvasStyles: { width: 1024, height: 768 },
      };
      const fontReadiness = await TextComponent.prepareFontResource(config);
      expect(fonts.load).toHaveBeenCalledTimes(1);
      const resource = TextComponent.prepareMainResource(
        config,
        fontReadiness,
      );
      expect(counters.measureText).toBeGreaterThan(0);
      expect(counters.fillText).toBeGreaterThan(0);
      expect(resource).toMatchObject({
        fontRequested: true,
        fontReady: true,
        fontFallbackUsed: false,
      });
    } finally {
      if (originalFonts) {
        Object.defineProperty(document, "fonts", originalFonts);
      } else {
        delete (document as any).fonts;
      }
    }
  });

  it("does not rasterize or cache a custom font that never becomes ready", async () => {
    const originalFonts = Object.getOwnPropertyDescriptor(document, "fonts");
    const fonts = {
      check: vi.fn(() => false),
      load: vi.fn(async () => []),
    };
    Object.defineProperty(document, "fonts", {
      configurable: true,
      value: fonts,
    });
    try {
      const config = {
        text: `missing-font-${Date.now()}`,
        font_family: "Missing ExpBuilder Font, sans-serif",
        font_size: 20,
        __canvasStyles: { width: 1024, height: 768 },
      };
      await expect(TextComponent.prepareFontResource(config)).rejects.toThrow(
        "text_font_not_ready",
      );
      expect(() => TextComponent.prepareMainResource(config)).toThrow(
        "text_font_not_ready_before_raster",
      );
      expect(counters.measureText).toBe(0);
      expect(counters.fillText).toBe(0);
      expect(counters.texImage2D).toBe(0);
    } finally {
      if (originalFonts) {
        Object.defineProperty(document, "fonts", originalFonts);
      } else {
        delete (document as any).fonts;
      }
    }
  });

  it("materializes a prepared Image+Text+Keyboard trial with no live DOM, layout or GPU work", async () => {
    const url = `prepared-runtime-${Date.now()}.png`;
    await preloadBitmap(url, 1000);
    let responseSensitive = false;
    const cancel = () => {};
    const trialContext: any = {
      id: "prepared-real-components",
      setTrialIndex: vi.fn(),
      getOriginTime: () => null,
      getScheduledOriginTime: () => null,
      getLatestFrameTime: () => null,
      getLatestCommittedFrameTime: () => null,
      getFrameClock: () => ({ periodMs: 1000 / 60 }),
      getFrameIntervalEstimate: () => 1000 / 60,
      getFrameIndex: () => null,
      markReady: vi.fn(),
      markNotReady: vi.fn(),
      getReadinessDiagnostics: () => ({}),
      setPresentationLifecycle: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
      onStart: vi.fn(() => cancel),
      onFrame: vi.fn(() => cancel),
      onFrameCommit: vi.fn(() => cancel),
      onPostCommit: vi.fn(() => cancel),
      scheduleAt: vi.fn(() => cancel),
      scheduleVisualTransition: vi.fn(() => cancel),
      scheduleVisualTransaction: vi.fn(() => cancel),
      requestBoundary: vi.fn(() => true),
      replaceBoundary: vi.fn(() => true),
      queuePostCritical: vi.fn(() => ({ cancel })),
      setResponseSensitive: vi.fn(),
      setNextAudioDeadline: vi.fn(),
      recordCriticalDomMutation: vi.fn(),
      getCriticalDomMutationCount: () => 0,
      recordStimulusCommit: vi.fn(),
      getTransitionTelemetry: () => [],
    };
    const frameEngine: any = {
      createTrialContext: vi.fn(() => trialContext),
      onVisualCommit: vi.fn(() => cancel),
      onReset: vi.fn(() => cancel),
      canStartBackgroundWork: () => true,
      isRunning: () => true,
      queueSafeTask: vi.fn((task: () => void) => {
        task();
        return { cancel };
      }),
      queuePreparationTask: vi.fn((task: () => void) => {
        if (responseSensitive) {
          throw new Error("SAFE-only work attempted during response window");
        }
        task();
        return { cancel };
      }),
      getWorkPhase: () => "SAFE",
      getDiagnostics: () => ({ response_sensitive: responseSensitive }),
      getWarmupTelemetry: () => null,
    };
    const jsPsych: any = {
      pluginAPI: {
        audioContext: () => null,
        preloadAudio: (_files: string[], complete: () => void) => complete(),
        preloadVideo: (_files: string[], complete: () => void) => complete(),
      },
      timing: { reportPrepareCpuDuration: vi.fn() },
      getProgress: () => ({ current_trial_global: 0 }),
      getInitSettings: () => ({ case_sensitive_responses: false }),
      getDisplayContainerElement: () => document.body,
      getDisplayElement: () => document.body,
    };
    const trial: any = {
      timing_continuous: true,
      trial_duration: 50,
      response_ends_trial: true,
      preload_assets: true,
      render_backend: "webgl-strict",
      record_gpu_timing: false,
      gpu_prepare_sync: "none",
      __canvasStyles: {
        width: 1024,
        height: 768,
        backgroundColor: "transparent",
      },
      components: [
        {
          type: "ImageComponent",
          name: "image",
          stimulus: url,
          coordinates: { x: 0, y: 0 },
        },
        {
          type: "TextComponent",
          name: "text",
          text: "Prepared text",
          font_size: 20,
          coordinates: { x: 0, y: 25 },
        },
      ],
      response_components: [
        {
          type: "KeyboardResponseComponent",
          name: "keyboard",
          choices: "ALL_KEYS",
        },
      ],
    };
    const plugin = new DynamicPlugin(jsPsych);
    await plugin.prepareTrial(document.body, trial, {
      trialIndex: 1,
      frameEngine,
      timingContinuous: true,
      presentationStatic: true,
      earlyTransitionEligible: true,
      earlyTransitionRejectedReason: null,
    });
    const descriptor = plugin.getPreparedTrialDescriptor();
    expect(descriptor).toMatchObject({
      materializationSafe: true,
      resourceReady: true,
      gpuReady: true,
      requiresLiveDom: false,
    });

    responseSensitive = true;
    const snapshot = { ...counters };
    const createElementSpy = vi.spyOn(document, "createElement");
    const appendSpy = vi.spyOn(Node.prototype, "appendChild");
    const removeSpy = vi.spyOn(Element.prototype, "remove");
    const createBefore = createElementSpy.mock.calls.length;
    const appendBefore = appendSpy.mock.calls.length;
    const removeBefore = removeSpy.mock.calls.length;

    await plugin.materializePreparedTrial(descriptor!);

    expect(createElementSpy.mock.calls.length - createBefore).toBe(0);
    expect(appendSpy.mock.calls.length - appendBefore).toBe(0);
    expect(removeSpy.mock.calls.length - removeBefore).toBe(0);
    expect(counters.layoutReads - snapshot.layoutReads).toBe(0);
    expect(counters.createTexture - snapshot.createTexture).toBe(0);
    expect(counters.texImage2D - snapshot.texImage2D).toBe(0);
    expect(counters.deleteTexture - snapshot.deleteTexture).toBe(0);
    expect(counters.measureText - snapshot.measureText).toBe(0);
    expect(counters.fillText - snapshot.fillText).toBe(0);
    expect(trialContext.markReady).toHaveBeenCalledTimes(1);
    plugin.discardPreparedTrial();
  });

  it("never starts cold audio decode in a response window and marks an insufficient horizon", async () => {
    const imageUrl = `cold-audio-companion-${Date.now()}.png`;
    const audioUrl = `cold-audio-${Date.now()}.wav`;
    await preloadBitmap(imageUrl, 1_000);
    let now = 0;
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
      warmup: false,
    });
    let scheduledResourceTask: (() => void) | null = null;
    vi.spyOn(engine, "queuePreparationTask").mockImplementation(
      ((task: () => void) => {
        scheduledResourceTask = task;
        return { cancel: vi.fn() };
      }) as any,
    );
    const coordinator = createTimingCoordinator({ frameEngine: engine });
    const audioContext = createFakeAudioContext({
      currentTime: 0.5,
      outputTimestamp: { contextTime: 0.5, performanceTime: 0 },
    });
    const decodeResponseStates: boolean[] = [];
    const decodeAudioData = audioContext.decodeAudioData.bind(audioContext);
    audioContext.decodeAudioData = vi.fn(async (buffer: ArrayBuffer) => {
      decodeResponseStates.push(engine.getDiagnostics().response_sensitive);
      return decodeAudioData(buffer);
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
      }),
    );
    const getAudioPlayer = vi.fn();
    const jsPsych: any = {
      precisionTiming: engine,
      timing: coordinator,
      pluginAPI: {
        preloadAudio: (_files: string[], done: () => void) => done(),
        preloadVideo: (_files: string[], done: () => void) => done(),
        audioContext: () => audioContext,
        getAudioPlayer,
      },
      timeline: { description: [] },
      getProgress: () => ({ current_trial_global: 0 }),
      getDisplayContainerElement: () => document.body,
      getDisplayElement: () => document.body,
      getInitSettings: () => ({}),
    };
    const plugin = new DynamicPlugin(jsPsych);
    const coldTrial: any = {
      components: [
        {
          type: "ImageComponent",
          name: "image",
          stimulus: imageUrl,
          stimulus_onset: null,
          stimulus_duration: null,
          coordinates: { x: 0, y: 0 },
          zIndex: 0,
        },
        {
          type: "AudioComponent",
          name: "audio",
          stimulus: audioUrl,
          stimulus_onset: null,
          stimulus_duration: null,
          autoplay: true,
          show_controls: false,
        },
      ],
      response_components: [
        {
          type: "KeyboardResponseComponent",
          name: "keyboard",
          choices: "ALL_KEYS",
        },
      ],
      trial_duration: 50,
      response_ends_trial: false,
      preload_assets: true,
      render_backend: "webgl-strict",
      record_gpu_timing: false,
      __canvasStyles: { width: 1024, height: 768 },
    };
    let resourcePreparation: Promise<void> | null = null;
    coordinator.publishPreparedPlugin(0, {
      pluginClass: DynamicPlugin,
      pluginInstance: {},
      preparationPromise: Promise.resolve(),
      timingContinuous: true,
    });
    coordinator.setPreparedPluginRefill(
      () => {
        resourcePreparation = plugin.prepareTrial(document.body, coldTrial, {
          trialIndex: 1,
          frameEngine: engine,
          timingContinuous: true,
          presentationStatic: true,
          earlyTransitionEligible: true,
          earlyTransitionRejectedReason: null,
        });
        return resourcePreparation;
      },
      () => true,
    );

    const active = engine.createTrialContext({
      id: "cold-audio-active",
      trialIndex: 0,
      continuous: true,
      allowEarlyActivation: true,
    });
    active.onStart(() => active.setResponseSensitive(true));
    active.markReady(0);
    active.start();
    const firstFrame = rafCallback!;
    rafCallback = null;
    firstFrame(0);
    coordinator.requestPreparedRefill?.();
    while (postedTasks.length > 0) postedTasks.shift()!();
    await Promise.resolve();
    await Promise.resolve();

    expect(engine.getDiagnostics().response_sensitive).toBe(true);
    expect(audioContext.decodeAudioData).not.toHaveBeenCalled();
    expect(coordinator.getSemanticBarrierAfter?.(0)).toBeNull();
    expect(coordinator.getResourceHorizonWarningAfter?.(0)).toBe(true);
    expect(scheduledResourceTask).not.toBeNull();

    active.setResponseSensitive(false);
    active.stop();
    engine.stop();
    scheduledResourceTask!();
    await resourcePreparation;

    expect(decodeResponseStates).toEqual([false]);
    expect(getAudioPlayer).not.toHaveBeenCalled();
    engine.reset();
  });
});
