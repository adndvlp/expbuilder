import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../components/ImageComponent", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../components/ImageComponent")>();
  return {
    ...actual,
    default: class MockImageComponent {
    private name = "";

    render(_container: HTMLElement, config: any) {
      this.name = config.name;
      const stimulus = config.__timing.registerStimulus(
        this.name,
        config.stimulus_onset,
        config.stimulus_duration,
        config.__componentId,
        { renderBackend: "webgl", timestampSemantics: "webgl_commit_frame" },
      );
      config.__timing.onStart((timestamp: number) => {
        stimulus.markOnset(timestamp, { frameTimestamp: timestamp });
      });
    }

    getPrecisionReadiness() {
      return {
        ready: true,
        reason: "mock_drawable_ready",
        fallbackReason: "",
        resourceReadyAt: performance.now(),
        gpuReadyAt: performance.now(),
      };
    }

    getResourceReadinessState(_config?: any) {
      return {
        resourceReady: true,
        gpuResourceReady: true,
        runtimeMaterializationCostEstimateMs: 1,
      };
    }

    hide() {}

    destroy() {}
    },
  };
});

import { Timeline } from "@expbuilder-jspsych/packages/jspsych/src/timeline/Timeline";
import { TrialFinalizationQueue } from "@expbuilder-jspsych/packages/jspsych/src/timeline/TrialFinalizationQueue";
import { createFrameEngine } from "@expbuilder-jspsych/packages/jspsych/src/timeline/FrameEngine";
import { createTimingCoordinator } from "@expbuilder-jspsych/packages/jspsych/src/timeline/TimingCoordinator";
import { PromiseWrapper } from "@expbuilder-jspsych/packages/jspsych/src/timeline/util";
import {
  VirtualMainThreadClock,
  type VirtualMainThreadTaskKind,
} from "@expbuilder-jspsych/packages/jspsych/src/timeline/testing/DisplaySimulator";
import { preloadBitmap } from "../utils/PrecisionTiming";

function createSchedulerWebGLContext() {
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
    createTexture: () => ({}),
    deleteTexture: () => {},
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
  } as any;
}

class FakeResizeObserver {
  private static readonly live = new Set<FakeResizeObserver>();
  private observing = false;

  constructor(private readonly callback: ResizeObserverCallback) {}

  observe() {
    this.observing = true;
    FakeResizeObserver.live.add(this);
  }

  unobserve() {
    this.disconnect();
  }

  disconnect() {
    this.observing = false;
    FakeResizeObserver.live.delete(this);
  }

  static triggerAll() {
    for (const observer of FakeResizeObserver.live) {
      if (observer.observing) observer.callback([], observer as any);
    }
  }

  static reset() {
    FakeResizeObserver.live.clear();
  }
}

function visualLeaf(name: string) {
  return {
    components: [
      {
        type: "ImageComponent",
        name,
        stimulus: "stimulus.png",
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

function keyboardLeaf(name: string) {
  return {
    ...visualLeaf(name),
    components: visualLeaf(name).components.map((component) => ({
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
    response_timing_enabled: true,
  };
}

const A_LEAF = visualLeaf("A");
const B_LEAF = keyboardLeaf("B");
const C_LEAF = keyboardLeaf("C");
const D_LEAF = keyboardLeaf("D");

async function macrotick() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

interface StackHarness {
  timeline: Timeline;
  runPromise: Promise<any>;
  engine: ReturnType<typeof createFrameEngine>;
  timingCoordinator: ReturnType<typeof createTimingCoordinator>;
  finalizationQueue: TrialFinalizationQueue;
  results: any[];
  postedTasks: Array<() => void>;
  clock: VirtualMainThreadClock;
  fire: () => boolean;
  consumeTask: (kind: VirtualMainThreadTaskKind, costMs: number) => void;
  getCriticalDroppedRefreshSlots: () => number;
  drain: () => void;
}

async function createPrecisionStack(options: {
  leaves: any[];
  variableCount: number;
  lookahead?: number;
  phaseBCostMs?: number;
  taskCostsMs?: Partial<Record<VirtualMainThreadTaskKind, number>>;
  conditionalBarrier?: {
    /** States array index after which the barrier entry is inserted. */
    afterStateIndex: number;
    conditional: () => boolean;
  };
}): Promise<StackHarness> {
  const DynamicPlugin = (await import("../index")).default;
  await preloadBitmap("stimulus.png", 1_000);
  const display = document.createElement("div");
  document.body.appendChild(display);
  let rafCallback: FrameRequestCallback | null = null;
  const postedTasks: Array<() => void> = [];
  const clock = new VirtualMainThreadClock({ refreshHz: 60 });
  let criticalDroppedRefreshSlots = 0;
  const consumeTask = (kind: VirtualMainThreadTaskKind, explicitCostMs?: number) => {
    const costMs = explicitCostMs ?? options.taskCostsMs?.[kind] ?? 0;
    if (costMs > 0) clock.consumeTask(costMs, kind);
  };
  const engine = createFrameEngine({
    now: clock.now,
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
  const queueSafeTask = engine.queueSafeTask.bind(engine);
  engine.queueSafeTask = (task, taskOptions = {}) =>
    queueSafeTask((budgetMs) => {
      if (taskOptions.label === "dynamic_deferred_finalize") {
        consumeTask("phase_b", options.phaseBCostMs);
      }
      return task(budgetMs);
    }, taskOptions);
  const fire = () => {
    const opportunity = clock.nextRefreshOpportunity();
    if (!opportunity.delivered) {
      if (engine.getDiagnostics().response_sensitive) {
        criticalDroppedRefreshSlots += 1;
      }
      return false;
    }
    const callback = rafCallback;
    rafCallback = null;
    // A physical refresh with no pending rAF request is neither an observed
    // callback nor a dropped callback. Administrative refill may briefly
    // leave the engine idle between independently scheduled runs.
    if (!callback) return false;
    callback(opportunity.timestamp);
    return true;
  };
  const timingCoordinator = createTimingCoordinator({ frameEngine: engine });
  const finalizationQueue = new TrialFinalizationQueue();
  const jsPsych = {
    precisionTiming: engine,
    timing: timingCoordinator,
    pluginAPI: {
      preloadAudio: (_files: string[], done: () => void) => {
        consumeTask("resource_prep");
        done();
      },
      preloadVideo: (_files: string[], done: () => void) => {
        consumeTask("resource_prep");
        done();
      },
      audioContext: () => null,
    },
    timeline: { description: [] },
    getProgress: () => ({ current_trial_global: currentTrialGlobal }),
    getDisplayContainerElement: () => document.body,
    getDisplayElement: () => display,
    getInitSettings: () => ({}),
  };

  const results: any[] = [];
  let currentTrialGlobal = 0;
  const dependencies: any = {
    onTrialStart: (trial: any) => {
      consumeTask("phase_r");
      currentTrialGlobal = trial.index ?? currentTrialGlobal;
    },

    onTrialResultAvailable: (trial: any) => {
      consumeTask("phase_a");
      results.push(trial.getResult());
    },
    onTrialFinished: (trial: any) => {
      // Deferred lifecycle must run strictly AFTER Phase B: the result is
      // already fully augmented when on_finish/onTrialFinished fire.
      expect(typeof trial.getResult().timing_quality).toBe("string");
    },
    runOnStartExtensionCallbacks: () => consumeTask("global_callback"),
    runOnLoadExtensionCallbacks: () => consumeTask("global_callback"),
    runOnFinishExtensionCallbacks: async () => {
      consumeTask("global_callback");
      return {};
    },
    getSimulationMode: () => undefined,
    getGlobalSimulationOptions: () => ({}),
    instantiatePlugin: (pluginClass: any) => {
      const instance = new pluginClass(jsPsych);
      const prepare = instance.prepareTrial?.bind(instance);
      if (prepare) {
        instance.prepareTrial = (...args: any[]) => {
          consumeTask("resource_prep");
          return prepare(...args);
        };
      }
      const materialize = instance.materializePreparedTrial?.bind(instance);
      if (materialize) {
        instance.materializePreparedTrial = (...args: any[]) => {
          consumeTask("runtime_materialization");
          return materialize(...args);
        };
      }
      return instance;
    },
    getDisplayElement: () => display,
    getDefaultIti: () => 0,
    finishTrialPromise: new PromiseWrapper(),
    timingCoordinator,
    enqueueTrialFinalization: (entry: any) => finalizationQueue.enqueue(entry),
    flushTrialFinalizations: async (beforeTrialIndex?: number) => {
      // Same contract as JsPsych: force-drain deferred Phase B tasks, then
      // exhaust the ordered queue up to the scope boundary.
      let guard = 0;
      while (guard < 512) {
        engine.flushSafeTasks();
        await finalizationQueue.flush(beforeTrialIndex);
        if (beforeTrialIndex === undefined) {
          if (finalizationQueue.pendingCount === 0) return;
        } else {
          const head = finalizationQueue.peek();
          if (!head || (head.trial as any).index >= beforeTrialIndex) return;
        }
        guard += 1;
      }
    },
    clearAllTimeouts: () => {},
  };

  const states = options.leaves.map((leaf) => ({ ...leaf, type: DynamicPlugin }));
  const barrier = options.conditionalBarrier;
  const planStates: any[] = [...states];
  if (barrier) {
    planStates.splice(barrier.afterStateIndex + 1, 0, {
      __precisionBarrier: "conditional",
    });
  }
  const timelineChildren: any[] = barrier
    ? [
        { timeline: [states[0]] },
        {
          timeline: [states[1]],
          conditional_function: barrier.conditional,
        },
      ]
    : [{ timeline: [...states] }];
  const timeline = new Timeline(dependencies, {
    timeline: timelineChildren,
    timeline_variables: Array.from({ length: options.variableCount }, (_, index) => ({
      state: index,
    })),
    precision_presentation_plan: {
      static: true,
      states: planStates,
      lookahead: options.lookahead ?? 3,
    },
  });

  const drainPostedTasks = () => {
    let guard = 0;
    while (postedTasks.length > 0) {
      postedTasks.shift()!();
      if (++guard > 128) break;
    }
  };
  const runPromise = timeline.run();
  for (let index = 0; index < 20; index++) {
    drainPostedTasks();
    await macrotick();
  }
  return {
    timeline,
    runPromise,
    engine,
    timingCoordinator,
    finalizationQueue,
    results,
    postedTasks,
    clock,
    fire,
    consumeTask: (kind, costMs) => consumeTask(kind, costMs),
    getCriticalDroppedRefreshSlots: () => criticalDroppedRefreshSlots,
    drain: drainPostedTasks,
  };
}

describe("precision runtime stack (Timeline → Trial → DynamicPlugin → FrameEngine → ResponseTimingManager)", () => {
  beforeEach(() => {
    FakeResizeObserver.reset();
    vi.stubGlobal("ResizeObserver", FakeResizeObserver);
    const gl = createSchedulerWebGLContext();
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
      function (type: string) {
        return type === "2d"
          ? ({
              fillStyle: "",
              clearRect: () => {},
              fillRect: () => {},
              getImageData: () => ({
                data: new Uint8ClampedArray([0, 0, 0, 0]),
              }),
            } as any)
          : gl;
      } as any,
    );
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
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    document.body.innerHTML = "";
  });

  it("A/B/C/D x100 with expensive Phase B: no deadlock, ordered data, real policies", async () => {
    const stack = await createPrecisionStack({
      leaves: [A_LEAF, B_LEAF, C_LEAF, D_LEAF],
      variableCount: 100,
      phaseBCostMs: 4,
    });
    const totalTrials = 400;
    let keydownDispatched = false;
    let maxPrepared = 0;
    let fired = 0;
    while (fired < 6000) {
      stack.fire();
      fired += 1;
      maxPrepared = Math.max(
        maxPrepared,
        stack.timingCoordinator.getPreparedPluginCount(),
      );
      const transitions = stack.engine.getTransitions().length;
      if (transitions === 1 && !keydownDispatched) {
        // First boundary committed at 50 ms: B (keyboard) is now the active
        // response authority. Dispatch 2 ms after its visual commit, BEFORE
        // the core reaches Trial B.run administratively.
        keydownDispatched = true;
        const event = new KeyboardEvent("keydown", { key: "x" });
        Object.defineProperty(event, "timeStamp", { value: 52 });
        window.dispatchEvent(event);
      }
      stack.drain();
      await macrotick();
      if (transitions >= totalTrials && stack.finalizationQueue.pendingCount === 0) {
        break;
      }
    }

    expect(stack.engine.getTransitions()).toHaveLength(totalTrials);
    await stack.runPromise;
    expect(stack.finalizationQueue.pendingCount).toBe(0);
    await stack.finalizationQueue.flush();
    for (let index = 0; index < 20; index++) await macrotick();

    const results = stack.results;
    expect(results).toHaveLength(totalTrials);
    expect(results.every((row) => typeof row.timing_quality === "string")).toBe(
      true,
    );
    expect(results.every((row, index) => row.trial_index === index)).toBe(true);

    // Real policy wiring: nearest_frame + relative_duration through the
    // actual runtime.
    expect(
      results.every((row) => row.selected_frame_policy === "nearest_frame"),
    ).toBe(true);
    expect(
      results.every((row) => row.schedule_reference === "relative_duration"),
    ).toBe(true);
    expect(
      results.every((row, index) =>
        index < totalTrials - 1
          ? row.atomic_transition_used === true
          : row.atomic_transition_used === false,
      ),
    ).toBe(true);
    expect(
      results.every((row) => row.visual_commit_count_for_boundary === 1),
    ).toBe(true);

    // Zero missing response window: the keydown 2 ms after B's visual commit
    // belongs to B, with event.timeStamp authority.
    expect(results[0].response_time).toBeNull();
    expect(results[1].response_time).toBe(52);
    expect(results[1].response_timestamp_source).toBe("event.timeStamp");
    expect(results[1].rt_visual_commit).toBe(2);
    expect(results[1].response_valid).toBe(true);

    // Bounded lookahead and bounded engine state.
    // P0.4 (iteración 6): el lag cap del engine (default 3) mantiene el mapa
    // de prepared executions acotado a lookahead + cap + small overhead.
    expect(maxPrepared).toBeLessThanOrEqual(8);
    expect(stack.timingCoordinator.getAdministrativeLagTrials()).toBeLessThanOrEqual(3);
    expect(stack.timingCoordinator.getPreparedPluginCount()).toBe(0);
    // Adaptive lookahead (P0.6) may widen the window to 4 prepared contexts.
    expect(stack.engine.getDiagnostics().peak_live_contexts).toBeLessThanOrEqual(10);
    expect(stack.engine.getDiagnostics().pending_post_critical_tasks).toBe(0);
    expect(stack.getCriticalDroppedRefreshSlots()).toBe(0);
    expect(
      stack.clock.getTaskRecords().filter((task) => task.kind === "phase_b"),
    ).toHaveLength(totalTrials);
    stack.engine.reset();
  }, 120_000);

  it("virtual Phase B occupancy forced into a critical window drops a real refresh slot", async () => {
    const stack = await createPrecisionStack({
      leaves: [keyboardLeaf("forced-critical")],
      variableCount: 2,
      lookahead: 2,
    });

    expect(stack.fire()).toBe(true);
    stack.drain();
    await macrotick();
    expect(stack.engine.getDiagnostics().response_sensitive).toBe(true);

    stack.consumeTask("phase_b", 20);
    expect(stack.fire()).toBe(false);
    expect(stack.clock.getDroppedRefreshSlots()).toBe(1);
    expect(stack.getCriticalDroppedRefreshSlots()).toBe(1);
    expect(stack.fire()).toBe(true);

    let opportunities = 3;
    while (
      stack.engine.getTransitions().length < 2 ||
      stack.finalizationQueue.pendingCount > 0
    ) {
      stack.fire();
      opportunities += 1;
      stack.drain();
      await macrotick();
      expect(opportunities).toBeLessThan(200);
    }
    await stack.runPromise;
    stack.engine.reset();
  });

  it("100 consecutive response-sensitive trials with 20 ms Phase B: data stays ordered, degradation stays explicit", async () => {
    const stack = await createPrecisionStack({
      leaves: [keyboardLeaf("K")],
      variableCount: 100,
      lookahead: 3,
      phaseBCostMs: 20,
    });
    const totalTrials = 100;
    let keydownDispatched = false;
    let maxPrepared = 0;
    let fired = 0;
    while (fired < 3000) {
      stack.fire();
      fired += 1;
      maxPrepared = Math.max(
        maxPrepared,
        stack.timingCoordinator.getPreparedPluginCount(),
      );
      const transitions = stack.engine.getTransitions().length;
      if (transitions === 1 && !keydownDispatched) {
        keydownDispatched = true;
        const event = new KeyboardEvent("keydown", { key: "x" });
        Object.defineProperty(event, "timeStamp", { value: 52 });
        window.dispatchEvent(event);
      }
      stack.drain();
      await macrotick();
      if (transitions >= totalTrials && stack.finalizationQueue.pendingCount === 0) {
        break;
      }
    }

    expect(stack.engine.getTransitions()).toHaveLength(totalTrials);
    await stack.runPromise;
    await stack.finalizationQueue.flush();
    for (let index = 0; index < 40; index++) await macrotick();

    const results = stack.results;
    expect(results).toHaveLength(totalTrials);
    expect(results.every((row) => typeof row.timing_quality === "string")).toBe(
      true,
    );
    expect(results.every((row, index) => row.trial_index === index)).toBe(true);
    // The very first keydown is captured by trial 1, never by trial 0.
    expect(results[0].response_time).toBeNull();
    expect(results[1].response_time).toBe(52);
    expect(results[1].response_valid).toBe(true);
    // P0.1 (iteración 7): CERO gaps para una secuencia estática con recursos
    // ready — la cadena física es atómica en TODAS las fronteras internas.
    // La única transición no-atómica permitida es la terminal real del bloque.
    // Phase B pesada (20 ms) jamás modifica el presentation chain.
    expect(
      results
        .filter((row) => row.prepare_completion_deferred_until_safe === true)
        .every((row) => row.prepare_main_thread_during_response_window === false),
    ).toBe(true);
    const nonAtomic = stack.engine
      .getTransitions()
      .filter((transition: any) => transition.atomic_transition_used !== true);
    expect(nonAtomic).toHaveLength(1);
    expect(nonAtomic[0].incoming_trial_index).toBeNull();
    expect(nonAtomic[0].boundary_missed_reason).toBeNull();
    const misses = stack.engine
      .getTransitions()
      .filter(
        (transition: any) =>
          transition.boundary_missed_reason !== null ||
          transition.incoming_not_ready === true,
      );
    expect(misses).toHaveLength(0);
    expect(
      stack.engine
        .getTransitions()
        .every(
          (transition: any) =>
            transition.boundary_missed_reason !== "physical_admin_lag_cap",
        ),
    ).toBe(true);
    // Adaptive lookahead (P0.6) keeps the window at 4 with measured costs.
    expect(maxPrepared).toBeLessThanOrEqual(4);
    expect(stack.engine.getDiagnostics().pending_post_critical_tasks).toBe(0);
    expect(
      document.querySelectorAll('[data-dynamic-plugin-container="true"]'),
    ).toHaveLength(0);
    stack.engine.reset();
  }, 120_000);

  it("P1.4: persistent-surface resize is coalesced until the response window is safe", async () => {
    const stack = await createPrecisionStack({
      leaves: [keyboardLeaf("resize")],
      variableCount: 2,
      lookahead: 2,
    });
    const surface = document.getElementById(
      "jspsych-dynamic-persistent-visual",
    ) as HTMLElement;
    expect(surface).not.toBeNull();

    stack.fire();
    stack.drain();
    await macrotick();
    expect(stack.engine.getDiagnostics().response_sensitive).toBe(true);
    const transformBeforeResize = surface.style.transform;

    vi.stubGlobal("innerWidth", 512);
    vi.stubGlobal("innerHeight", 384);
    FakeResizeObserver.triggerAll();
    stack.drain();
    await macrotick();

    // The observer only queued work; no visible style mutation crossed the
    // active response-sensitive interval.
    expect(surface.style.transform).toBe(transformBeforeResize);

    let fired = 1;
    while (
      stack.engine.getTransitions().length < 2 ||
      stack.finalizationQueue.pendingCount > 0
    ) {
      stack.fire();
      fired += 1;
      stack.drain();
      await macrotick();
      expect(fired).toBeLessThan(200);
    }
    await stack.runPromise;
    stack.drain();
    await macrotick();

    expect(surface.style.transform).toContain("scale(0.5)");
    stack.engine.reset();
  });

  it("P0.2 acceptance: the physical chain never crosses a semantic barrier", async () => {
    const probe = { evals: [] as number[], frame: 0 };
    const stack = await createPrecisionStack({
      leaves: [A_LEAF, B_LEAF],
      variableCount: 2,
      lookahead: 3,
      conditionalBarrier: {
        afterStateIndex: 0,
        conditional: () => {
          probe.evals.push(probe.frame);
          return true;
        },
      },
    });
    const totalTrials = 4;
    let firstCrossFrame = -1;
    let maxPrepared = 0;
    let fired = 0;
    while (fired < 3000) {
      probe.frame = fired;
      stack.fire();
      fired += 1;
      maxPrepared = Math.max(
        maxPrepared,
        stack.timingCoordinator.getPreparedPluginCount(),
      );
      stack.drain();
      await macrotick();
      const transitions = stack.engine.getTransitions().length;
      if (transitions >= 2 && firstCrossFrame < 0) firstCrossFrame = fired;
      if (transitions >= totalTrials && stack.finalizationQueue.pendingCount === 0) {
        break;
      }
    }

    expect(stack.engine.getTransitions()).toHaveLength(totalTrials);
    await stack.runPromise;
    await stack.finalizationQueue.flush();
    for (let index = 0; index < 40; index++) await macrotick();

    const results = stack.results;
    expect(results).toHaveLength(totalTrials);
    expect(results.every((row, index) => row.trial_index === index)).toBe(true);

    // The barrier is explicit at the engine level: A's outgoing transition is
    // terminal (the chain NEVER armed B across it) and B never presents before
    // the conditional evaluates. Between variables (B → next A) the chain
    // stays atomic: there is no semantic decision there.
    const transitions = stack.engine.getTransitions();
    expect(transitions[0].incoming_trial_index).toBeNull();
    expect(transitions[1].incoming_trial_index).toBe(2);
    expect(transitions[2].incoming_trial_index).toBeNull();
    expect(transitions[3].incoming_trial_index).toBeNull();
    expect(probe.evals.length).toBeGreaterThanOrEqual(2);
    expect(probe.evals[0]).toBeLessThan(firstCrossFrame);

    // Honest telemetry on the pre-barrier trials (A before each conditional).
    expect(results[0].semantic_barrier_type).toBe("conditional");
    expect(results[0].precision_run_broken_at_barrier).toBe(true);
    expect(results[2].semantic_barrier_type).toBe("conditional");
    expect(results[2].precision_run_broken_at_barrier).toBe(true);
    expect(results[1].semantic_barrier_type).toBeNull();
    expect(results[1].precision_run_broken_at_barrier).toBe(false);

    expect(maxPrepared).toBeLessThanOrEqual(8);
    expect(stack.timingCoordinator.getAdministrativeLagTrials()).toBeLessThanOrEqual(3);
    expect(stack.engine.getDiagnostics().forced_safe_flush_during_response_window).toBe(0);
    stack.engine.reset();
  }, 120_000);

  it("ACCEPTANCE B/C: 1,000 response-sensitive trials with 20 ms Phase B stay atomic end-to-end", async () => {
    const stack = await createPrecisionStack({
      leaves: [keyboardLeaf("K")],
      variableCount: 1000,
      lookahead: 3,
      phaseBCostMs: 20,
    });
    const totalTrials = 1000;
    let maxPrepared = 0;
    let fired = 0;
    while (fired < 30_000) {
      stack.fire();
      fired += 1;
      maxPrepared = Math.max(
        maxPrepared,
        stack.timingCoordinator.getPreparedPluginCount(),
      );
      stack.drain();
      await macrotick();
      const transitions = stack.engine.getTransitions().length;
      if (transitions >= totalTrials && stack.finalizationQueue.pendingCount === 0) {
        break;
      }
    }

    expect(stack.engine.getTransitions()).toHaveLength(totalTrials);
    await stack.runPromise;
    await stack.finalizationQueue.flush();
    for (let index = 0; index < 40; index++) await macrotick();

    const results = stack.results;
    expect(results).toHaveLength(totalTrials);
    expect(results.every((row, index) => row.trial_index === index)).toBe(true);
    // CERO gaps: internal transitions all atomic; no terminal blanks; no
    // incoming_not_ready; no admin-lag-cap misses. Phase B pesada (20 ms)
    // jamás modifica el presentation chain.
    const nonAtomic = stack.engine
      .getTransitions()
      .filter((transition: any) => transition.atomic_transition_used !== true);
    expect(nonAtomic).toHaveLength(1);
    expect(nonAtomic[0].incoming_trial_index).toBeNull();
    const missed = stack.engine
      .getTransitions()
      .filter((transition: any) => transition.boundary_missed_reason !== null);
    expect(missed).toHaveLength(0);
    expect(maxPrepared).toBeLessThanOrEqual(8);
    expect(
      stack.timingCoordinator.getAdministrativeLagTrials(),
    ).toBeLessThanOrEqual(3);
    expect(stack.engine.getDiagnostics().forced_safe_flush_during_response_window).toBe(0);
    expect(stack.getCriticalDroppedRefreshSlots()).toBe(0);
    expect(
      stack.clock.getTaskRecords().filter((task) => task.kind === "phase_b"),
    ).toHaveLength(totalTrials);
    stack.engine.reset();
  }, 600_000);

  it("P0.4 acceptance: 10,000 response-sensitive trials stay bounded end-to-end", async () => {
    const stack = await createPrecisionStack({
      leaves: [keyboardLeaf("K")],
      variableCount: 10_000,
      lookahead: 3,
    });
    const totalTrials = 10_000;
    let maxPrepared = 0;
    let maxAdminLag = 0;
    let maxLiveContainers = 0;
    let fired = 0;
    while (fired < 200_000) {
      stack.fire();
      fired += 1;
      maxPrepared = Math.max(
        maxPrepared,
        stack.timingCoordinator.getPreparedPluginCount(),
      );
      maxAdminLag = Math.max(
        maxAdminLag,
        stack.timingCoordinator.getAdministrativeLagTrials(),
      );
      if (fired % 250 === 0) {
        // P0.5 iteración 7: DOM administrativo acotado por configuración.
        maxLiveContainers = Math.max(
          maxLiveContainers,
          document.querySelectorAll('[data-dynamic-plugin-container="true"]')
            .length,
        );
      }
      stack.drain();
      await macrotick();
      const transitions = stack.engine.getTransitions().length;
      if (transitions >= totalTrials && stack.finalizationQueue.pendingCount === 0) {
        break;
      }
    }

    expect(stack.engine.getTransitions()).toHaveLength(totalTrials);
    await stack.runPromise;
    await stack.finalizationQueue.flush();
    for (let index = 0; index < 40; index++) await macrotick();

    const results = stack.results;
    expect(results).toHaveLength(totalTrials);
    expect(results.every((row, index) => row.trial_index === index)).toBe(true);
    // Estrictamente acotado por configuración, jamás por el tamaño total.
    expect(maxPrepared).toBeLessThanOrEqual(8);
    expect(maxAdminLag).toBeLessThanOrEqual(3);
    expect(stack.engine.getDiagnostics().peak_live_contexts).toBeLessThanOrEqual(10);
    expect(stack.finalizationQueue.pendingCount).toBe(0);
    expect(stack.timingCoordinator.getPreparedPluginCount()).toBe(0);
    // P0.5: contenedores runtime acotados a lookahead + admin-lag, sin
    // requerir removal por boundary.
    expect(maxLiveContainers).toBeLessThanOrEqual(8);
    // P0.1 (iteración 7): CERO gaps internos — la única transición
    // no-atómica es la terminal real del bloque. Ni holds por lag cap ni
    // incoming_not_ready en una secuencia estática con recursos ready.
    const heldTransitions = stack.engine
      .getTransitions()
      .filter((transition: any) => transition.atomic_transition_used !== true);
    expect(heldTransitions).toHaveLength(1);
    expect(heldTransitions[0].incoming_trial_index).toBeNull();
    expect(
      stack.engine
        .getTransitions()
        .every((transition: any) => transition.boundary_missed_reason === null),
    ).toBe(true);
    expect(
      stack.engine
        .getTransitions()
        .every(
          (transition: any) =>
            transition.boundary_missed_reason !== "physical_admin_lag_cap",
        ),
    ).toBe(true);
    stack.engine.reset();
  }, 600_000);

  it("abort mid-run settles the finalization queue without hanging", async () => {
    const stack = await createPrecisionStack({
      leaves: [A_LEAF, B_LEAF],
      variableCount: 50,
      phaseBCostMs: 4,
    });
    let fired = 0;
    while (stack.engine.getTransitions().length < 10 && fired < 2000) {
      stack.fire();
      fired += 1;
      stack.drain();
      await macrotick();
    }
    expect(stack.engine.getTransitions().length).toBeGreaterThanOrEqual(10);
    // Abort while the precision chain is mid-run. The timeline still waits
    // for the active trial to complete, so keep driving frames until it
    // settles.
    stack.timeline.abort();
    let abortFrames = 0;
    let settled = false;
    stack.runPromise.then(() => {
      settled = true;
    });
    while (!settled && abortFrames < 3000) {
      stack.fire();
      abortFrames += 1;
      stack.drain();
      await macrotick();
    }
    await stack.runPromise;
    // Force-drain any engine-deferred Phase B, then flush the queue: the
    // abort must never leave the queue (or the core) hanging.
    stack.engine.flushSafeTasks();
    await stack.finalizationQueue.flush();
    expect(stack.finalizationQueue.pendingCount).toBe(0);
    expect(
      stack.results.every((row) => typeof row.timing_quality === "string"),
    ).toBe(true);
    stack.engine.reset();
  }, 60_000);
});
