import { JsPsych, JsPsychPlugin, ParameterType, TrialType } from "jspsych";

const version = "1.0.0";

// Import all component types
import ImageComponent, {
  getImageTextureKey,
  prepareImageTexture,
} from "./components/ImageComponent";
import VideoComponent from "./components/VideoComponent";
import HtmlComponent from "./components/HtmlComponent";
import TextComponent, {
  getTextFontTelemetry,
  getTextResourceSignature,
} from "./components/TextComponent";
import AudioComponent from "./components/AudioComponent";
import { createPrecisionComponentLifecycle } from "./components/PrecisionComponent";

// Import all response components
import ButtonResponseComponent from "./response_components/ButtonResponseComponent";
import ClickResponseComponent from "./response_components/ClickResponseComponent";
import SliderResponseComponent from "./response_components/SliderResponseComponent";
import KeyboardResponseComponent from "./response_components/KeyboardResponseComponent";
import InputResponseComponent from "./response_components/InputResponseComponent";
import SurveyComponent from "./response_components/SurveyComponent";
import SketchpadComponent from "./components/SketchpadComponent";
import AudioResponseComponent from "./response_components/AudioResponseComponent";
import FileUploadResponseComponent from "./response_components/FileUploadResponseComponent";
import {
  AssetPreloadList,
  createPrecisionTiming,
  getReadyPreloadedBitmap,
  HostTrialTimingContext,
  preloadAssets,
  resolveTimingMs,
  ScheduleReference,
  VisualBoundaryPolicy,
} from "./utils/PrecisionTiming";
import ResponseTimingManager from "./utils/ResponseTimingManager";
import {
  createParticipantResponseSignal,
  ParticipantResponseSignal,
} from "./utils/EventTiming";
import { getPreparedVisualResourceCacheTelemetry } from "./utils/PreparedVisualResourceCache";
import { getPreloadedAudioBuffer } from "./utils/AudioTiming";
import {
  CanvasStage,
  getCanvasStage,
  getCanvasStages,
  StageMetricCursor,
  StageMetrics,
  StageMetricSeriesSlice,
} from "./renderer/CanvasStage";

const DYNAMIC_CONTAINER_ID = "jspsych-dynamic-plugin-container";
const DYNAMIC_PERSISTENT_VISUAL_ID = "jspsych-dynamic-persistent-visual";

interface HostFrameEngine {
  createTrialContext(options?: {
    id?: string;
    trialIndex?: number | null;
    continuous?: boolean;
    allowEarlyActivation?: boolean;
    earlyTransitionRejectedReason?: string | null;
  }): HostTrialTimingContext;
  onVisualCommit(
    callback: (timestamp: number, observation: any) => void,
  ): () => void;
  onReset(callback: () => void): () => void;
  canStartBackgroundWork(): boolean;
  isRunning?(): boolean;
  queueSafeTask(
    task: () => void,
    options?: {
      label?: string;
      estimatedCostMs?: number;
      responseSafe?: boolean;
    },
  ): void;
  /**
   * P0.1 (iteración 6): MAIN_THREAD_PREP/GPU_PREP del scheduler de
   * preparación — nunca se ejecuta durante ventanas response-sensitive ni en
   * la CRITICAL window.
   */
  queuePreparationTask?(
    task: () => void,
    options?: { label?: string; estimatedCostMs?: number },
  ): void;
  getWorkPhase?(): "SAFE" | "CRITICAL";
  getDiagnostics?(): {
    response_sensitive: boolean;
    [key: string]: any;
  };
  getWarmupTelemetry?(): {
    frame_clock_warmup_frames: number;
    frame_clock_warmup_duration_ms: number;
    frame_clock_warmup_refresh_hz: number | null;
    frame_clock_warmup_confidence: number | null;
    frame_clock_warmup_timeout: boolean;
    frame_clock_warmup_regime_generation: number;
  };
  flushSafeTasks?(): void;
}

interface PreparedTrialDescriptor {
  materializationSafe: boolean;
  estimatedCostMs: number;
  resourceReady: boolean;
  gpuReady: boolean;
  requiresLiveDom: boolean;
  diagnostics?: Record<string, unknown>;
}

interface DynamicPreparedTrialResourceTemplate {
  resourceKey: string;
  descriptorPublicationSafe: boolean;
  estimatedPublicationCostMs: number;
  resourceReady: boolean;
  gpuReady: boolean;
  requiresLiveDom: boolean;
  payload: {
    trial: any;
    descriptor: PreparedTrialDescriptor;
    stage: CanvasStage;
  };
}

let persistentVisualSurface: HTMLElement | null = null;
let persistentVisualFrameEngine: HostFrameEngine | null = null;
let removePersistentVisualCommit: (() => void) | null = null;
let removePersistentVisualReset: (() => void) | null = null;
let persistentVisualResizeObserver: ResizeObserver | null = null;
let persistentVisualResizeQueuedGeneration: number | null = null;
let persistentVisualSurfaceGeneration = 0;
let persistentVisualLayout: {
  width: number;
  height: number;
  backgroundColor: string;
} | null = null;
let dynamicTrialSequenceCounter = 0;
let physicalActivationSequenceCounter = 0;
// P0.3 (iteración 5): métricas de recursos vivos/retirados para el stress
// de 10,000 trials. La cola de finalización conserva registros pequeños,
// nunca runtime completo.
let cumulativeRetiredResources = 0;
let pendingFinalizerCount = 0;
let peakPendingFinalizers = 0;
// P1.1 (iteración 7): el baseline de métricas de un trial es el cursor final
// del trial anterior — atribución exacta del commit del boundary.
let previousTrialMetricEndCursors: StageMetricCursor[] | null = null;
// P1.2 (iteración 6): métricas vivas reales (creados − destruidos).
let liveRuntimeComponentInstances = 0;
let liveRuntimeLifecycles = 0;

type ContainerTeardownRegistry = {
  callbacks: Map<HTMLElement, Set<() => void>>;
  observer: MutationObserver;
  sentinel: HTMLElement;
};

const containerTeardownRegistries = new WeakMap<
  HTMLElement,
  ContainerTeardownRegistry
>();

// P1.2 (iteración 5): refresh de layout de pointer SÓLO en momentos SAFE
// (resize del viewport), nunca dentro del event handler.
let safePointerLayoutRefreshListeners: Array<() => void> | null = null;
function ensureSafePointerLayoutRefresh(manager: any) {
  const refresh = () => manager.refreshPointerLayout?.();
  if (!safePointerLayoutRefreshListeners) {
    safePointerLayoutRefreshListeners = [];
    window.addEventListener("resize", () => {
      for (const listener of safePointerLayoutRefreshListeners ?? []) {
        listener();
      }
    });
  }
  safePointerLayoutRefreshListeners.push(refresh);
}

/** One DOM-removal observer per display, regardless of prepared trial count. */
function registerContainerTeardown(
  displayElement: HTMLElement,
  container: HTMLElement,
  callback: () => void,
) {
  let registry = containerTeardownRegistries.get(displayElement);
  if (!registry) {
    const callbacks = new Map<HTMLElement, Set<() => void>>();
    // One bounded, content-free node keeps external display clearing
    // observable after DOM-free precision trials detach their per-trial shell.
    const sentinel = document.createElement("span");
    sentinel.dataset.dynamicPluginTeardownSentinel = "true";
    sentinel.hidden = true;
    displayElement.appendChild(sentinel);
    const visitRemovedNode = (node: Node) => {
      if (!(node instanceof HTMLElement)) return;
      for (const [container, registeredCallbacks] of [...callbacks]) {
        if (container !== node && !node.contains(container)) continue;
        for (const registeredCallback of [...registeredCallbacks]) {
          registeredCallback();
        }
      }
    };
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        for (const removedNode of record.removedNodes) {
          visitRemovedNode(removedNode);
        }
      }
    });
    observer.observe(displayElement, { childList: true, subtree: true });
    registry = { callbacks, observer, sentinel };
    containerTeardownRegistries.set(displayElement, registry);
  }

  const observedContainer = displayElement.contains(container)
    ? container
    : registry.sentinel;
  let callbacksForContainer = registry.callbacks.get(observedContainer);
  if (!callbacksForContainer) {
    callbacksForContainer = new Set();
    registry.callbacks.set(observedContainer, callbacksForContainer);
  }
  callbacksForContainer.add(callback);
  let registered = true;
  return () => {
    if (!registered) return;
    registered = false;
    const registeredCallbacks = registry!.callbacks.get(observedContainer);
    registeredCallbacks?.delete(callback);
    if (registeredCallbacks?.size === 0) {
      registry!.callbacks.delete(observedContainer);
    }
    if (
      registry!.callbacks.size === 0 &&
      !registry!.sentinel.isConnected
    ) {
      registry!.observer.disconnect();
      containerTeardownRegistries.delete(displayElement);
    }
  };
}

// ---------------------------------------------------------------------------
// P3 — prepared presentation (static resource prewarm).
//
// Ordinary timelines cannot safely reveal an unresolved next trial. P3 is the
// resource-only prewarm driven by a builder-generated STATIC manifest
// (`prepare_next_manifest` on the ACTIVE trial): literal asset URLs only. The
// core precision presentation plan is a separate, stronger contract that can
// prepare complete leaf states once variables/control flow are resolved.
// P3 preparation warms the existing module
// caches (image decode/bitmap, audio, video) — it never evaluates future
// parameters, never touches DOM, never starts trial/onset/response/activation
// timers, never acquires a host origin. NOTE: the existing preload
// infrastructure uses bounded LOAD timeouts internally (window.setTimeout
// with a cap); that is a shared-cache safety net, not a trial timer, and is
// intentionally unchanged.
//
// Prepared state is isolated PER jsPsych instance (WeakMap) because a page
// can run multiple independent experiments.
// ---------------------------------------------------------------------------
interface PreparedPresentationState {
  generation: number;
  stableTrialId: string | null;
  images: string[];
  audio: string[];
  video: string[];
  status: "warming" | "ready" | "not_safe" | "discarded";
  /** Diagnostics only (performance.now()); never a trial origin. */
  startedAt: number;
  readyAt: number | null;
}

interface PreparationContext {
  generation: number;
  candidate: PreparedPresentationState | null;
}

const preparationContexts = new WeakMap<object, PreparationContext>();

function getPreparationContext(jsPsych: any): PreparationContext {
  let context = preparationContexts.get(jsPsych);
  if (!context) {
    context = { generation: 0, candidate: null };
    preparationContexts.set(jsPsych, context);
  }
  return context;
}

function disposePreparedPresentation(jsPsych: any) {
  const context = preparationContexts.get(jsPsych);
  if (!context) return;
  context.generation++;
  context.candidate = null;
}

function prepareNextPresentation(jsPsych: any, rawManifest: unknown) {
  const manifest = (rawManifest ?? {}) as {
    stableTrialId?: unknown;
    images?: unknown;
    audio?: unknown;
    video?: unknown;
  };
  const stableTrialId =
    typeof manifest.stableTrialId === "string" ? manifest.stableTrialId : null;
  const stringArray = (value: unknown): string[] =>
    Array.isArray(value)
      ? value.filter((entry): entry is string => typeof entry === "string")
      : [];
  const images = stringArray(manifest.images);
  const audio = stringArray(manifest.audio);
  const video = stringArray(manifest.video);

  const context = getPreparationContext(jsPsych);

  if (images.length === 0 && audio.length === 0 && video.length === 0) {
    context.generation++;
    context.candidate = {
      generation: context.generation,
      stableTrialId,
      images,
      audio,
      video,
      status: "not_safe",
      startedAt: performance.now(),
      readyAt: null,
    };
    return;
  }

  const generation = ++context.generation;
  const entry: PreparedPresentationState = {
    generation,
    stableTrialId,
    images,
    audio,
    video,
    status: "warming",
    startedAt: performance.now(),
    readyAt: null,
  };
  context.candidate = entry;

  preloadAssets(jsPsych, { images, audio, video })
    .then(() => {
      if (
        entry.generation !== context.generation ||
        context.candidate !== entry
      ) {
        entry.status = "discarded";
        return;
      }
      entry.status = "ready";
      entry.readyAt = performance.now();
    })
    .catch(() => {
      if (
        entry.generation !== context.generation ||
        context.candidate !== entry
      ) {
        entry.status = "discarded";
        return;
      }
      context.candidate = null;
    });
}

type PrepareStatus = "not_attempted" | "reused" | "miss" | "not_safe";

function validatePreparedPresentation(
  jsPsych: any,
  trial: any,
): {
  status: PrepareStatus;
  startedAt: number | null;
  readyAt: number | null;
} {
  const context = preparationContexts.get(jsPsych);
  const candidate = context?.candidate ?? null;
  if (!candidate) {
    return { status: "not_attempted", startedAt: null, readyAt: null };
  }
  // Single-use: whichever trial activates next consumes the candidate.
  context.candidate = null;
  const { startedAt, readyAt } = candidate;

  if (candidate.status !== "ready") {
    return { status: "not_safe", startedAt, readyAt: null };
  }

  const stableIdMatches =
    candidate.stableTrialId === null ||
    trial.__stableTrialId === candidate.stableTrialId;
  if (!stableIdMatches) {
    return { status: "miss", startedAt, readyAt };
  }

  // Typed, category-aware validation against the REAL processed trial.
  // Function-valued parameters never participate (the collector only
  // accepts literal strings).
  const actual = collectAssetPreloadListFromTrial(trial);
  const hasAnyActual =
    actual.images.length > 0 ||
    actual.audio.length > 0 ||
    actual.video.length > 0;
  if (!hasAnyActual) {
    return { status: "miss", startedAt, readyAt };
  }

  const covered =
    actual.images.every((url) => candidate.images.includes(url)) &&
    actual.audio.every((url) => candidate.audio.includes(url)) &&
    actual.video.every((url) => candidate.video.includes(url));
  if (!covered) {
    return { status: "miss", startedAt, readyAt };
  }

  return { status: "reused", startedAt, readyAt };
}

function styleVisualContainer(
  container: HTMLElement,
  width: number,
  height: number,
  backgroundColor: string,
) {
  const ratio = Math.min(
    window.innerWidth / width,
    window.innerHeight / height,
  );
  container.style.position = "fixed";
  container.style.top = "50%";
  container.style.left = "50%";
  container.style.width = `${width}px`;
  container.style.height = `${height}px`;
  container.style.overflow = "hidden";
  container.style.textAlign = "left";
  container.style.background = backgroundColor;
  container.style.transform = `translate(-50%, -50%) scale(${ratio})`;
  container.style.transformOrigin = "center center";
}

function schedulePersistentVisualResize() {
  if (!persistentVisualSurface || !persistentVisualLayout) return;
  const generation = persistentVisualSurfaceGeneration;
  if (persistentVisualResizeQueuedGeneration === generation) return;
  persistentVisualResizeQueuedGeneration = generation;
  const applyResize = () => {
    if (persistentVisualResizeQueuedGeneration === generation) {
      persistentVisualResizeQueuedGeneration = null;
    }
    if (
      generation !== persistentVisualSurfaceGeneration ||
      !persistentVisualSurface ||
      !persistentVisualLayout
    ) {
      return;
    }
    styleVisualContainer(
      persistentVisualSurface,
      persistentVisualLayout.width,
      persistentVisualLayout.height,
      persistentVisualLayout.backgroundColor,
    );
  };
  if (typeof persistentVisualFrameEngine?.queueSafeTask === "function") {
    persistentVisualFrameEngine.queueSafeTask(applyResize, {
      label: "dynamic-persistent-surface-resize",
      estimatedCostMs: 1,
    });
  } else {
    applyResize();
  }
}

function getPersistentVisualSurface(
  width: number,
  height: number,
  backgroundColor: string,
) {
  const nextLayout = { width, height, backgroundColor };
  if (!persistentVisualSurface) {
    persistentVisualSurfaceGeneration += 1;
    persistentVisualSurface = document.createElement("div");
    persistentVisualSurface.id = DYNAMIC_PERSISTENT_VISUAL_ID;
    persistentVisualSurface.setAttribute("aria-hidden", "true");
    persistentVisualSurface.style.pointerEvents = "none";
    persistentVisualSurface.style.zIndex = "2147483646";
    document.body.appendChild(persistentVisualSurface);
    styleVisualContainer(
      persistentVisualSurface,
      nextLayout.width,
      nextLayout.height,
      nextLayout.backgroundColor,
    );
  } else if (
    !persistentVisualLayout ||
    persistentVisualLayout.width !== nextLayout.width ||
    persistentVisualLayout.height !== nextLayout.height ||
    persistentVisualLayout.backgroundColor !== nextLayout.backgroundColor
  ) {
    styleVisualContainer(
      persistentVisualSurface,
      nextLayout.width,
      nextLayout.height,
      nextLayout.backgroundColor,
    );
  }
  persistentVisualLayout = nextLayout;
  if (
    !persistentVisualResizeObserver &&
    typeof ResizeObserver !== "undefined"
  ) {
    persistentVisualResizeObserver = new ResizeObserver(() => {
      // P1.4 (iteración 7): ResizeObserver nunca muta layout directamente.
      // El FrameEngine coalesce y ejecuta la actualización sólo en SAFE;
      // durante una ventana de respuesta la geometría visible permanece
      // estable hasta que exista presupuesto no crítico.
      schedulePersistentVisualResize();
    });
    persistentVisualResizeObserver.observe(document.documentElement);
  }
  return persistentVisualSurface;
}

function bindPersistentVisualSurfaceToFrameEngine(engine: HostFrameEngine) {
  if (persistentVisualFrameEngine === engine && removePersistentVisualCommit) {
    return;
  }
  removePersistentVisualCommit?.();
  removePersistentVisualReset?.();
  persistentVisualFrameEngine = engine;
  removePersistentVisualCommit = engine.onVisualCommit((timestamp) => {
    if (!persistentVisualSurface) return;
    for (const stage of getCanvasStages(persistentVisualSurface)) {
      stage.commit(timestamp, true);
    }
  });
  removePersistentVisualReset = engine.onReset(() => {
    // P0.3 (iteración 5): los contadores de recursos viven por experimento —
    // se resetean con el engine.
    cumulativeRetiredResources = 0;
    physicalActivationSequenceCounter = 0;
    pendingFinalizerCount = 0;
    peakPendingFinalizers = 0;
    liveRuntimeComponentInstances = 0;
    liveRuntimeLifecycles = 0;
    previousTrialMetricEndCursors = null;
    removePersistentVisualSurface();
  });
}

function removePersistentVisualSurface() {
  persistentVisualSurfaceGeneration += 1;
  persistentVisualResizeQueuedGeneration = null;
  persistentVisualResizeObserver?.disconnect();
  persistentVisualResizeObserver = null;
  persistentVisualLayout = null;
  if (persistentVisualSurface) {
    for (const stage of getCanvasStages(persistentVisualSurface)) {
      stage.destroy();
    }
    persistentVisualSurface.remove();
    persistentVisualSurface = null;
  }
  removePersistentVisualCommit?.();
  removePersistentVisualCommit = null;
  const removeResetListener = removePersistentVisualReset;
  removePersistentVisualReset = null;
  // Set deletion is safe while the engine is iterating reset callbacks and
  // also prevents a retained callback when teardown happens for another cause.
  removeResetListener?.();
  persistentVisualFrameEngine = null;
}

const info = <const>{
  name: "DynamicPlugin",
  version: version,
  parameters: {
    /** Canvas design dimensions and styles */
    __canvasStyles: {
      type: ParameterType.COMPLEX,
      default: { width: 1024, height: 768 },
    },
    /** Array of component configurations for stimulus display */
    components: {
      type: ParameterType.COMPLEX,
      array: true,
      default: [],
    },
    /** Array of response component configurations */
    response_components: {
      type: ParameterType.COMPLEX,
      array: true,
      default: [],
    },
    /** If true, all response components must provide a valid response before the trial can end
     * via participant action. Respects each component's own validation rules (allow_blanks,
     * require_movement, etc.). Does NOT block trial end caused by trial_duration timeout. */
    require_response: {
      type: ParameterType.BOOL,
      default: false,
    },
    /** How long to wait for the participant to make a response before ending the trial in milliseconds. If the participant
     * fails to make a response before this timer is reached, the participant's response will be recorded as null for the trial
     * and the trial will end. If the value of this parameter is null, then the trial will wait for a response indefinitely. */
    trial_duration: {
      type: ParameterType.INT,
      default: null,
    },
    /** If true, then the trial will end whenever the participant makes a response (assuming they make their response
     * before the cutoff specified by the `trial_duration` parameter). If false, then the trial will continue until the
     * value for `trial_duration` is reached. You can set this parameter to `false` to force the participant to view a
     * stimulus for a fixed amount of time, even if they respond before the time is complete. */
    response_ends_trial: {
      type: ParameterType.BOOL,
      default: true,
    },
    /** Controls whether Dynamic timing and response audit fields are written to the trial data. */
    dynamic_csv_diagnostics: {
      type: ParameterType.STRING,
      pretty_name: "Dynamic CSV Audit Data",
      default: "off",
      description:
        "off = normal CSV only, summary = aggregate quality fields, full = benchmark/debug arrays",
    },
    /** If true, image assets referenced by the dynamic trial are loaded before the first visible frame. */
    preload_assets: {
      type: ParameterType.BOOL,
      default: true,
    },
    /** Maximum time to wait for each image preload before continuing, in milliseconds. */
    asset_preload_timeout: {
      type: ParameterType.INT,
      default: 10000,
    },
    /** If true, save the measured requestAnimationFrame intervals for lag diagnostics. */
    record_frame_timing: {
      type: ParameterType.BOOL,
      default: false,
    },
    /** Frame interval, in milliseconds, above which a frame is counted as lagged. */
    frame_lag_threshold: {
      type: ParameterType.INT,
      default: 34,
    },
    /** If true, preload assets from upcoming DynamicPlugin trials in the background during the current trial. */
    prefetch_next_trials: {
      type: ParameterType.BOOL,
      default: true,
    },
    /** Number of upcoming DynamicPlugin trials to prefetch when jsPsych's timeline is discoverable. */
    prefetch_trial_count: {
      type: ParameterType.INT,
      default: 3,
    },
    /** Maximum absolute timing error tolerated before marking the trial as bad. */
    timing_quality_bad_threshold: {
      type: ParameterType.INT,
      default: 50,
    },
    /** Rendering backend for timing-critical visual components. */
    render_backend: {
      type: ParameterType.STRING,
      default: "webgl-strict",
    },
    /** If true, save CPU-side renderer commit diagnostics. */
    record_render_timing: {
      type: ParameterType.BOOL,
      default: false,
    },
    /** Controls how much diagnostic time-series data is saved. */
    diagnostics_level: {
      type: ParameterType.STRING,
      default: "off",
    },
          /** If true, use WebGL disjoint timer queries when the browser exposes them. */
          record_gpu_timing: {
            type: ParameterType.BOOL,
            default: false,
          },
          /**
           * Prepare-time GPU synchronization: "none" (default, commands are
           * only issued), "fence" (WebGL2 fenceSync + bounded clientWaitSync)
           * or "finish" (gl.finish()). Only ever runs during preparation,
           * never inside the critical rAF tick.
           */
          gpu_prepare_sync: {
            type: ParameterType.STRING,
            default: "none",
          },
    response_timing_enabled: {
      type: ParameterType.BOOL,
      default: true,
    },
    response_required: {
      type: ParameterType.BOOL,
      default: false,
    },
    response_allowed_from: {
      type: ParameterType.COMPLEX,
      default: "trial_onset",
    },
    /** Visual-boundary policy. Builder milliseconds default to `nearest_frame` (minimizes |actualDuration-requestedDuration|); the other policies remain for explicit semantics. */
    boundary_policy: {
      type: ParameterType.STRING,
      default: "nearest_frame",
    },
    /** Required frame count for frame_count paradigms. */
    boundary_frame_count: {
      type: ParameterType.INT,
      default: null,
    },
    /**
     * Schedule reference for fixed-duration boundaries.
     * `relative_duration` (default) re-anchors every target to the previous
     * actual commit — constant per-stimulus duration, minimal
     * |actualDuration-requestedDuration|, explicit global drift.
     * `absolute_phase` keeps the global ideal timeline anchored — one
     * boundary's error never shifts future targets (frame counts are
     * distributed, e.g. 7/8 at 144 Hz).
     */
    schedule_reference: {
      type: ParameterType.STRING,
      default: "relative_duration",
    },
    /**
     * P1.1: how an early response interacts with the ideal phase timeline.
     * `rebase_on_event` (default): the next duration starts from the
     * response boundary's effective commit (fresh phase origin).
     * `preserve_global_phase`: the ideal grid keeps the full requested
     * durations; telemetry records the drift explicitly. Never implicit.
     */
    event_phase_policy: {
      type: ParameterType.STRING,
      default: "rebase_on_event",
    },
    /**
     * P0.5: fraction of the observed frame period that PHASE A (logical
     * finalization) may consume before the trial is flagged as
     * precision-degraded. The phase must be O(1) and normally stays far
     * below this budget.
     */
    phase_a_budget_fraction: {
      type: ParameterType.FLOAT,
      default: 0.5,
    },
    /** Selects the primary `rt` anchor while all anchor-specific RTs remain exported. */
    response_rt_anchor: {
      type: ParameterType.COMPLEX,
      default: "trial_origin",
    },
    premature_response_policy: {
      type: ParameterType.STRING,
      default: "end_invalid",
    },
    response_timing_quality_mode: {
      type: ParameterType.STRING,
      default: "normal",
    },
    minimum_valid_rt_ms: {
      type: ParameterType.FLOAT,
      default: null,
    },
    response_calibration_profile: {
      type: ParameterType.COMPLEX,
      default: null,
    },
    response_expected_delay_ms: {
      type: ParameterType.FLOAT,
      default: null,
    },
    external_reference_id: {
      type: ParameterType.STRING,
      default: null,
    },
  },
  data: {
    /** The response time in milliseconds for the participant to make a response. The time is measured from when the trial
     * starts until the participant's response. */
    rt: {
      type: ParameterType.FLOAT,
    },
    timing_method: {
      type: ParameterType.STRING,
    },
    timing_schema_version: {
      type: ParameterType.INT,
    },
    trial_time_origin: {
      type: ParameterType.FLOAT,
    },
    trial_time_origin_source: {
      type: ParameterType.STRING,
    },
    trial_onset_time: {
      type: ParameterType.FLOAT,
    },
    trial_offset_time: {
      type: ParameterType.FLOAT,
    },
    actual_trial_duration: {
      type: ParameterType.FLOAT,
    },
    trial_duration_policy: {
      type: ParameterType.STRING,
    },
    stimulus_onset_policy: {
      type: ParameterType.STRING,
    },
    stimulus_offset_policy: {
      type: ParameterType.STRING,
    },
    duration_error: {
      type: ParameterType.FLOAT,
    },
    trial_ended_by_response: {
      type: ParameterType.BOOL,
    },
    frame_count: {
      type: ParameterType.INT,
    },
    long_frame_count: {
      type: ParameterType.INT,
    },
    dropped_frame_count: {
      type: ParameterType.INT,
    },
    estimated_dropped_frame_count: {
      type: ParameterType.INT,
    },
    frame_interval_source: {
      type: ParameterType.STRING,
    },
    max_frame_interval: {
      type: ParameterType.FLOAT,
    },
    mean_frame_interval: {
      type: ParameterType.FLOAT,
    },
    frame_interval_estimate: {
      type: ParameterType.FLOAT,
    },
    frame_intervals: {
      type: ParameterType.STRING,
    },
    stimulus_timing: {
      type: ParameterType.STRING,
    },
    timing_quality: {
      type: ParameterType.STRING,
    },
    timing_quality_reason: {
      type: ParameterType.STRING,
    },
    visual_timing_quality: {
      type: ParameterType.STRING,
    },
    dynamic_trial_sequence: {
      type: ParameterType.INT,
    },
    dynamic_next_trial_sequence: {
      type: ParameterType.INT,
    },
    visual_stimulus: {
      type: ParameterType.STRING,
    },
    visual_expected_duration: {
      type: ParameterType.FLOAT,
    },
    visual_onset_commit_time: {
      type: ParameterType.FLOAT,
    },
    visual_onset_frame_time: {
      type: ParameterType.FLOAT,
    },
    visual_offset_commit_time: {
      type: ParameterType.FLOAT,
    },
    visual_offset_frame_time: {
      type: ParameterType.FLOAT,
    },
    visual_duration: {
      type: ParameterType.FLOAT,
    },
    visual_duration_error: {
      type: ParameterType.FLOAT,
    },
    visual_duration_source: {
      type: ParameterType.STRING,
    },
    visual_next_onset_commit_time: {
      type: ParameterType.FLOAT,
    },
    visual_next_stimulus: {
      type: ParameterType.STRING,
    },
    previous_visual_trial_sequence: {
      type: ParameterType.INT,
    },
    previous_visual_stimulus: {
      type: ParameterType.STRING,
    },
    previous_visual_onset_commit_time: {
      type: ParameterType.FLOAT,
    },
    previous_visual_offset_commit_time: {
      type: ParameterType.FLOAT,
    },
    previous_visual_duration: {
      type: ParameterType.FLOAT,
    },
    previous_visual_duration_error: {
      type: ParameterType.FLOAT,
    },
    previous_visual_duration_source: {
      type: ParameterType.STRING,
    },
    persistent_visual_boundary: {
      type: ParameterType.BOOL,
    },
    persistent_visual_boundary_lead_ms: {
      type: ParameterType.FLOAT,
    },
    timing_continuity: {
      type: ParameterType.STRING,
    },
    timing_lost_reason: {
      type: ParameterType.STRING,
    },
    trial_end_alignment: {
      type: ParameterType.STRING,
    },
    trial_end_request_time: {
      type: ParameterType.FLOAT,
    },
    trial_end_commit_time: {
      type: ParameterType.FLOAT,
    },
    visual_transition_timing: {
      type: ParameterType.COMPLEX,
    },
    transition_target_time: { type: ParameterType.FLOAT },
    transition_target_frame_index: { type: ParameterType.INT },
    transition_actual_rAF_timestamp: { type: ParameterType.FLOAT },
    transition_actual_frame_index: { type: ParameterType.INT },
    transition_commit_timestamp: { type: ParameterType.FLOAT },
    transition_frame_interval_estimate: { type: ParameterType.FLOAT },
    transition_phase_error: { type: ParameterType.FLOAT },
    transition_deadline_error: { type: ParameterType.FLOAT },
    transition_dropped_frames_since_previous: { type: ParameterType.INT },
    transition_incoming_state_ready_time: { type: ParameterType.FLOAT },
    transition_boundary_processing_duration: { type: ParameterType.FLOAT },
    precision_path: { type: ParameterType.STRING },
    precision_path_active: { type: ParameterType.BOOL },
    precision_fallback_reason: { type: ParameterType.STRING },
    precision_ready: { type: ParameterType.BOOL },
    precision_ready_at: { type: ParameterType.FLOAT },
    precision_ready_reason: { type: ParameterType.STRING },
    resource_ready_at: { type: ParameterType.FLOAT },
    gpu_ready_at: { type: ParameterType.FLOAT },
    early_transition_eligible: { type: ParameterType.BOOL },
    early_transition_rejected_reason: { type: ParameterType.STRING },
    boundary_policy: { type: ParameterType.STRING },
    target_frame_index: { type: ParameterType.INT },
    actual_frame_index: { type: ParameterType.INT },
    frames_presented: { type: ParameterType.INT },
    target_time: { type: ParameterType.FLOAT },
    actual_raf_timestamp: { type: ParameterType.FLOAT },
    deadline_error_ms: { type: ParameterType.FLOAT },
    boundary_tolerance_applied_ms: { type: ParameterType.FLOAT },
    selected_frame_policy: { type: ParameterType.STRING },
    absolute_duration_error_ms: { type: ParameterType.FLOAT },
    minimum_frame_constraint_applied: { type: ParameterType.BOOL },
    unconstrained_nearest_frame_count: { type: ParameterType.INT },
    frame_clock_warmup_frames: { type: ParameterType.INT },
    frame_clock_warmup_duration_ms: { type: ParameterType.FLOAT },
    frame_clock_warmup_refresh_hz: { type: ParameterType.FLOAT },
    frame_clock_warmup_confidence: { type: ParameterType.FLOAT },
    frame_clock_warmup_timeout: { type: ParameterType.BOOL },
    frame_clock_warmup_regime_generation: { type: ParameterType.INT },
    schedule_reference: { type: ParameterType.STRING },
    ideal_absolute_target: { type: ParameterType.FLOAT },
    actual_absolute_error: { type: ParameterType.FLOAT },
    cumulative_phase_error: { type: ParameterType.FLOAT },
    per_stimulus_duration_error: { type: ParameterType.FLOAT },
    boundary_missed_reason: { type: ParameterType.STRING },
    boundary_initial_due_frame: { type: ParameterType.INT },
    boundary_actual_commit_frame: { type: ParameterType.INT },
    extra_frames_held: { type: ParameterType.INT },
    incoming_ready_after_target_ms: { type: ParameterType.FLOAT },
    precision_path_degraded: { type: ParameterType.BOOL },
    critical_dom_mutation_count: { type: ParameterType.INT },
    precision_prefetch_authority: { type: ParameterType.STRING },
    logical_finalize_deferred: { type: ParameterType.BOOL },
    critical_logical_finalize_duration_ms: { type: ParameterType.FLOAT },
    deferred_finalize_duration_ms: { type: ParameterType.FLOAT },
    gpu_prepare_sync_mode: { type: ParameterType.STRING },
    gpu_prepare_sync_confirmed: { type: ParameterType.BOOL },
    gpu_prepare_sync_duration_ms: { type: ParameterType.FLOAT },
    gpu_prepare_sync_error: { type: ParameterType.STRING },
    predictor_confidence: { type: ParameterType.FLOAT },
    phase_prediction_uncertainty_ms: { type: ParameterType.FLOAT },
    early_error_ms: { type: ParameterType.FLOAT },
    late_error_ms: { type: ParameterType.FLOAT },
    cumulative_deadline_error_ms: { type: ParameterType.FLOAT },
    incoming_ready_before_boundary: { type: ParameterType.BOOL },
    incoming_ready_lead_ms: { type: ParameterType.FLOAT },
    atomic_transition_used: { type: ParameterType.BOOL },
    visual_commit_count_for_boundary: { type: ParameterType.INT },
    timing_prepare_status: {
      type: ParameterType.STRING,
    },
    timing_prepare_started_at: {
      type: ParameterType.FLOAT,
    },
    timing_prepare_ready_at: {
      type: ParameterType.FLOAT,
    },
    timing_activation_path: {
      type: ParameterType.STRING,
    },
    timing_prepared_resources_used: {
      type: ParameterType.INT,
    },
    response_timing_quality: {
      type: ParameterType.STRING,
    },
    response_timing_quality_reason: {
      type: ParameterType.STRING,
    },
    diagnostics_level: {
      type: ParameterType.STRING,
    },
    render_backend_requested: {
      type: ParameterType.STRING,
    },
    render_backend: {
      type: ParameterType.STRING,
    },
    visual_backend: {
      type: ParameterType.STRING,
    },
    visual_all_commits_rAF: {
      type: ParameterType.BOOL,
    },
    visual_all_commits_frame_synced: {
      type: ParameterType.BOOL,
    },
    commit_outside_raf_count: {
      type: ParameterType.INT,
    },
    commit_unsynced_count: {
      type: ParameterType.INT,
    },
    buffer_strategy: {
      type: ParameterType.STRING,
    },
    commit_count: {
      type: ParameterType.INT,
    },
    commit_durations: {
      type: ParameterType.STRING,
    },
    mean_commit_duration: {
      type: ParameterType.FLOAT,
    },
    max_commit_duration: {
      type: ParameterType.FLOAT,
    },
    draw_call_count: {
      type: ParameterType.INT,
    },
    texture_uploads_during_trial: {
      type: ParameterType.INT,
    },
    buffer_uploads_during_trial: {
      type: ParameterType.INT,
    },
    shader_compiles_during_trial: {
      type: ParameterType.INT,
    },
    webgl_context_lost_count: {
      type: ParameterType.INT,
    },
    gpu_timer_available: {
      type: ParameterType.BOOL,
    },
    gpu_draw_durations: {
      type: ParameterType.STRING,
    },
    mean_gpu_draw_duration: {
      type: ParameterType.FLOAT,
    },
    max_gpu_draw_duration: {
      type: ParameterType.FLOAT,
    },
    gpu_pending_query_count: {
      type: ParameterType.INT,
    },
    gpu_disjoint_count: {
      type: ParameterType.INT,
    },
    dom_interactive_components: {
      type: ParameterType.STRING,
    },
    dom_visual_components: {
      type: ParameterType.INT,
    },
    dom_visual_component_names: {
      type: ParameterType.STRING,
    },
    rt_raw: {
      type: ParameterType.FLOAT,
    },
    rt_trial_origin: {
      type: ParameterType.FLOAT,
    },
    rt_scheduled_onset: {
      type: ParameterType.FLOAT,
    },
    rt_visual_commit: {
      type: ParameterType.FLOAT,
    },
    rt_anchor: {
      type: ParameterType.STRING,
    },
    rt_anchor_component: {
      type: ParameterType.STRING,
    },
    rt_anchor_time_abs: {
      type: ParameterType.FLOAT,
    },
    rt_from_allowed_onset: {
      type: ParameterType.FLOAT,
    },
    rt_corrected: {
      type: ParameterType.FLOAT,
    },
    response_timing_enabled: {
      type: ParameterType.BOOL,
    },
    response_required: {
      type: ParameterType.BOOL,
    },
    response_allowed_from: {
      type: ParameterType.STRING,
    },
    response_allowed_from_abs: {
      type: ParameterType.FLOAT,
    },
    premature_response_policy: {
      type: ParameterType.STRING,
    },
    response_timing_quality_mode: {
      type: ParameterType.STRING,
    },
    minimum_valid_rt_ms: {
      type: ParameterType.FLOAT,
    },
    response_before_trial_onset: {
      type: ParameterType.BOOL,
    },
    response_before_trial_onset_time: {
      type: ParameterType.FLOAT,
    },
    response_timeout: {
      type: ParameterType.BOOL,
    },
    response_timeout_ms: {
      type: ParameterType.FLOAT,
    },
    response_time: {
      type: ParameterType.FLOAT,
    },
    response_now_at_handler: {
      type: ParameterType.FLOAT,
    },
    response_timestamp_source: {
      type: ParameterType.STRING,
    },
    response_event_lag: {
      type: ParameterType.FLOAT,
    },
    response_bias_correction_ms: {
      type: ParameterType.FLOAT,
    },
    response_calibration_profile_id: {
      type: ParameterType.STRING,
    },
    response_calibration_match_status: {
      type: ParameterType.STRING,
    },
    response_event_type: {
      type: ParameterType.STRING,
    },
    response_device: {
      type: ParameterType.STRING,
    },
    response_key: {
      type: ParameterType.STRING,
    },
    response_code: {
      type: ParameterType.STRING,
    },
    response_repeat: {
      type: ParameterType.BOOL,
    },
    response_is_trusted: {
      type: ParameterType.BOOL,
    },
    response_valid: {
      type: ParameterType.BOOL,
    },
    response_invalid_reason: {
      type: ParameterType.STRING,
    },
    response_client_x: {
      type: ParameterType.FLOAT,
    },
    response_client_y: {
      type: ParameterType.FLOAT,
    },
    response_canvas_x: {
      type: ParameterType.FLOAT,
    },
    response_canvas_y: {
      type: ParameterType.FLOAT,
    },
    device_pixel_ratio: {
      type: ParameterType.FLOAT,
    },
    canvas_bounding_rect: {
      type: ParameterType.STRING,
    },
    response_target_component: {
      type: ParameterType.STRING,
    },
    document_hidden_during_trial: {
      type: ParameterType.BOOL,
    },
    window_blur_during_trial: {
      type: ParameterType.BOOL,
    },
    response_expected_delay_ms: {
      type: ParameterType.FLOAT,
    },
    response_reference_delay_ms: {
      type: ParameterType.FLOAT,
    },
    external_reference_id: {
      type: ParameterType.STRING,
    },
    response_error_ms: {
      type: ParameterType.FLOAT,
    },
    response_reference_error_ms: {
      type: ParameterType.FLOAT,
    },
    response_listener_attached: {
      type: ParameterType.BOOL,
    },
    response_listener_removed: {
      type: ParameterType.BOOL,
    },
  },
};

type Info = typeof info;

// Map component type names to their classes
const COMPONENT_MAP: Record<string, any> = {
  ImageComponent,
  VideoComponent,
  HtmlComponent,
  TextComponent,
  AudioComponent,
};

const RESPONSE_COMPONENT_MAP: Record<string, any> = {
  ButtonResponseComponent,
  ClickResponseComponent,
  SliderResponseComponent,
  KeyboardResponseComponent,
  InputResponseComponent,
  SurveyComponent,
  SketchpadComponent,
  AudioResponseComponent,
  FileUploadResponseComponent,
};

function isImageUrl(value: string): boolean {
  if (!value) return false;
  try {
    const url = new URL(value, window.location.href);
    return /\.(jpg|jpeg|png|gif|bmp|svg|webp)(\?.*)?$/i.test(url.pathname);
  } catch {
    return /\.(jpg|jpeg|png|gif|bmp|svg|webp)(\?.*)?$/i.test(value);
  }
}

function emptyAssetPreloadList(): AssetPreloadList {
  return { images: [], audio: [], video: [] };
}

function mergeAssetPreloadLists(
  ...lists: AssetPreloadList[]
): AssetPreloadList {
  const merged = emptyAssetPreloadList();
  for (const list of lists) {
    merged.images.push(...list.images);
    merged.audio.push(...list.audio);
    merged.video.push(...list.video);
  }
  merged.images = [...new Set(merged.images.filter(Boolean))];
  merged.audio = [...new Set(merged.audio.filter(Boolean))];
  merged.video = [...new Set(merged.video.filter(Boolean))];
  return merged;
}

function collectAssetPreloadList(
  components: Array<{ config: any }>,
): AssetPreloadList {
  const assets = emptyAssetPreloadList();
  for (const { config } of components) {
    if (
      config.type === "ImageComponent" &&
      typeof config.stimulus === "string"
    ) {
      assets.images.push(config.stimulus);
    }
    if (
      config.type === "AudioComponent" &&
      typeof config.stimulus === "string"
    ) {
      assets.audio.push(config.stimulus);
    }
    if (config.type === "VideoComponent" && Array.isArray(config.stimulus)) {
      assets.video.push(
        ...config.stimulus.filter((src: any) => typeof src === "string"),
      );
    }
    if (
      config.type === "SketchpadComponent" &&
      typeof config.background_image === "string"
    ) {
      assets.images.push(config.background_image);
    }
    if (
      config.type === "ButtonResponseComponent" &&
      Array.isArray(config.choices)
    ) {
      for (const choice of config.choices) {
        if (typeof choice === "string" && isImageUrl(choice)) {
          assets.images.push(choice);
        }
      }
    }
  }
  return mergeAssetPreloadLists(assets);
}

function collectAssetPreloadListFromTrial(trial: any): AssetPreloadList {
  const configs = [
    ...(Array.isArray(trial?.components) ? trial.components : []),
    ...(Array.isArray(trial?.response_components)
      ? trial.response_components
      : []),
  ].map((config: any) => ({ config }));
  return collectAssetPreloadList(configs);
}

function flattenTimelineDescriptions(nodes: any[]): any[] {
  const flat: any[] = [];
  for (const node of nodes || []) {
    if (Array.isArray(node?.timeline)) {
      flat.push(...flattenTimelineDescriptions(node.timeline));
    } else {
      flat.push(node);
    }
  }
  return flat;
}

function collectUpcomingAssetPreloadList(
  jsPsych: any,
  trialCount: number,
): AssetPreloadList {
  const rootTimeline = jsPsych?.timeline?.description;
  if (!Array.isArray(rootTimeline)) return emptyAssetPreloadList();

  const flatTrials = flattenTimelineDescriptions(rootTimeline);
  const currentTrialIndex =
    jsPsych?.getProgress?.()?.current_trial_global ?? -1;
  const upcomingTrials = flatTrials.slice(
    currentTrialIndex + 1,
    currentTrialIndex + 1 + trialCount,
  );

  return mergeAssetPreloadLists(
    ...upcomingTrials.map((trial) => collectAssetPreloadListFromTrial(trial)),
  );
}

function attachPrecisionTiming(
  config: any,
  timing: ReturnType<typeof createPrecisionTiming>,
) {
  Object.defineProperty(config, "__timing", {
    value: timing,
    enumerable: false,
    configurable: true,
  });
}

function attachResponseTiming(
  config: any,
  responseTiming: ResponseTimingManager,
) {
  Object.defineProperty(config, "__responseTiming", {
    value: responseTiming,
    enumerable: false,
    configurable: true,
  });
}

function getStableComponentId(config: any, fallback: string) {
  const raw =
    config.component_id ??
    config.componentId ??
    config.builder_id ??
    config.builderId ??
    config.id ??
    config.uuid ??
    fallback;
  return String(resolveRawValue(raw) ?? fallback);
}

function roundTiming(value: number | null): number | null {
  return value === null ? null : Math.round(value * 1000) / 1000;
}

function getPrimaryStimulusRecord(records: any[]) {
  return (
    records.find((record) => typeof record?.frame_onset_abs === "number") ??
    records[0] ??
    null
  );
}

function getPrimaryStimulusValue(stimulusComponents: Array<{ config: any }>) {
  const primary = stimulusComponents[0]?.config;
  if (!primary) return null;
  const raw =
    primary.stimulus ??
    primary.text ??
    primary.html ??
    primary.content ??
    primary.name ??
    null;
  const value = resolveRawValue(raw);
  return value === null || value === undefined ? null : String(value);
}

function findPrimaryVisualTimingRecord(
  timing: ReturnType<typeof createPrecisionTiming>,
  stimulusComponents: Array<{ config: any }>,
) {
  const primary = stimulusComponents[0]?.config;
  if (!primary) return null;
  return (
    timing.findStimulusRecord?.(
      primary.__componentId ?? primary.builder_id ?? primary.id ?? null,
      primary.name ?? primary.type ?? null,
    ) ?? null
  );
}

function resolveRawValue(value: any) {
  return value && typeof value === "object" && "value" in value
    ? value.value
    : value;
}

function componentLabel(config: any) {
  return config.name ? `${config.name}:${config.type}` : String(config.type);
}

function usesWholeTrialStimulusWindow(
  config: any,
  trialDuration: number | null,
) {
  const onset = resolveTimingMs(config.stimulus_onset, null);
  const duration = resolveTimingMs(config.stimulus_duration, null);
  const occupiesUntilBoundary =
    duration === null ||
    (trialDuration !== null && Math.abs(duration - trialDuration) < 0.001);
  return (onset === null || onset === 0) && occupiesUntilBoundary;
}

function isFrameBoundaryVisualTrial(
  trialDuration: number | null,
  stimulusComponents: Array<{ config: any }>,
  responseComponents: Array<{ config: any }>,
) {
  // P1.1/P1.2 (iteración 4): clasificar responses por si requieren
  // pixels/DOM visuales. Keyboard nunca dibuja UI. ClickResponseComponent
  // dibuja sólo un overlay transparente de captura (sin píxeles) cuando el
  // marker está desactivado; con marker activo sigue fuera del fast path.
  const responsesDoNotDrawVisuals = responseComponents.every(
    ({ config }) => {
      const type = String(resolveRawValue(config.type) ?? "");
      if (type === "KeyboardResponseComponent") return true;
      if (
        type === "ClickResponseComponent" &&
        resolveRawValue(config.show_click_marker) === false &&
        resolveRawValue(config.capture_full_screen) !== false &&
        resolveRawValue(config.relative_to_element) !== true &&
        !resolveRawValue(config.target_selector)
      ) {
        return true;
      }
      return false;
    },
  );

  const visualStimuli = stimulusComponents.filter(
    ({ config }) =>
      String(resolveRawValue(config.type) ?? "") !== "AudioComponent",
  );
  const audioDoesNotAddDomVisuals = stimulusComponents
    .filter(
      ({ config }) =>
        String(resolveRawValue(config.type) ?? "") === "AudioComponent",
    )
    .every(({ config }) => resolveRawValue(config.show_controls) !== true);
  // P0.2 (iteración 5): la elegibilidad ya no exige que cada estímulo ocupe
  // TODA la ventana del trial — los estímulos segmentados (onset/duration
  // explícitos) se temporizan como transiciones visuales del FrameEngine y
  // el boundary del trial sigue cerrando todo lo visible.
  const usesPersistentBackend = visualStimuli.every(({ config }) => {
    const type = String(resolveRawValue(config.type) ?? "");
    return (
      type === "ImageComponent" ||
      (type === "TextComponent" && !isClozeTextComponent(config))
    );
  });

  return (
    (trialDuration === null || trialDuration > 0) &&
    responsesDoNotDrawVisuals &&
    audioDoesNotAddDomVisuals &&
    visualStimuli.length > 0 &&
    usesPersistentBackend
  );
}

function isStaticPreparationValue(value: any, seen = new Set<any>()): boolean {
  if (typeof value === "function") return false;
  if (value === null || typeof value !== "object") return true;
  if (seen.has(value)) return true;
  if (value?.constructor?.name === "TimelineVariable") return false;
  seen.add(value);
  const entries = Array.isArray(value) ? value : Object.values(value);
  return entries.every((entry) => isStaticPreparationValue(entry, seen));
}

function isStaticallyPreparable(
  rawTrial: any,
  presentationStatic = false,
): boolean {
  if (!rawTrial || typeof rawTrial !== "object") return false;
  if (typeof rawTrial.on_start === "function" && !presentationStatic) {
    return false;
  }
  return Object.keys(info.parameters).every((parameterName) =>
    isStaticPreparationValue(rawTrial[parameterName]),
  );
}

function materializeStaticTrial(rawTrial: any) {
  const trial = {
    ...rawTrial,
    components: Array.isArray(rawTrial?.components)
      ? rawTrial.components.map((component: any) => ({ ...component }))
      : [],
    response_components: Array.isArray(rawTrial?.response_components)
      ? rawTrial.response_components.map((component: any) => ({ ...component }))
      : [],
  };
  for (const [name, parameter] of Object.entries(info.parameters) as Array<
    [string, any]
  >) {
    if (trial[name] === undefined && "default" in parameter) {
      const fallback = parameter.default;
      trial[name] =
        fallback && typeof fallback === "object"
          ? Array.isArray(fallback)
            ? [...fallback]
            : { ...fallback }
          : fallback;
    }
  }
  return trial;
}

function stableResourceValue(value: any): any {
  const resolved = resolveRawValue(value);
  if (resolved === null || typeof resolved !== "object") {
    return typeof resolved === "function" ? String(resolved) : resolved;
  }
  if (Array.isArray(resolved)) {
    return resolved.map(stableResourceValue);
  }
  return Object.fromEntries(
    Object.keys(resolved)
      .sort()
      .map((key) => [key, stableResourceValue(resolved[key])]),
  );
}

/**
 * Deterministic identity of the resources/drawables produced from the fully
 * materialized trial. Administrative data and response configuration are
 * intentionally excluded.
 */
function createPreparedVisualResourceKey(rawTrial: any): string {
  const trial = materializeStaticTrial(rawTrial);
  const canvasStyles = resolveRawValue(trial.__canvasStyles) ?? {};
  const dpr =
    typeof window !== "undefined" && Number.isFinite(window.devicePixelRatio)
      ? window.devicePixelRatio
      : 1;
  const backend = String(resolveRawValue(trial.render_backend) ?? "webgl-strict");
  const visualResources = trial.components.map((config: any) => {
    const type = String(resolveRawValue(config.type) ?? "");
    if (type === "ImageComponent") {
      const coordinates = resolveRawValue(config.coordinates) ?? { x: 0, y: 0 };
      return [
        "image-v1",
        stableResourceValue(config.stimulus),
        resolveRawValue(config.width) ?? null,
        resolveRawValue(config.height) ?? null,
        resolveRawValue(config.maintain_aspect_ratio) ?? true,
        Number(coordinates.x ?? 0),
        Number(coordinates.y ?? 0),
        Number(resolveRawValue(config.zIndex) ?? 0),
        Number(resolveRawValue(config.rotation) ?? 0),
        Number(resolveRawValue(config.opacity) ?? 1),
        String(resolveRawValue(config.rendering_mode) ?? backend),
      ];
    }
    if (type === "TextComponent") {
      return [
        "text-v1",
        getTextResourceSignature({ ...config, __canvasStyles: canvasStyles }, dpr),
        String(resolveRawValue(config.rendering_mode) ?? backend),
      ];
    }
    // Non-visual/resource components are represented only by their resource
    // identity so a template can never carry a different prepared asset.
    return [
      "resource-v1",
      type,
      stableResourceValue(config.stimulus ?? null),
      resolveRawValue(config.show_controls) ?? null,
    ];
  });
  return JSON.stringify([
    "dynamic-prepared-visual-v1",
    Number(resolveRawValue(canvasStyles.width) ?? 1024),
    Number(resolveRawValue(canvasStyles.height) ?? 768),
    stableResourceValue(resolveRawValue(canvasStyles.backgroundColor) ?? null),
    dpr,
    backend,
    visualResources,
  ]);
}

function isClozeTextComponent(config: any) {
  const text = String(resolveRawValue(config.text) ?? "");
  const parts = text.split("%");
  return parts.length >= 3 && parts.length % 2 === 1;
}

function auditDomLayers(stimulusComponents: any[], responseComponents: any[]) {
  const domInteractiveComponents = responseComponents.map(({ config }) =>
    componentLabel(config),
  );
  const domVisualComponentNames: string[] = [];

  for (const { config } of stimulusComponents) {
    if (config.type === "TextComponent" && isClozeTextComponent(config)) {
      domInteractiveComponents.push(componentLabel(config));
      continue;
    }

    if (config.type === "HtmlComponent" || config.type === "VideoComponent") {
      domVisualComponentNames.push(componentLabel(config));
    }
  }

  return {
    dom_interactive_components: domInteractiveComponents,
    dom_visual_components: domVisualComponentNames.length,
    dom_visual_component_names: domVisualComponentNames,
  };
}

type DiagnosticsLevel = "off" | "summary" | "stimulus" | "frame" | "debug";

function normalizeDiagnosticsLevel(raw: any): DiagnosticsLevel {
  const value = String(resolveRawValue(raw) ?? "off").toLowerCase();
  if (value === "full") return "debug";
  if (
    value === "off" ||
    value === "summary" ||
    value === "stimulus" ||
    value === "frame" ||
    value === "debug"
  ) {
    return value;
  }
  return "off";
}

function getDiagnosticsOptions(trial: any) {
  const level = normalizeDiagnosticsLevel(
    trial.dynamic_csv_diagnostics ?? trial.diagnostics_level,
  );
  const enabled = level !== "off";
  const recordFrameTiming = enabled && trial.record_frame_timing !== false;
  const recordRenderTiming = enabled && trial.record_render_timing !== false;
  const recordGpuTiming =
    level === "debug" && trial.record_gpu_timing !== false;

  return {
    level,
    recordFrameTiming,
    recordRenderTiming,
    recordGpuTiming,
    includeSummary: level !== "off",
    includeStimulusTiming: level !== "off" && level !== "summary",
    includeFrameIntervals:
      recordFrameTiming && (level === "frame" || level === "debug"),
    includeRenderSeries: recordRenderTiming && level === "debug",
    includeGpuSeries:
      recordRenderTiming && recordGpuTiming && level === "debug",
  };
}

/**
 * P1.1 (iteración 7): métricas de UN trial como DELTAS de cursores O(1)
 * capturados en la activación y en el boundary. Nunca el acumulado del stage
 * persistente — B jamás contiene A+B.
 */
function aggregateRenderMetricsFromCursors(
  starts: Array<StageMetricCursor | null>,
  ends: StageMetricCursor[],
  slices: StageMetricSeriesSlice[],
  requestedBackend: string,
) {
  const delta = (end: number, start: number | null) =>
    start === null ? end : Math.max(0, end - start);
  const commitDurations = slices.flatMap((slice) => slice.commitDurations);
  const gpuDrawDurations = slices.flatMap((slice) => slice.gpuDrawDurations);
  const max = (values: number[]) =>
    values.length > 0 ? Math.max(...values) : null;
  const commitCount = ends.reduce(
    (sum, end, index) => sum + delta(end.commit_count, starts[index]?.commit_count ?? null),
    0,
  );
  const gpuDrawCount = ends.reduce(
    (sum, end, index) => sum + delta(end.gpu_draw_count, starts[index]?.gpu_draw_count ?? null),
    0,
  );
  const commitMean = commitDurations.length === 0
    ? null
    : commitDurations.reduce((sum, value) => sum + value, 0) / commitDurations.length;
  const gpuMean = gpuDrawDurations.length === 0
    ? null
    : gpuDrawDurations.reduce((sum, value) => sum + value, 0) / gpuDrawDurations.length;
  const renderBackends = [...new Set(ends.map((cursor) => cursor.render_backend))];
  const bufferStrategies = [...new Set(ends.map((cursor) => cursor.buffer_strategy))];
  const syncModes = [...new Set(ends.map((cursor) => cursor.gpu_prepare_sync_mode))];

  return {
    render_backend_requested: requestedBackend,
    render_backend: renderBackends.join("+") || "none",
    visual_backend: renderBackends.join("+") || "none",
    visual_all_commits_frame_synced: ends.every(
      (end, index) =>
        delta(end.commit_unsynced_count, starts[index]?.commit_unsynced_count ?? null) === 0,
    ),
    commit_unsynced_count: ends.reduce(
      (sum, end, index) =>
        sum + delta(end.commit_unsynced_count, starts[index]?.commit_unsynced_count ?? null),
      0,
    ),
    visual_all_commits_rAF: ends.every(
      (end, index) =>
        delta(end.commit_unsynced_count, starts[index]?.commit_unsynced_count ?? null) === 0,
    ),
    commit_outside_raf_count: ends.reduce(
      (sum, end, index) =>
        sum + delta(end.commit_unsynced_count, starts[index]?.commit_unsynced_count ?? null),
      0,
    ),
    buffer_strategy: bufferStrategies.join("+") || "none",
    commit_count: commitCount,
    commit_durations: commitDurations.map(roundTiming),
    commit_series_truncated: slices.some((slice) => slice.truncated),
    mean_commit_duration: roundTiming(commitMean),
    max_commit_duration: roundTiming(max(commitDurations)),
    draw_call_count: ends.reduce(
      (sum, end, index) => sum + delta(end.draw_call_count, starts[index]?.draw_call_count ?? null),
      0,
    ),
    texture_uploads_during_trial: ends.reduce(
      (sum, end, index) => sum + delta(end.texture_uploads, starts[index]?.texture_uploads ?? null),
      0,
    ),
    buffer_uploads_during_trial: ends.reduce(
      (sum, end, index) => sum + delta(end.buffer_uploads, starts[index]?.buffer_uploads ?? null),
      0,
    ),
    shader_compiles_during_trial: ends.reduce(
      (sum, end, index) => sum + delta(end.shader_compiles, starts[index]?.shader_compiles ?? null),
      0,
    ),
    webgl_context_lost_count: ends.reduce(
      (sum, end, index) =>
        sum + delta(end.webgl_context_lost_count, starts[index]?.webgl_context_lost_count ?? null),
      0,
    ),
    gpu_timer_available: ends.some((cursor) => cursor.gpu_timer_available),
    gpu_draw_durations: gpuDrawDurations.map(roundTiming),
    gpu_draw_count: gpuDrawCount,
    gpu_series_truncated: slices.some((slice) => slice.truncated),
    mean_gpu_draw_duration: roundTiming(gpuMean),
    max_gpu_draw_duration: roundTiming(max(gpuDrawDurations)),
    gpu_pending_query_count: ends.reduce(
      (sum, end) => sum + end.gpu_pending_query_count,
      0,
    ),
    gpu_disjoint_count: ends.reduce(
      (sum, end, index) => sum + delta(end.gpu_disjoint_count, starts[index]?.gpu_disjoint_count ?? null),
      0,
    ),
    gpu_prepare_sync_mode: syncModes.join("+") || "none",
    gpu_prepare_sync_confirmed:
      syncModes.includes("fence")
        ? ends
            .filter((cursor) => cursor.gpu_prepare_sync_mode === "fence")
            .every((cursor) => cursor.gpu_prepare_sync_confirmed === true)
        : null,
    gpu_prepare_sync_duration_ms:
      ends.length === 0
        ? null
        : roundTiming(
            max(
              ends
                .map((cursor) => cursor.gpu_prepare_sync_duration_ms)
                .filter((value): value is number => typeof value === "number"),
            ),
          ),
    gpu_prepare_sync_error:
      ends
        .map((cursor) => cursor.gpu_prepare_sync_error)
        .filter((value): value is string => typeof value === "string")
        .join("; ") || null,
  };
}

function aggregateRenderMetrics(
  stageMetrics: StageMetrics[],
  requestedBackend: string,
) {  const commitDurations = stageMetrics.flatMap(
    (metrics) => metrics.commit_durations,
  );
  const gpuDrawDurations = stageMetrics.flatMap(
    (metrics) => metrics.gpu_draw_durations,
  );
  const max = (values: number[]) =>
    values.length > 0 ? Math.max(...values) : null;
  const commitCount = stageMetrics.reduce(
    (sum, metrics) => sum + metrics.commit_count,
    0,
  );
  const gpuDrawCount = stageMetrics.reduce(
    (sum, metrics) => sum + metrics.gpu_draw_count,
    0,
  );
  const weightedCommitMean =
    commitCount === 0
      ? null
      : stageMetrics.reduce(
          (sum, metrics) =>
            sum + (metrics.mean_commit_duration ?? 0) * metrics.commit_count,
          0,
        ) / commitCount;
  const weightedGpuMean =
    gpuDrawCount === 0
      ? null
      : stageMetrics.reduce(
          (sum, metrics) =>
            sum +
            (metrics.mean_gpu_draw_duration ?? 0) * metrics.gpu_draw_count,
          0,
        ) / gpuDrawCount;
  const renderBackends = [
    ...new Set(stageMetrics.map((m) => m.render_backend)),
  ];
  const bufferStrategies = [
    ...new Set(stageMetrics.map((m) => m.buffer_strategy)),
  ];

  return {
    render_backend_requested: requestedBackend,
    render_backend: renderBackends.join("+") || "none",
    visual_backend: renderBackends.join("+") || "none",
    visual_all_commits_frame_synced: stageMetrics.every(
      (metrics) => metrics.visual_all_commits_frame_synced,
    ),
    commit_unsynced_count: stageMetrics.reduce(
      (sum, metrics) => sum + metrics.commit_unsynced_count,
      0,
    ),
    visual_all_commits_rAF: stageMetrics.every(
      (metrics) => metrics.visual_all_commits_rAF,
    ),
    commit_outside_raf_count: stageMetrics.reduce(
      (sum, metrics) => sum + metrics.commit_outside_raf_count,
      0,
    ),
    buffer_strategy: bufferStrategies.join("+") || "none",
    commit_count: commitCount,
    commit_durations: commitDurations.map(roundTiming),
    commit_series_truncated: stageMetrics.some(
      (metrics) => metrics.commit_series_truncated,
    ),
    mean_commit_duration: roundTiming(weightedCommitMean),
    max_commit_duration: roundTiming(
      max(
        stageMetrics
          .map((metrics) => metrics.max_commit_duration)
          .filter((value): value is number => typeof value === "number"),
      ),
    ),
    draw_call_count: stageMetrics.reduce(
      (sum, metrics) => sum + metrics.draw_call_count,
      0,
    ),
    texture_uploads_during_trial: stageMetrics.reduce(
      (sum, metrics) => sum + metrics.texture_uploads_during_trial,
      0,
    ),
    buffer_uploads_during_trial: stageMetrics.reduce(
      (sum, metrics) => sum + metrics.buffer_uploads_during_trial,
      0,
    ),
    shader_compiles_during_trial: stageMetrics.reduce(
      (sum, metrics) => sum + metrics.shader_compiles_during_trial,
      0,
    ),
    webgl_context_lost_count: stageMetrics.reduce(
      (sum, metrics) => sum + metrics.webgl_context_lost_count,
      0,
    ),
    gpu_timer_available: stageMetrics.some(
      (metrics) => metrics.gpu_timer_available,
    ),
    gpu_draw_durations: gpuDrawDurations.map(roundTiming),
    gpu_draw_count: gpuDrawCount,
    gpu_series_truncated: stageMetrics.some(
      (metrics) => metrics.gpu_series_truncated,
    ),
    mean_gpu_draw_duration: roundTiming(weightedGpuMean),
    max_gpu_draw_duration: roundTiming(
      max(
        stageMetrics
          .map((metrics) => metrics.max_gpu_draw_duration)
          .filter((value): value is number => typeof value === "number"),
      ),
    ),
    gpu_pending_query_count: stageMetrics.reduce(
      (sum, metrics) => sum + metrics.gpu_pending_query_count,
      0,
    ),
    gpu_disjoint_count: stageMetrics.reduce(
      (sum, metrics) => sum + metrics.gpu_disjoint_count,
      0,
    ),
    gpu_prepare_sync_mode:
      [
        ...new Set(
          stageMetrics.map((metrics) => metrics.gpu_prepare_sync_mode),
        ),
      ].join("+") || "none",
    gpu_prepare_sync_confirmed:
      stageMetrics.some((metrics) => metrics.gpu_prepare_sync_mode === "fence")
        ? stageMetrics
            .filter((metrics) => metrics.gpu_prepare_sync_mode === "fence")
            .every((metrics) => metrics.gpu_prepare_sync_confirmed === true)
        : null,
    gpu_prepare_sync_duration_ms:
      stageMetrics.length === 0
        ? null
        : roundTiming(
            max(
              stageMetrics
                .map((metrics) => metrics.gpu_prepare_sync_duration_ms)
                .filter((value): value is number => typeof value === "number"),
            ),
          ),
    gpu_prepare_sync_error:
      stageMetrics
        .map((metrics) => metrics.gpu_prepare_sync_error)
        .filter((value): value is string => typeof value === "string")
        .join("; ") || null,
  };
}

function mergeQuality(
  visualQuality: { quality: string; reason: string },
  responseQuality: string,
  responseReason: string,
) {
  const rank: Record<string, number> = { ok: 0, warning: 1, bad: 2 };
  const visualRank = rank[visualQuality.quality] ?? 0;
  const responseRank = rank[responseQuality] ?? 0;
  const quality =
    responseRank > visualRank ? responseQuality : visualQuality.quality;
  const reasons = [visualQuality.reason, responseReason].filter(Boolean);
  return { quality, reason: reasons.join("; ") };
}

function classifyTimingQuality(
  timingSummary: any,
  desiredTrialDuration: number | null,
  badThreshold: number,
  renderMetrics?: ReturnType<typeof aggregateRenderMetrics>,
  domAudit?: ReturnType<typeof auditDomLayers>,
  options: { ignoreTrialDurationError?: boolean } = {},
) {
  const reasons: string[] = [];
  const maxFrameInterval = timingSummary.maxFrameInterval ?? 0;
  const frameMs =
    timingSummary.frameIntervalEstimate ??
    timingSummary.meanFrameInterval ??
    1000 / 60;
  const halfFrame = frameMs / 2;
  const trialDurationError =
    options.ignoreTrialDurationError ||
    desiredTrialDuration === null ||
    timingSummary.actualDuration === null
      ? 0
      : Math.abs(timingSummary.actualDuration - desiredTrialDuration);
  const stimulusTimingErrors = timingSummary.stimulusRecords.flatMap(
    (record: any) =>
      ["onset_error", "offset_error", "duration_error"].map((field) =>
        typeof record[field] === "number" ? Math.abs(record[field]) : 0,
      ),
  );
  const maxStimulusTimingError =
    stimulusTimingErrors.length > 0 ? Math.max(...stimulusTimingErrors) : 0;

  if (timingSummary.longFrameCount > 0) {
    reasons.push(`${timingSummary.longFrameCount} long frame(s)`);
  }
  if (timingSummary.droppedFrameCount > 0) {
    reasons.push(`${timingSummary.droppedFrameCount} dropped frame(s)`);
  }
  if (maxFrameInterval >= badThreshold) {
    reasons.push(`max frame ${roundTiming(maxFrameInterval)}ms`);
  }
  if (trialDurationError >= badThreshold) {
    reasons.push(`trial duration error ${roundTiming(trialDurationError)}ms`);
  }
  if (maxStimulusTimingError >= badThreshold) {
    reasons.push(
      `stimulus timing error ${roundTiming(maxStimulusTimingError)}ms`,
    );
  }
  if (renderMetrics?.visual_all_commits_rAF === false) {
    reasons.push(
      `${renderMetrics.commit_outside_raf_count} visual commit(s) outside rAF`,
    );
  }
  if ((renderMetrics?.texture_uploads_during_trial ?? 0) > 0) {
    reasons.push(
      `${renderMetrics?.texture_uploads_during_trial} texture upload(s) during trial`,
    );
  }
  if ((renderMetrics?.buffer_uploads_during_trial ?? 0) > 0) {
    reasons.push(
      `${renderMetrics?.buffer_uploads_during_trial} buffer upload(s) during trial`,
    );
  }
  if ((renderMetrics?.shader_compiles_during_trial ?? 0) > 0) {
    reasons.push(
      `${renderMetrics?.shader_compiles_during_trial} shader compile/link operation(s) during trial`,
    );
  }
  if ((renderMetrics?.webgl_context_lost_count ?? 0) > 0) {
    reasons.push(
      `${renderMetrics?.webgl_context_lost_count} WebGL context loss event(s)`,
    );
  }
  if ((domAudit?.dom_visual_components ?? 0) > 0) {
    reasons.push(
      `${domAudit?.dom_visual_components} DOM visual component(s) outside VisualRenderer`,
    );
  }

  if (
    maxFrameInterval >= badThreshold ||
    trialDurationError >= badThreshold ||
    maxStimulusTimingError >= badThreshold ||
    renderMetrics?.visual_all_commits_rAF === false ||
    (renderMetrics?.texture_uploads_during_trial ?? 0) > 0 ||
    (renderMetrics?.buffer_uploads_during_trial ?? 0) > 0 ||
    (renderMetrics?.shader_compiles_during_trial ?? 0) > 0 ||
    (renderMetrics?.webgl_context_lost_count ?? 0) > 0
  ) {
    return { quality: "bad", reason: reasons.join("; ") };
  }

  const renderCommitWarning =
    typeof renderMetrics?.max_commit_duration === "number" &&
    renderMetrics.max_commit_duration > halfFrame;
  const gpuWarning =
    typeof renderMetrics?.max_gpu_draw_duration === "number" &&
    renderMetrics.max_gpu_draw_duration > halfFrame;

  if (
    timingSummary.longFrameCount > 0 ||
    timingSummary.droppedFrameCount > 0 ||
    trialDurationError > halfFrame ||
    maxStimulusTimingError > halfFrame ||
    renderCommitWarning ||
    gpuWarning ||
    (domAudit?.dom_visual_components ?? 0) > 0 ||
    (renderMetrics?.gpu_disjoint_count ?? 0) > 0
  ) {
    if (renderCommitWarning) {
      reasons.push(
        `renderer commit ${roundTiming(renderMetrics!.max_commit_duration)}ms`,
      );
    }
    if (gpuWarning) {
      reasons.push(
        `GPU draw ${roundTiming(renderMetrics!.max_gpu_draw_duration)}ms`,
      );
    }
    if ((renderMetrics?.gpu_disjoint_count ?? 0) > 0) {
      reasons.push(
        `${renderMetrics?.gpu_disjoint_count} GPU disjoint event(s)`,
      );
    }
    return {
      quality: "warning",
      reason:
        reasons.length > 0
          ? reasons.join("; ")
          : `timing drift above half frame (${roundTiming(halfFrame)}ms)`,
    };
  }

  return { quality: "ok", reason: "" };
}

function inspectPreparedResourceReadiness(
  jsPsych: JsPsych,
  stage: CanvasStage,
  components: Array<{ config: any }>,
) {
  const audioContext = jsPsych.pluginAPI.audioContext();
  const states = components.map(({ config }) => {
    const type = String(resolveRawValue(config.type) ?? "");
    if (type === "ImageComponent") {
      const stimulus = String(resolveRawValue(config.stimulus) ?? "");
      return {
        resourceReady: getReadyPreloadedBitmap(stimulus) !== null,
        gpuReady: stage.isTextureResident(getImageTextureKey(stimulus)),
        cost: 1,
      };
    }
    if (type === "TextComponent" && !isClozeTextComponent(config)) {
      const resource = TextComponent.getPreparedVisualResource(stage, config);
      return {
        resourceReady: resource !== null,
        gpuReady:
          resource !== null && stage.isTextureResident(resource.textureKey),
        cost: 1,
      };
    }
    if (
      type === "AudioComponent" &&
      resolveRawValue(config.show_controls) !== true
    ) {
      const buffer = audioContext
        ? getPreloadedAudioBuffer(
            audioContext,
            String(resolveRawValue(config.stimulus) ?? ""),
          )
        : null;
      return { resourceReady: buffer !== null, gpuReady: true, cost: 0.5 };
    }
    if (type === "KeyboardResponseComponent") {
      return { resourceReady: true, gpuReady: true, cost: 0.5 };
    }
    if (
      type === "ClickResponseComponent" &&
      resolveRawValue(config.show_click_marker) === false &&
      resolveRawValue(config.capture_full_screen) !== false &&
      resolveRawValue(config.relative_to_element) !== true &&
      !resolveRawValue(config.target_selector)
    ) {
      return { resourceReady: true, gpuReady: true, cost: 0.5 };
    }
    return { resourceReady: false, gpuReady: false, cost: 4 };
  });
  return {
    resourceReady: states.every((state) => state.resourceReady),
    gpuReady: states.every((state) => state.gpuReady),
    estimatedMaterializationCostMs:
      0.5 + states.reduce((sum, state) => sum + state.cost, 0),
  };
}

function clonePreparedTrialResource(trial: any) {
  return {
    ...trial,
    __canvasStyles: { ...(trial.__canvasStyles ?? {}) },
    components: (trial.components ?? []).map((config: any) => ({ ...config })),
    response_components: (trial.response_components ?? []).map(
      (config: any) => ({ ...config }),
    ),
  };
}

/**
 * **DynamicPlugin**
 *
 * Plugin that dynamically renders multiple stimulus components and response components,
 * allowing for complex trial compositions with multiple elements.
 *
 * @author Builder Team
 */
class DynamicPlugin implements JsPsychPlugin<Info> {
  static info = info;

  /**
   * Core timing-intent hook. Existing Builder timelines need no new flag: a
   * literal, frame-boundary-compatible Dynamic trial opts in automatically.
   * An explicit `timing_continuous: false` is still authoritative in core.
   */
  static getTimingIntent(
    rawTrial: any,
    preparation: { presentationStatic?: boolean } = {},
  ) {
    if (
      !isStaticallyPreparable(rawTrial, preparation.presentationStatic === true)
    ) {
      return "normal";
    }
    const trial = materializeStaticTrial(rawTrial);
    const trialDuration = resolveTimingMs(trial.trial_duration, null);
    const stimuli = trial.components.map((config: any) => ({ config }));
    const responses = trial.response_components.map((config: any) => ({
      config,
    }));
    return isFrameBoundaryVisualTrial(trialDuration, stimuli, responses)
      ? "timing_continuous"
      : "normal";
  }

  readonly preserveDisplayElement = true;

  private preparedExecution: {
    trial: any;
    context: HostTrialTimingContext;
    result: Promise<any>;
    ready: Promise<void>;
    dispose: () => void;
    startLogicalLifecycle: () => void;
  } | null = null;
  private executionTiming: {
    frameEngine: HostFrameEngine;
    trialContext: HostTrialTimingContext;
    timingContinuous: boolean;
    allowEarlyActivation: boolean;
    earlyTransitionRejectedReason: string | null;
  } | null = null;
  private preparedTrialDescriptor: PreparedTrialDescriptor | null = null;
  private preparedTrialResourceTemplate: DynamicPreparedTrialResourceTemplate | null =
    null;
  private pendingPreparedMaterialization: {
    displayElement: HTMLElement;
    trial: any;
    preparation: {
      trialIndex: number | null;
      frameEngine: HostFrameEngine;
      timingContinuous: boolean;
      earlyTransitionRejectedReason?: string | null;
    };
  } | null = null;
  private preparedTrialReady = true;
  private preparedTrialFallbackReason: string | null = null;
  private prepareCpuDurationMs: number | null = null;
  private prepareCompletedDuringResponseWindow: boolean | null = null;
  private prepareCompletedNearVisualDeadline: boolean | null = null;
  // P0.1 (iteración 6): etapas del scheduler de preparación.
  private prepareResourceWaitMs: number | null = null;
  private prepareMainThreadMs: number | null = null;
  private prepareGpuMs: number | null = null;
  private preparePublishMs: number | null = null;
  private prepareMainThreadDuringResponseWindow: boolean | null = null;
  private prepareGpuDuringResponseWindow: boolean | null = null;
  private prepareCompletionDeferredUntilSafe: boolean | null = null;
  // P0.2 (iteración 7): contrato de materialización runtime response-safe.
  private runtimeMaterializationDuringResponseWindow: boolean | null = null;
  private runtimeMaterializationCostEstimateMs: number | null = null;
  private runtimeMaterializationDomMutations: number | null = null;
  private runtimeMaterializationLayoutReads: number | null = null;
  private runtimeMaterializationGpuCalls: number | null = null;
  private runtimeMaterializationCpuMs: number | null = null;

  constructor(private jsPsych: JsPsych) {}

  /** Core-owned timing authority for every DynamicPlugin execution. */
  setTrialExecutionTiming(timing: {
    frameEngine: HostFrameEngine;
    trialContext: HostTrialTimingContext;
    timingContinuous: boolean;
    allowEarlyActivation: boolean;
    earlyTransitionRejectedReason: string | null;
  }) {
    this.executionTiming = timing;
  }

  getTrialTimingContext() {
    return (
      this.preparedExecution?.context ??
      this.executionTiming?.trialContext ??
      null
    );
  }

  async prepareTrial(
    displayElement: HTMLElement,
    rawTrial: TrialType<Info>,
    preparation: {
      trialIndex: number | null;
      frameEngine: HostFrameEngine;
      timingContinuous: boolean;
      presentationStatic?: boolean;
      earlyTransitionEligible?: boolean;
      earlyTransitionRejectedReason?: string | null;
    },
  ) {
    this.preparedTrialReady = true;
    this.preparedTrialFallbackReason = null;
    this.preparedTrialDescriptor = null;
    this.preparedTrialResourceTemplate = null;
    this.pendingPreparedMaterialization = null;
    this.prepareResourceWaitMs = null;
    this.prepareMainThreadMs = null;
    this.prepareGpuMs = null;
    this.preparePublishMs = null;
    this.prepareMainThreadDuringResponseWindow = null;
    this.prepareGpuDuringResponseWindow = null;
    this.prepareCompletionDeferredUntilSafe = null;
    const trial = materializeStaticTrial(rawTrial);
    trial.timing_continuous = preparation.timingContinuous;
    const trialDuration = resolveTimingMs(trial.trial_duration, null);
    const stimulusComponents = trial.components.map((config: any) => ({
      config,
    }));
    const responseComponents = trial.response_components.map((config: any) => ({
      config,
    }));
    if (
      !preparation.timingContinuous ||
      !isStaticallyPreparable(
        rawTrial,
        preparation.presentationStatic === true,
      ) ||
      !isFrameBoundaryVisualTrial(
        trialDuration,
        stimulusComponents,
        responseComponents,
      )
    ) {
      this.preparedTrialReady = false;
      this.preparedTrialFallbackReason =
        preparation.earlyTransitionRejectedReason ??
        (!preparation.timingContinuous
          ? "trial_not_timing_continuous"
          : "dynamic_trial_not_early_transition_compatible");
      return;
    }

    const resourceStartedAt = performance.now();
    const surface = getPersistentVisualSurface(
      trial.__canvasStyles?.width ?? 1024,
      trial.__canvasStyles?.height ?? 768,
      "transparent",
    );
    bindPersistentVisualSurfaceToFrameEngine(preparation.frameEngine);
    const stage = getCanvasStage(surface, {
      width: trial.__canvasStyles?.width ?? 1024,
      height: trial.__canvasStyles?.height ?? 768,
      backgroundColor: "transparent",
      zIndex: 0,
      backend: trial.render_backend || "webgl-strict",
      recordGpuTiming: trial.record_gpu_timing !== false,
      recordCommitSeries: false,
      recordGpuSeries: false,
      gpuPrepareSync: String(trial.gpu_prepare_sync ?? "none") as any,
    });
    const components = [...stimulusComponents, ...responseComponents];
    const assets = collectAssetPreloadList(components);
    await preloadAssets(
      this.jsPsych,
      assets,
      resolveTimingMs(trial.asset_preload_timeout, 10000) ?? 10000,
    );
    this.prepareResourceWaitMs = Math.max(
      0,
      performance.now() - resourceStartedAt,
    );

    const runSafePreparationStage = (
      work: () => void | Promise<void>,
      options: { label: string; estimatedCostMs: number; gpu?: boolean },
    ) =>
      new Promise<void>((resolve, reject) => {
        const run = () => {
          const startedAt = performance.now();
          const duringResponse =
            preparation.frameEngine.getDiagnostics?.().response_sensitive ===
            true;
          const complete = () => {
            const duration = Math.max(0, performance.now() - startedAt);
            if (options.gpu) {
              this.prepareGpuMs = Math.max(
                0,
                (this.prepareGpuMs ?? 0) + duration,
              );
              this.prepareGpuDuringResponseWindow =
                this.prepareGpuDuringResponseWindow === true || duringResponse;
            } else {
              this.prepareMainThreadMs = Math.max(
                0,
                (this.prepareMainThreadMs ?? 0) + duration,
              );
              this.prepareMainThreadDuringResponseWindow =
                this.prepareMainThreadDuringResponseWindow === true ||
                duringResponse;
            }
            resolve();
          };
          try {
            const result = work();
            if (result && typeof result.then === "function") {
              void result.then(complete, reject);
            } else {
              complete();
            }
          } catch (error) {
            reject(error);
          }
        };
        const mustDefer =
          preparation.frameEngine.isRunning?.() === true &&
          (preparation.frameEngine.getDiagnostics?.().response_sensitive ===
            true ||
            preparation.frameEngine.getWorkPhase?.() === "CRITICAL");
        if (mustDefer) {
          this.prepareCompletionDeferredUntilSafe = true;
          if (!preparation.frameEngine.queuePreparationTask) {
            reject(
              new Error(
                "Global FrameEngine is missing queuePreparationTask().",
              ),
            );
            return;
          }
          preparation.frameEngine.queuePreparationTask(run, options);
        } else {
          run();
        }
      });

    await runSafePreparationStage(
      async () => {
        await Promise.all(
          stimulusComponents.map(async ({ config }) => {
            config.__canvasStyles = trial.__canvasStyles;
            const type = String(resolveRawValue(config.type) ?? "");
            if (type === "TextComponent" && !isClozeTextComponent(config)) {
              config.__textFontPreparation =
                await TextComponent.prepareFontResource(config);
            }
          }),
        );
      },
      { label: "dynamic-trial-font-prep", estimatedCostMs: 1 },
    );
    await runSafePreparationStage(
      () => {
        for (const { config } of stimulusComponents) {
          config.__canvasStyles = trial.__canvasStyles;
          const type = String(resolveRawValue(config.type) ?? "");
          if (type === "TextComponent" && !isClozeTextComponent(config)) {
            TextComponent.prepareMainResource(
              config,
              config.__textFontPreparation,
            );
          }
        }
      },
      { label: "dynamic-trial-text-main-prep", estimatedCostMs: 4 },
    );
    await runSafePreparationStage(
      () => {
        for (const { config } of stimulusComponents) {
          const type = String(resolveRawValue(config.type) ?? "");
          if (type === "ImageComponent") {
            prepareImageTexture(stage, resolveRawValue(config.stimulus));
          } else if (
            type === "TextComponent" &&
            !isClozeTextComponent(config)
          ) {
            TextComponent.prepareGpuResource(stage, config);
          }
        }
        if (String(trial.gpu_prepare_sync ?? "none") !== "none") {
          stage.syncGpuForPrepare();
        }
      },
      { label: "dynamic-trial-gpu-prep", estimatedCostMs: 3, gpu: true },
    );

    const readiness = inspectPreparedResourceReadiness(
      this.jsPsych,
      stage,
      components,
    );
    const { resourceReady, gpuReady } = readiness;
    const requiresLiveDom = !isFrameBoundaryVisualTrial(
      trialDuration,
      stimulusComponents,
      responseComponents,
    );
    const descriptor: PreparedTrialDescriptor = {
      materializationSafe: resourceReady && gpuReady && !requiresLiveDom,
      estimatedCostMs: readiness.estimatedMaterializationCostMs,
      resourceReady,
      gpuReady,
      requiresLiveDom,
      diagnostics: {
        timingAuthority: "global_frame_engine",
        imageCount: assets.images.length,
        audioCount: assets.audio.length,
      },
    };
    this.preparedTrialResourceTemplate = {
      resourceKey: createPreparedVisualResourceKey(trial),
      descriptorPublicationSafe:
        resourceReady && gpuReady && !requiresLiveDom,
      estimatedPublicationCostMs: 0.5,
      resourceReady,
      gpuReady,
      requiresLiveDom,
      payload: {
        trial: clonePreparedTrialResource(trial),
        descriptor: { ...descriptor },
        stage,
      },
    };
    await new Promise<void>((resolve) => {
      const publish = () => {
        const startedAt = performance.now();
        this.preparedTrialDescriptor = descriptor;
        this.preparePublishMs = Math.max(0, performance.now() - startedAt);
        resolve();
      };
      if (preparation.frameEngine.isRunning?.() === true) {
        preparation.frameEngine.queueSafeTask(publish, {
          label: "dynamic-trial-ready-descriptor-publication",
          estimatedCostMs: 0.1,
          responseSafe: true,
        });
      } else {
        publish();
      }
    });
    this.pendingPreparedMaterialization = {
      displayElement,
      trial,
      preparation,
    };
    if (!resourceReady || !gpuReady || requiresLiveDom) {
      this.preparedTrialReady = false;
      this.preparedTrialFallbackReason = !resourceReady
        ? "prepared_resource_not_ready"
        : !gpuReady
          ? "prepared_gpu_resource_not_ready"
          : "prepared_trial_requires_live_dom";
    }
  }

  getPreparedTrialDescriptor() {
    return this.preparedTrialDescriptor;
  }

  getPreparedTrialResourceTemplate() {
    return this.preparedTrialResourceTemplate;
  }

  getPreparedTrialResourceKey(rawTrial: TrialType<Info>) {
    return createPreparedVisualResourceKey(rawTrial);
  }

  /**
   * READY DESCRIPTOR publication. The reusable template was produced by
   * SAFE-only preparation; this path performs only bounded cloning and cache
   * residency checks. It never creates DOM, measures layout, or uploads GPU
   * resources.
   */
  publishPreparedTrialDescriptor(
    displayElement: HTMLElement,
    rawTrial: TrialType<Info>,
    preparation: {
      trialIndex: number | null;
      frameEngine: HostFrameEngine;
      timingContinuous: boolean;
      presentationStatic?: boolean;
      earlyTransitionEligible?: boolean;
      earlyTransitionRejectedReason?: string | null;
    },
    template: DynamicPreparedTrialResourceTemplate,
  ) {
    this.preparedExecution = null;
    this.pendingPreparedMaterialization = null;
    this.preparedTrialDescriptor = null;
    this.preparedTrialResourceTemplate = template;
    this.preparedTrialReady = true;
    this.preparedTrialFallbackReason = null;
    this.prepareResourceWaitMs = 0;
    this.prepareMainThreadMs = 0;
    this.prepareGpuMs = 0;
    this.prepareMainThreadDuringResponseWindow = false;
    this.prepareGpuDuringResponseWindow = false;
    this.prepareCompletionDeferredUntilSafe = false;

    const currentResourceKey = createPreparedVisualResourceKey(rawTrial);
    if (
      !preparation.timingContinuous ||
      template?.descriptorPublicationSafe !== true ||
      template.resourceKey !== currentResourceKey ||
      !template.payload?.trial ||
      !template.payload?.stage
    ) {
      this.preparedTrialReady = false;
      this.preparedTrialFallbackReason =
        preparation.earlyTransitionRejectedReason ??
        (template?.resourceKey !== currentResourceKey
          ? "prepared_resource_template_key_mismatch"
          : "prepared_resource_template_not_publishable");
      return;
    }

    const publishStartedAt = performance.now();
    const trial = materializeStaticTrial(rawTrial);
    trial.timing_continuous = true;
    const stimulusComponents = trial.components.map((config: any) => ({ config }));
    const responseComponents = trial.response_components.map((config: any) => ({
      config,
    }));
    const components = [...stimulusComponents, ...responseComponents];
    const readiness = inspectPreparedResourceReadiness(
      this.jsPsych,
      template.payload.stage,
      components,
    );
    const trialDuration = resolveTimingMs(trial.trial_duration, null);
    const requiresLiveDom = !isFrameBoundaryVisualTrial(
      trialDuration,
      stimulusComponents,
      responseComponents,
    );
    const descriptor: PreparedTrialDescriptor = {
      ...template.payload.descriptor,
      materializationSafe:
        readiness.resourceReady && readiness.gpuReady && !requiresLiveDom,
      estimatedCostMs: readiness.estimatedMaterializationCostMs,
      resourceReady: readiness.resourceReady,
      gpuReady: readiness.gpuReady,
      requiresLiveDom,
      diagnostics: {
        ...(template.payload.descriptor.diagnostics ?? {}),
        resourceTemplateReused: true,
        resourceKey: currentResourceKey,
      },
    };
    template.resourceReady = descriptor.resourceReady;
    template.gpuReady = descriptor.gpuReady;
    template.requiresLiveDom = descriptor.requiresLiveDom;
    template.descriptorPublicationSafe = descriptor.materializationSafe;
    this.preparedTrialDescriptor = descriptor;
    this.pendingPreparedMaterialization = {
      displayElement,
      trial,
      preparation,
    };
    this.preparePublishMs = Math.max(0, performance.now() - publishStartedAt);
    if (!descriptor.materializationSafe) {
      this.preparedTrialReady = false;
      this.preparedTrialFallbackReason = !descriptor.resourceReady
        ? "prepared_resource_not_ready"
        : !descriptor.gpuReady
          ? "prepared_gpu_resource_not_ready"
          : "prepared_trial_requires_live_dom";
    }
  }

  async materializePreparedTrial(descriptor: PreparedTrialDescriptor) {
    const pending = this.pendingPreparedMaterialization;
    if (!pending || descriptor !== this.preparedTrialDescriptor) {
      throw new Error("prepared_trial_descriptor_not_current");
    }
    if (!descriptor.materializationSafe) return;
    this.pendingPreparedMaterialization = null;
    const { displayElement, trial, preparation } = pending;
    const materializationStartedAt = performance.now();
    const materializationStages = persistentVisualSurface
      ? getCanvasStages(persistentVisualSurface)
      : [];
    const gpuCallsBefore = materializationStages.reduce(
      (sum, stage) => sum + stage.getGpuResourceCallCount(),
      0,
    );
    const layoutReadsBefore =
      ResponseTimingManager.getCumulativeLayoutReadCount();
    let domMutationCount = 0;
    const materializationObserver =
      typeof MutationObserver !== "undefined" && document.documentElement
        ? new MutationObserver((records) => {
            domMutationCount += records.length;
          })
        : null;
    materializationObserver?.observe(document.documentElement, {
      attributes: true,
      childList: true,
      subtree: true,
    });
    const context = preparation.frameEngine.createTrialContext({
      id: `dynamic-${dynamicTrialSequenceCounter + 1}`,
      trialIndex: preparation.trialIndex,
      continuous: true,
      allowEarlyActivation: true,
    });
    let resolveReady!: () => void;
    let rejectReady!: (error: unknown) => void;
    const ready = new Promise<void>((resolve, reject) => {
      resolveReady = resolve;
      rejectReady = reject;
    });
    const prepareCpuStartedAt = performance.now();
    this.prepareCpuDurationMs = null;
    this.prepareCompletedDuringResponseWindow = null;
    this.prepareCompletedNearVisualDeadline = null;
    let dispose = () => context.stop();
    let startLogicalLifecycle = () => {};
    const result = this.runTrial(displayElement, trial, {
      frameEngine: preparation.frameEngine,
      trialContext: context,
      timingContinuous: true,
      allowEarlyActivation: true,
      earlyTransitionRejectedReason: null,
      materializationOnly: true,
      materializationEstimatedCostMs: descriptor.estimatedCostMs,
      onReady: resolveReady,
      onPreparationError: rejectReady,
      registerCancel: (cancel) => {
        dispose = () => {
          context.stop();
          cancel();
        };
      },
      registerLogicalStart: (start) => {
        startLogicalLifecycle = start;
      },
    });
    const preparedExecution = {
      trial,
      context,
      result,
      ready,
      dispose,
      startLogicalLifecycle: () => startLogicalLifecycle(),
    };
    this.preparedExecution = preparedExecution;
    try {
      await ready;
      const prepareCpuDurationMs = Math.max(
        0,
        performance.now() - prepareCpuStartedAt,
      );
      this.prepareCpuDurationMs = prepareCpuDurationMs;
      this.prepareCompletedDuringResponseWindow =
        preparation.frameEngine.getDiagnostics?.().response_sensitive === true;
      this.prepareCompletedNearVisualDeadline =
        preparation.frameEngine.getWorkPhase?.() === "CRITICAL";
      const coordinator = (this.jsPsych as any)?.timing as
        | { reportPrepareCpuDuration?: (durationMs: number) => void }
        | undefined;
      coordinator?.reportPrepareCpuDuration?.(prepareCpuDurationMs);
    } catch (error) {
      const reason =
        error instanceof Error && error.message
          ? `precision_prepare_failed:${error.message}`
          : "precision_prepare_failed";
      this.preparedTrialReady = false;
      this.preparedTrialFallbackReason = reason;
      context.markNotReady?.(reason, { precisionFallbackReason: reason });
      if (this.preparedExecution === preparedExecution) {
        this.preparedExecution = null;
      }
      dispose();
    } finally {
      domMutationCount += materializationObserver?.takeRecords().length ?? 0;
      materializationObserver?.disconnect();
      const gpuCallsAfter = materializationStages.reduce(
        (sum, stage) => sum + stage.getGpuResourceCallCount(),
        0,
      );
      this.runtimeMaterializationDomMutations = domMutationCount;
      this.runtimeMaterializationLayoutReads = Math.max(
        0,
        ResponseTimingManager.getCumulativeLayoutReadCount() -
          layoutReadsBefore,
      );
      this.runtimeMaterializationGpuCalls = Math.max(
        0,
        gpuCallsAfter - gpuCallsBefore,
      );
      this.runtimeMaterializationCpuMs = Math.max(
        0,
        performance.now() - materializationStartedAt,
      );
    }
  }

  isPreparedTrialReady() {
    return this.preparedTrialReady && this.preparedExecution !== null;
  }

  /**
   * P0.2 (iteración 7): contrato de materialización runtime. Tras una
   * preparación completada, un coste no-nulo significa que el trial
   * materializó con recursos ready (response-safe por contrato).
   */
  getRuntimeMaterializationEstimate(): number | null {
    return this.runtimeMaterializationCostEstimateMs;
  }

  getPreparedTrialFallbackReason() {
    return this.preparedTrialFallbackReason;
  }

  discardPreparedTrial() {
    const prepared = this.preparedExecution;
    this.preparedTrialDescriptor = null;
    this.preparedTrialResourceTemplate = null;
    this.pendingPreparedMaterialization = null;
    this.preparedTrialReady = false;
    this.preparedExecution = null;
    prepared?.dispose();
  }

  setPreparedTrialIndex(trialIndex: number) {
    this.preparedExecution?.context.setTrialIndex(trialIndex);
    if (this.pendingPreparedMaterialization) {
      this.pendingPreparedMaterialization.preparation.trialIndex = trialIndex;
    }
  }

  trial(displayElement: HTMLElement, trial: TrialType<Info>) {
    const prepared = this.preparedExecution;
    if (prepared) {
      this.preparedExecution = null;
      this.preparedTrialDescriptor = null;
      this.pendingPreparedMaterialization = null;
      this.executionTiming = null;
      Object.assign(prepared.trial, trial);
      prepared.context.start();
      prepared.startLogicalLifecycle();
      return prepared.result;
    }
    const executionTiming = this.executionTiming;
    this.executionTiming = null;
    if (!executionTiming?.frameEngine || !executionTiming.trialContext) {
      throw new Error(
        "DynamicPlugin requires a core-provided FrameEngine TrialTimingContext.",
      );
    }
    let startLogicalLifecycle = () => {};
    const result = this.runTrial(displayElement, trial, {
      frameEngine: executionTiming.frameEngine,
      trialContext: executionTiming.trialContext,
      timingContinuous: executionTiming.timingContinuous,
      allowEarlyActivation: executionTiming.allowEarlyActivation,
      earlyTransitionRejectedReason:
        executionTiming.earlyTransitionRejectedReason,
      registerLogicalStart: (start) => {
        startLogicalLifecycle = start;
      },
    });
    executionTiming.trialContext.start();
    startLogicalLifecycle();
    return result;
  }

  private runTrial(
    display_element: HTMLElement,
    trial: TrialType<Info> | any,
    execution: {
      frameEngine?: HostFrameEngine;
      trialContext?: HostTrialTimingContext;
      timingContinuous?: boolean;
      allowEarlyActivation?: boolean;
      earlyTransitionRejectedReason?: string | null;
      materializationOnly?: boolean;
      materializationEstimatedCostMs?: number;
      onReady?: () => void;
      onPreparationError?: (error: unknown) => void;
      registerCancel?: (cancel: () => void) => void;
      registerLogicalStart?: (start: () => void) => void;
    } = {},
  ) {
    const dynamicTrialSequence = ++dynamicTrialSequenceCounter;
    const trialContext = execution.trialContext;
    const hostFrameEngine = execution.frameEngine;
    if (!trialContext || !hostFrameEngine) {
      throw new Error(
        "DynamicPlugin cannot execute without the core FrameEngine context.",
      );
    }
    const timingContinuous = execution.timingContinuous === true;
    const allowEarlyActivation = execution.allowEarlyActivation === true;
    const earlyTransitionRejectedReason =
      execution.earlyTransitionRejectedReason ?? null;
    const descriptorMaterializationOnly = execution.materializationOnly === true;

    // Prepared executions retain the RESOURCE/MAIN/GPU measurements collected
    // before descriptor publication. A normal execution starts a fresh set.
    if (!descriptorMaterializationOnly) {
      this.prepareResourceWaitMs = null;
      this.prepareMainThreadMs = null;
      this.prepareGpuMs = null;
      this.preparePublishMs = null;
      this.prepareMainThreadDuringResponseWindow = null;
      this.prepareGpuDuringResponseWindow = null;
      this.prepareCompletionDeferredUntilSafe = null;
    }
    this.runtimeMaterializationDuringResponseWindow = null;
    this.runtimeMaterializationCostEstimateMs =
      execution.materializationEstimatedCostMs ?? null;
    this.runtimeMaterializationDomMutations = null;
    this.runtimeMaterializationLayoutReads = null;
    this.runtimeMaterializationGpuCalls = null;
    this.runtimeMaterializationCpuMs = null;

    // P3: consume/validate any prepared presentation BEFORE this trial's
    // heavy work. Purely static: only literal media strings of the processed
    // trial participate.
    const prepareDiagnostics = validatePreparedPresentation(
      this.jsPsych,
      trial,
    );
    const prepareStatus: PrepareStatus = prepareDiagnostics.status;
    const prepareStartedAt: number | null = prepareDiagnostics.startedAt;
    const prepareReadyAt: number | null = prepareDiagnostics.readyAt;

    return new Promise((resolveTrial) => {
      const canvasWidth = trial.__canvasStyles?.width ?? 1024;
      const canvasHeight = trial.__canvasStyles?.height ?? 768;
      const detachedExecution = isFrameBoundaryVisualTrial(
        resolveTimingMs(trial.trial_duration, null),
        (trial.components ?? []).map((config: any) => ({ config })),
        (trial.response_components ?? []).map((config: any) => ({ config })),
      );
      // Inject plugin styles if not already present
      if (
        !detachedExecution &&
        !document.getElementById("jspsych-dynamic-plugin-styles")
      ) {
        const styleElement = document.createElement("style");
        styleElement.id = "jspsych-dynamic-plugin-styles";
        styleElement.textContent = `
        #jspsych-dynamic-plugin-container,
        [data-dynamic-plugin-container="true"] {
          position: fixed;
          top: 50%;
          left: 50%;
          overflow: hidden;
          text-align: left;
        }
        #jspsych-html-component-main,
        #jspsych-button-response-main {
          visibility: visible !important;
        }
        #jspsych-dynamic-plugin-container img,
        #jspsych-dynamic-plugin-container canvas {
          display: block;
        }
        .jspsych-require-response-error {
          outline: 2px solid #e74c3c !important;
          border-radius: 4px;
        }
      `;
        document.head.appendChild(styleElement);
      }

      // Image/Text + non-visual response trials use a detached execution
      // descriptor over the experiment-owned persistent surface. No
      // trial-specific DOM node is created, styled, appended, or removed.
      const mainContainer = detachedExecution
        ? getPersistentVisualSurface(canvasWidth, canvasHeight, "transparent")
        : document.createElement("div");
      if (detachedExecution) {
        bindPersistentVisualSurfaceToFrameEngine(hostFrameEngine);
      } else {
        mainContainer.id = `${DYNAMIC_CONTAINER_ID}-${dynamicTrialSequence}`;
        mainContainer.dataset.dynamicPluginContainer = "true";
        mainContainer.style.visibility = "hidden";
        mainContainer.style.background =
          trial.__canvasStyles?.backgroundColor ?? "transparent";
        display_element.appendChild(mainContainer);
      }

      // Scale to fit viewport (same mechanism as ExperimentPreview iframe)
      const updateScale = () => {
        if (detachedExecution) return;
        const ratio = Math.min(
          window.innerWidth / canvasWidth,
          window.innerHeight / canvasHeight,
        );
        mainContainer.style.width = canvasWidth + "px";
        mainContainer.style.height = canvasHeight + "px";
        mainContainer.style.transform =
          "translate(-50%, -50%) scale(" + ratio + ")";
      };
      if (!detachedExecution) updateScale();

      const resizeObserver: ResizeObserver | null = null;

      const initialDiagnostics = getDiagnosticsOptions(trial);
      const timing = createPrecisionTiming({
        recordFrameTiming: initialDiagnostics.recordFrameTiming,
        longFrameThreshold:
          resolveTimingMs(trial.frame_lag_threshold, 34) ?? 34,
        trialContext,
      });

      // Store component instances and rendered elements
      const stimulusComponents: any[] = [];
      const responseComponents: any[] = [];
      let visualRenderContainer = mainContainer;
      const visualBackgroundDisposers: Array<() => void> = [];
      const visualBackgroundId = `dynamic-background-${trialContext.id}`;
      let hasResponded = false;
      let trialEnded = false;
      let trialEndedByResponse = false;
      let persistentVisualBoundary = false;
      let persistentVisualBoundaryLeadMs: number | null = null;
      let pendingEnd: { requestTimestamp: number; reason: string } | null =
        null;
      let handleParticipantResponse: (
        signal?: ParticipantResponseSignal | null,
        options?: { force?: boolean },
      ) => boolean = () => false;
      let precisionReady = false;
      let precisionReadyAt: number | null = null;
      let precisionReadyReason = "";
      let precisionFallbackReason = this.preparedTrialFallbackReason || "";
      let resourceReadyAt: number | null = null;
      let gpuReadyAt: number | null = null;
      const responseTiming = new ResponseTimingManager({
        trial,
        timing,
        container: mainContainer,
        canvasWidth,
        canvasHeight,
        onFinish: (signal, options) =>
          handleParticipantResponse(signal, options),
      });
      if (detachedExecution) {
        const surfaceScale = Math.min(
          window.innerWidth / canvasWidth,
          window.innerHeight / canvasHeight,
        );
        const surfaceWidth = canvasWidth * surfaceScale;
        const surfaceHeight = canvasHeight * surfaceScale;
        responseTiming.setPointerGeometry({
          left: (window.innerWidth - surfaceWidth) / 2,
          top: (window.innerHeight - surfaceHeight) / 2,
          width: surfaceWidth,
          height: surfaceHeight,
        });
      }
      let presentationActivated = false;
      let physicalActivationIndex: number | null = null;
      let logicalLifecycleStarted = false;
      let responseTimingAttached = false;
      const activateLogicalResponses = () => {
        logicalLifecycleStarted = true;
        if (!presentationActivated || responseTimingAttached) return;
        for (const component of responseComponents) {
          component.lifecycle.activate({
            timestamp:
              trialContext.getLatestFrameTime() ??
              timing.getTrialTimeOrigin() ??
              performance.now(),
          });
        }
        if (hasResponseInputs) {
          responseTiming.activate();
          responseTimingAttached = true;
          trialContext.setResponseSensitive?.(true);
        }
      };
      execution.registerLogicalStart?.(activateLogicalResponses);

      // External core teardown detection. `jsPsych.abortExperiment()` resolves
      // the core trial promise and clears `display_element` WITHOUT resolving
      // this plugin's own promise. When the core removes our container while
      // the trial is still active, cancel every internal resource.
      let hardTornDown = false;
      let unregisterTeardown: (() => void) | null = null;

      const hardTeardownWithoutResolve = (removeGlobalVisuals = true) => {
        if (trialEnded || hardTornDown) return;
        hardTornDown = true;
        trialEnded = true;
        unregisterTeardown?.();
        unregisterTeardown = null;
        pendingEnd = null;
        timing.stop();
        responseTiming.detach();
        trialContext.setResponseSensitive?.(false);
        resizeObserver?.disconnect();
        if (removeGlobalVisuals) disposePreparedPresentation(this.jsPsych);
        for (const component of stimulusComponents) {
          component.lifecycle?.destroy();
          if (!component.lifecycle) component.instance.destroy?.();
        }
        for (const component of responseComponents) {
          component.lifecycle?.destroy();
          if (!component.lifecycle) component.instance.destroy?.();
        }
        for (const dispose of visualBackgroundDisposers) dispose();
        visualBackgroundDisposers.length = 0;
        if (!detachedExecution) mainContainer.remove();
        if (removeGlobalVisuals) {
          removePersistentVisualSurface();
        }
      };

      if (!detachedExecution && typeof MutationObserver !== "undefined") {
        unregisterTeardown = registerContainerTeardown(
          display_element,
          mainContainer,
          () => hardTeardownWithoutResolve(true),
        );
      }
      execution.registerCancel?.(() => hardTeardownWithoutResolve(false));

      // Instantiate all components first
      const stimulusTypeCounts: Record<string, number> = {};

      if (trial.components && trial.components.length > 0) {
        trial.components.forEach((rawConfig: any, idx: number) => {
          const config = { ...rawConfig };
          // Inject __canvasStyles so components can compute pixel coords
          config.__canvasStyles = {
            ...trial.__canvasStyles,
            backgroundColor: "transparent",
          };
          config.__renderBackend = trial.render_backend || "webgl-strict";
          config.__recordGpuTiming = trial.record_gpu_timing !== false;
          config.__recordCommitSeries = initialDiagnostics.includeRenderSeries;
          config.__recordGpuSeries = initialDiagnostics.includeGpuSeries;
          config.__gpuPrepareSync = String(
            resolveRawValue(trial.gpu_prepare_sync) ?? "none",
          );
          config.__precisionGlobalPath = true;
          config.__canvasStage = getCanvasStages(mainContainer)[0] ?? null;
          attachPrecisionTiming(config, timing);
          attachResponseTiming(config, responseTiming);
          const ComponentClass = COMPONENT_MAP[config.type];
          if (ComponentClass) {
            stimulusTypeCounts[config.type] =
              (stimulusTypeCounts[config.type] || 0) + 1;
            if (!config.name) {
              config.name = `${config.type}_${stimulusTypeCounts[config.type]}`;
            }
            config.__componentId = getStableComponentId(config, config.name);
            config.__runtimeComponentId = `${trialContext.id}:${config.__componentId}`;
            config.__deferOffsetToTrialBoundary =
              usesWholeTrialStimulusWindow(
                config,
                resolveTimingMs(trial.trial_duration, null),
              );
            const instance = new ComponentClass(this.jsPsych);
            stimulusComponents.push({ instance, config });
          } else {
            console.warn(`Unknown component type: ${config.type}`);
          }
        });
      }

      const responseTypeCounts: Record<string, number> = {};

      if (trial.response_components && trial.response_components.length > 0) {
        trial.response_components.forEach((rawConfig: any, idx: number) => {
          const config = { ...rawConfig };
          config.__canvasStyles = {
            ...trial.__canvasStyles,
            backgroundColor: "transparent",
          };
          config.__renderBackend = trial.render_backend || "webgl-strict";
          config.__recordGpuTiming = trial.record_gpu_timing !== false;
          config.__recordCommitSeries = initialDiagnostics.includeRenderSeries;
          config.__recordGpuSeries = initialDiagnostics.includeGpuSeries;
          config.__gpuPrepareSync = String(
            resolveRawValue(trial.gpu_prepare_sync) ?? "none",
          );
          config.__precisionGlobalPath = true;
          config.__canvasStage = getCanvasStages(mainContainer)[0] ?? null;
          attachPrecisionTiming(config, timing);
          attachResponseTiming(config, responseTiming);
          const ComponentClass = RESPONSE_COMPONENT_MAP[config.type];
          if (ComponentClass) {
            responseTypeCounts[config.type] =
              (responseTypeCounts[config.type] || 0) + 1;
            if (!config.name) {
              config.name = `${config.type}_${responseTypeCounts[config.type]}`;
            }
            config.__componentId = getStableComponentId(config, config.name);
            config.__runtimeComponentId = `${trialContext.id}:${config.__componentId}`;
            const instance = new ComponentClass(this.jsPsych);
            responseComponents.push({ instance, config });
          } else {
            console.warn(`Unknown response component type: ${config.type}`);
          }
        });
      }

      // Render ALL components in parallel (stimulus and response together)
      // Sort by zIndex to control layering (lower zIndex renders first = appears behind)
      const allComponents = [...stimulusComponents, ...responseComponents];
      const hasResponseInputs =
        responseComponents.length > 0 ||
        stimulusComponents.some(
          ({ instance }) => typeof instance.recordResponse === "function",
        );
      for (const component of allComponents) {
        // P1.2 (iteración 6): instancias y lifecycles vivos, contados en un
        // único choke point (el destroy del lifecycle).
        liveRuntimeComponentInstances += 1;
        liveRuntimeLifecycles += 1;
        component.lifecycle = createPrecisionComponentLifecycle(
          component.instance,
          {
            onDestroy: () => {
              liveRuntimeComponentInstances = Math.max(
                0,
                liveRuntimeComponentInstances - 1,
              );
              liveRuntimeLifecycles = Math.max(
                0,
                liveRuntimeLifecycles - 1,
              );
            },
          },
        );
      }
      allComponents.sort(
        (a, b) => (a.config.zIndex ?? 0) - (b.config.zIndex ?? 0),
      );

      // P0.3 (iteración 7): las continuaciones async de los componentes NUNCA
      // ejecutan DOM/measure/GPU directamente — re-entran al PreparationScheduler
      // con estos hooks. Cada etapa se mide COMPLETA (P1.2).
      const scheduleComponentStage = (
        work: () => void,
        options: { label?: string; gpu?: boolean } = {},
      ) => {
        const stageEngine = hostFrameEngine;
        const runMeasured = () => {
          const startedAt = performance.now();
          const duringWindow =
            stageEngine?.getDiagnostics?.().response_sensitive === true;
          try {
            work();
          } finally {
            const durationMs = Math.max(0, performance.now() - startedAt);
            if (options.gpu === true) {
              this.prepareGpuMs = Math.max(
                0,
                (this.prepareGpuMs ?? 0) + durationMs,
              );
              if (duringWindow && this.prepareGpuDuringResponseWindow !== true) {
                this.prepareGpuDuringResponseWindow = true;
              }
            } else {
              this.prepareMainThreadMs = Math.max(
                0,
                (this.prepareMainThreadMs ?? 0) + durationMs,
              );
              if (
                duringWindow &&
                this.prepareMainThreadDuringResponseWindow !== true
              ) {
                this.prepareMainThreadDuringResponseWindow = true;
              }
            }
          }
        };
        const deferNeeded =
          stageEngine.getDiagnostics?.().response_sensitive === true ||
          stageEngine.getWorkPhase?.() === "CRITICAL";
        if (deferNeeded && typeof stageEngine?.queuePreparationTask === "function") {
          this.prepareCompletionDeferredUntilSafe = true;
          stageEngine.queuePreparationTask(runMeasured, {
            label: options.label ?? "dynamic-component-prep-stage",
            estimatedCostMs: options.gpu === true ? 2 : 1,
          });
        } else {
          runMeasured();
        }
      };
      for (const component of allComponents) {
        component.config.__schedulePreparationStage = scheduleComponentStage;
      }

      const renderAllComponents = (): void | Promise<void> => {
        // Pass onResponse callback to ALL components so they can end the trial if needed
        const pendingPreparations: Promise<void>[] = [];
        for (const comp of allComponents) {
          const { instance, config } = comp;
          const _prevLen = visualRenderContainer.children.length;
          const renderedElement = comp.lifecycle.prepare(
            visualRenderContainer,
            config,
            (signal?: ParticipantResponseSignal) => {
              handleParticipantResponse(signal);
            },
          );
          // Capture the topmost new child appended during render (synchronous DOM op)
          comp.renderedEl =
            visualRenderContainer.children.length > _prevLen
              ? (visualRenderContainer.lastElementChild as HTMLElement)
              : null;
          const applyResolvedElement = (resolvedElement: unknown) => {
            if (!comp.renderedEl && resolvedElement instanceof HTMLElement) {
              comp.renderedEl = resolvedElement;
            }
          };
          if (
            renderedElement &&
            typeof (renderedElement as PromiseLike<unknown>).then === "function"
          ) {
            pendingPreparations.push(
              Promise.resolve(renderedElement).then(applyResolvedElement),
            );
          } else {
            applyResolvedElement(renderedElement);
          }
        }
        if (pendingPreparations.length > 0) {
          return Promise.all(pendingPreparations).then(() => undefined);
        }
      };

      // Function to record all pending responses before ending trial
      const recordAllPendingResponses = (
        signal?: ParticipantResponseSignal | null,
      ) => {
        // Record responses from all response components that haven't responded yet
        responseComponents.forEach(({ instance, config }) => {
          if (
            instance.recordResponse &&
            typeof instance.recordResponse === "function"
          ) {
            // Try to record response (will fail gracefully if validation fails)
            instance.recordResponse(config, signal ?? undefined);
          }
        });

        // Record responses from stimulus components that have response capability
        stimulusComponents.forEach(({ instance, config }) => {
          if (
            instance.recordResponse &&
            typeof instance.recordResponse === "function"
          ) {
            // Try to record response (will fail gracefully if validation fails)
            instance.recordResponse(config, signal ?? undefined);
          }
        });
      };

      const clearResponseValidationErrors = () => {
        responseComponents.forEach(({ instance: ri }) => {
          if (typeof (ri as any).clearValidationError === "function") {
            (ri as any).clearValidationError();
          }
        });
      };

      const allRequiredResponsesValid = () =>
        responseComponents.every(({ instance: ri, config: rc }) =>
          typeof (ri as any).isValid === "function"
            ? (ri as any).isValid(rc)
            : true,
        );

      const resetResponseComponents = () => {
        responseComponents.forEach(({ instance: ri }) => {
          if (typeof (ri as any).reset === "function") {
            (ri as any).reset();
          }
        });
      };

      const showResponseValidationErrors = () => {
        responseComponents.forEach(({ instance: ri, config: rc }) => {
          if (
            typeof (ri as any).isValid === "function" &&
            !(ri as any).isValid(rc) &&
            typeof (ri as any).showValidationError === "function"
          ) {
            (ri as any).showValidationError();
          }
        });
      };

      handleParticipantResponse = (
        suppliedSignal: ParticipantResponseSignal | null = null,
        options: { force?: boolean } = {},
      ) => {
        const forceEnd = options.force === true;
        if (
          trialEnded ||
          hasResponded ||
          (!forceEnd && trial.response_ends_trial === false)
        ) {
          return false;
        }

        if (trial.require_response && !forceEnd) {
          clearResponseValidationErrors();
          if (!allRequiredResponsesValid()) {
            resetResponseComponents();
            showResponseValidationErrors();
            return false;
          }
        }

        hasResponded = true;
        trialEndedByResponse = true;
        const signal = suppliedSignal ?? createParticipantResponseSignal();
        recordAllPendingResponses(signal);
        const responseTime = signal.timestamp;
        if (trial.timing_continuous === true) {
          // P2: the response timestamp is captured NOW (RT = E - origin) but
          // the finalization is aligned to the next frame commit.
          requestTrialEnd(responseTime, "response");
        } else {
          endTrial(responseTime);
        }
        return true;
      };

      // P2 end-request layer for timing_continuous trials. The FIRST accepted
      // request wins (idempotent); the actual finalization runs in a one-shot
      // post-commit callback with the commit frame timestamp.
      const requestTrialEnd = (
        requestTimestamp: number,
        reason: string,
      ): boolean => {
        if (trialEnded) return false;
        // P0.1 (iteración 5): el timeout de duración máxima SIEMPRE se
        // predeclara al onset (aunque response_ends_trial=true). Una
        // respuesta temprana REEMPLAZA el boundary pendiente — un único
        // commit, nunca dos.
        if (reason === "response" && pendingEnd?.reason === "response") {
          return false;
        }
        // Un timeout nunca debe pisotear una respuesta ya pendiente (p. ej.
        // response antes del onset o del scheduleAt de respaldo).
        if (reason === "trial_duration" && pendingEnd !== null) {
          return false;
        }
        const replacing = reason === "response" && pendingEnd !== null;
        pendingEnd = { requestTimestamp, reason };
        if (timing.isGlobalFrameEngine()) {
          const trialDuration = resolveTimingMs(trial.trial_duration, null);
          const isDurationEnd = reason === "trial_duration" && trialDuration !== null;
          const requestedPolicy = String(
            trial.boundary_policy ?? "nearest_frame",
          ) as VisualBoundaryPolicy;
          const validPolicies: VisualBoundaryPolicy[] = [
            "strict_not_before_ms",
            "frame_tolerant_not_before",
            "nearest_frame",
            "frame_locked",
            "frame_count",
          ];
          let boundaryPolicy: VisualBoundaryPolicy = validPolicies.includes(
            requestedPolicy,
          )
            ? requestedPolicy
            : "strict_not_before_ms";
          const configuredFrameCount = resolveTimingMs(
            trial.boundary_frame_count,
            null,
          );
          if (!validPolicies.includes(requestedPolicy)) {
            precisionFallbackReason = `invalid_boundary_policy:${requestedPolicy}`;
          } else if (
            boundaryPolicy === "frame_count" &&
            configuredFrameCount === null
          ) {
            precisionFallbackReason =
              "invalid_frame_count_boundary_missing_count";
            boundaryPolicy = "strict_not_before_ms";
          }
          const requestedScheduleReference = String(
            trial.schedule_reference ?? "relative_duration",
          ) as ScheduleReference;
          const scheduleReference: ScheduleReference =
            requestedScheduleReference === "relative_duration" ||
            requestedScheduleReference === "absolute_phase"
              ? requestedScheduleReference
              : "relative_duration";
          if (
            requestedScheduleReference !== scheduleReference &&
            !precisionFallbackReason
          ) {
            precisionFallbackReason = `invalid_schedule_reference:${requestedScheduleReference}`;
          }
          // P1.1: event_phase_policy define explícitamente cómo un boundary
          // terminado por response trata la línea temporal ideal.
          const requestedEventPhasePolicy = String(
            trial.event_phase_policy ?? "rebase_on_event",
          );
          const eventPhasePolicy: "rebase_on_event" | "preserve_global_phase" =
            requestedEventPhasePolicy === "preserve_global_phase"
              ? "preserve_global_phase"
              : "rebase_on_event";
          if (
            requestedEventPhasePolicy !== eventPhasePolicy &&
            !precisionFallbackReason
          ) {
            precisionFallbackReason = `invalid_event_phase_policy:${requestedEventPhasePolicy}`;
          }
          const isResponseEnd = reason === "response";
          const responsePhaseOptions =
            isResponseEnd && eventPhasePolicy === "rebase_on_event"
              ? { rebasePhase: true as const }
              : {};
          // P0.2 (iteración 4): para un boundary de duración fija NO se pasa
          // targetTimeMs explícito — el FrameEngine deriva el target según
          // scheduleReference. Para un boundary terminado por response se
          // preserva el timestamp real de la response; requestedDurationMs
          // mantiene (preserve) o rebasea la cadena de fase.
          const boundaryOptions = {
            ...(isDurationEnd ? {} : { targetTimeMs: requestTimestamp }),
            // A response arrives after the latest observed display refresh.
            // Keep nearest-frame phase selection, but constrain the physical
            // replacement to the next observable frame so successor/audio
            // pre-arm can never target a frame that has already passed.
            targetFrameIndex:
              isResponseEnd &&
              typeof trialContext.getFrameIndex() === "number"
                ? trialContext.getFrameIndex()! + 1
                : undefined,
            requestedDurationMs:
              trialDuration !== null && !(
                isResponseEnd && eventPhasePolicy === "rebase_on_event"
              )
                ? trialDuration
                : undefined,
            scheduleReference,
            boundaryPolicy,
            frameCount:
              boundaryPolicy === "frame_count" &&
              configuredFrameCount !== null
                ? configuredFrameCount
                : null,
            requestedAt: requestTimestamp,
            reason,
            allowTerminal: true,
            ...responsePhaseOptions,
            onCommit: (boundary: any) => {
              // P0.3 (iteración 4): PHASE A es mínima (congela timestamps,
              // cierra autoridad de respuesta, resuelve la promesa) — puede
              // y debe ejecutarse aunque el successor esté responseSensitive.
              timing.queuePostCritical(
                () => {
                  // Safety net de timeout (antes provisto por el timer
                  // local eliminado): respuestas pendientes no registradas.
                  if (!hasResponded) {
                    hasResponded = true;
                    recordAllPendingResponses();
                  }
                  endTrial(boundary.timestamp, {
                    postCommitTimestamp: boundary.timestamp,
                  });
                },
                {
                  label: "dynamic_trial_logical_finalize",
                  estimatedCostMs: 0.5,
                  responseSafe: true,
                },
              );
            },
          };
          if (replacing) {
            // P1.3 (iteración 6): el replacement NO añade un segundo
            // callback — conserva el único logical-finalize del boundary
            // original (el mismo closure endTrial).
            const { onCommit: _replacedCommit, ...replacementOptions } =
              boundaryOptions;
            return timing.replaceBoundary
              ? timing.replaceBoundary(replacementOptions)
              : timing.requestBoundary(boundaryOptions);
          }
          return timing.requestBoundary(boundaryOptions);
        }
        timing.queuePostCommit((commitTimestamp) => {
          endTrial(commitTimestamp, { postCommitTimestamp: commitTimestamp });
        });
        return true;
      };

      // Function to end the trial and collect data.
      //
      // P0.2 (iteration 3): split finalization into two explicit phases.
      //
      // PHASE A — minimal logical completion (this function): freezes the
      // minimal immutable references/timestamps, closes the outgoing response
      // authority, builds the minimal trial data and resolves the plugin
      // promise so jsPsych core can advance. No heavy work here.
      //
      // PHASE B — deferred data finalization (`deferredFinalize`): renderer
      // metrics, DOM audit, quality classification, expensive serialization,
      // component getters, destroy and DOM cleanup. Scheduled through the
      // engine's safe queue so it never runs in a rAF tick and never blocks
      // an active response window.
      const endTrial = (
        offsetTime = performance.now(),
        options: { postCommitTimestamp?: number } = {},
      ) => {
        if (trialEnded) return;
        trialEnded = true;
        const logicalFinalizeStartedAt = performance.now();
        // Our own DOM cleanup must never be interpreted as an external abort.
        unregisterTeardown?.();
        unregisterTeardown = null;

        const timingSummary =
          timing.getCriticalSnapshot?.(offsetTime) ??
          timing.getSummary(offsetTime);
        const outgoingTransition =
          timingSummary.transitionTelemetry.find(
            (transition: any) =>
              transition.outgoing_context_id === trialContext.id,
          ) ?? null;
        const desiredTrialDuration = resolveTimingMs(
          trial.trial_duration,
          null,
        );
        const trialDurationError =
          desiredTrialDuration === null || timingSummary.actualDuration === null
            ? null
            : timingSummary.actualDuration - desiredTrialDuration;
        const diagnostics = getDiagnosticsOptions(trial);
        // PHASE A: close the outgoing response authority immediately.
        responseTiming.finishWithoutResponse(
          typeof offsetTime === "number" ? offsetTime : null,
        );
        responseTiming.detach();
        trialContext.setResponseSensitive?.(false);
        const responseTimingData = responseTiming.getData();
        timing.stop();

        const primaryStimulusRecord = getPrimaryStimulusRecord(
          timingSummary.stimulusRecords,
        );
        const visualStimulus = getPrimaryStimulusValue(stimulusComponents);
        const visualOnsetCommitTime =
          typeof primaryStimulusRecord?.frame_onset_abs === "number"
            ? primaryStimulusRecord.frame_onset_abs
            : null;
        const visualOffsetCommitTime =
          typeof primaryStimulusRecord?.frame_offset_abs === "number"
            ? primaryStimulusRecord.frame_offset_abs
            : null;
        const visualDuration =
          typeof visualOnsetCommitTime === "number" &&
          typeof visualOffsetCommitTime === "number"
            ? visualOffsetCommitTime - visualOnsetCommitTime
            : null;
        const visualDurationError =
          typeof visualDuration === "number" && desiredTrialDuration !== null
            ? visualDuration - desiredTrialDuration
            : null;
        const visualDurationSource =
          visualDuration === null ? "unavailable" : "stimulus_offset_commit";
        // P1.3 (iteración 5): las políticas visuales REALES del estímulo
        // primario, no valores históricos hardcodeados.
        const primaryStimulusConfig = stimulusComponents[0]?.config ?? null;
        const primaryStimulusPolicy = primaryStimulusConfig
          ? {
              onset: String(
                resolveRawValue(primaryStimulusConfig.stimulus_onset_policy) ??
                  "nearest_frame",
              ),
              offset: String(
                resolveRawValue(primaryStimulusConfig.stimulus_duration_policy) ??
                  "nearest_frame",
              ),
            }
          : null;
        // P1.3 (iteración 4): un warmup agotado por timeout o con confianza
        // insuficiente es un fallback explícito, jamás precisión limpia. El
        // prior de 60 Hz nunca se valida silenciosamente.
        const warmupTelemetry =
          hostFrameEngine?.getWarmupTelemetry?.() ??
          (this.jsPsych as any)?.precisionTiming?.getWarmupTelemetry?.() ??
          null;
        const warmupConfidence =
          typeof warmupTelemetry?.frame_clock_warmup_confidence === "number"
            ? warmupTelemetry.frame_clock_warmup_confidence
            : null;
        const warmupInsufficient =
          warmupTelemetry?.frame_clock_warmup_timeout === true ||
          (warmupConfidence !== null && warmupConfidence < 0.5);
        if (warmupInsufficient && !precisionFallbackReason) {
          precisionFallbackReason =
            "frame_clock_warmup_insufficient_confidence";
        }
        // P0.2 (iteración 6): barrera semántica registrada por el plan físico.
        const semanticBarrierType =
          (this.jsPsych as any)?.timing?.getSemanticBarrierAfter?.(
            this.jsPsych.getProgress?.()?.current_trial_global ?? -1,
          ) ?? null;
        const resourceHorizonWarning =
          (this.jsPsych as any)?.timing?.getResourceHorizonWarningAfter?.(
            this.jsPsych.getProgress?.()?.current_trial_global ?? -1,
          ) === true;
        const precisionPath = precisionFallbackReason
          ? "degraded"
          : "global_frame_engine";
        const primaryVisualIdentity =
          stimulusComponents[0]?.instance?.getPreparedVisualIdentity?.(
            stimulusComponents[0]?.config,
          ) ?? null;

        // P1.3 is deliberately compact and always present. Heavy frame/render
        // arrays remain opt-in, but a physical benchmark must never lose the
        // one-row explanation of which path and boundary were actually used.
        const trialData: any = {
          rt: responseTimingData.rt,
          rt_raw: responseTimingData.rt_raw,
          rt_corrected: responseTimingData.rt_corrected,
          rt_trial_origin: responseTimingData.rt_trial_origin,
          rt_scheduled_onset: responseTimingData.rt_scheduled_onset,
          rt_visual_commit: responseTimingData.rt_visual_commit,
          rt_anchor: responseTimingData.rt_anchor,
          rt_anchor_component: responseTimingData.rt_anchor_component,
          rt_anchor_time_abs: responseTimingData.rt_anchor_time_abs,
          response_time: responseTimingData.response_time,
          response_now_at_handler: responseTimingData.response_now_at_handler,
          response_timestamp_source:
            responseTimingData.response_timestamp_source,
          response_event_lag: responseTimingData.response_event_lag,
          pointer_handler_duration:
            responseTimingData.pointer_handler_duration ?? null,
          pointer_layout_read_count:
            responseTimingData.pointer_layout_read_count ?? null,
          response_valid: responseTimingData.response_valid,
          response_invalid_reason: responseTimingData.response_invalid_reason,
          precision_path: precisionPath,
          precision_path_active: true,
          precision_fallback_reason: precisionFallbackReason,
          precision_ready: precisionReady,
          precision_ready_at: precisionReadyAt,
          precision_ready_reason: precisionReadyReason,
          resource_ready_at: resourceReadyAt,
          gpu_ready_at: gpuReadyAt,
          early_transition_eligible: allowEarlyActivation,
          early_transition_rejected_reason:
            earlyTransitionRejectedReason ?? "",
          boundary_policy:
            outgoingTransition?.boundary_policy ??
            trial.boundary_policy ??
            "nearest_frame",
          target_frame_index: outgoingTransition?.target_frame_index ?? null,
          actual_frame_index: outgoingTransition?.actual_frame_index ?? null,
          frames_presented: outgoingTransition?.frames_presented ?? null,
          target_time: outgoingTransition?.target_time ?? null,
          actual_raf_timestamp:
            outgoingTransition?.actual_rAF_timestamp ?? null,
          deadline_error_ms: outgoingTransition?.deadline_error_ms ?? null,
          boundary_tolerance_applied_ms:
            outgoingTransition?.boundary_tolerance_applied_ms ?? null,
          predictor_confidence:
            outgoingTransition?.predictor_confidence ?? null,
          phase_prediction_uncertainty_ms:
            outgoingTransition?.phase_prediction_uncertainty_ms ?? null,
          early_error_ms: outgoingTransition?.early_error_ms ?? null,
          late_error_ms: outgoingTransition?.late_error_ms ?? null,
          cumulative_deadline_error_ms:
            outgoingTransition?.cumulative_deadline_error_ms ?? null,
          incoming_ready_before_boundary:
            outgoingTransition?.incoming_ready_before_boundary ?? false,
          incoming_ready_lead_ms:
            outgoingTransition?.incoming_ready_lead_ms ?? null,
          atomic_transition_used:
            outgoingTransition?.atomic_transition_used ?? false,
          visual_commit_count_for_boundary:
            outgoingTransition?.visual_commit_count_for_boundary ?? 0,
          critical_dom_mutation_count:
            trialContext.getCriticalDomMutationCount?.() ?? 0,
          precision_prefetch_authority: "rolling_lookahead",
          schedule_reference:
            outgoingTransition?.schedule_reference ?? "relative_duration",
          ideal_absolute_target:
            outgoingTransition?.ideal_absolute_target ?? null,
          actual_absolute_error:
            outgoingTransition?.actual_absolute_error ?? null,
          cumulative_phase_error:
            outgoingTransition?.cumulative_phase_error ?? null,
          per_stimulus_duration_error:
            outgoingTransition?.per_stimulus_duration_error ?? null,
          absolute_duration_error_ms:
            outgoingTransition?.absolute_duration_error_ms ?? null,
          selected_frame_policy:
            outgoingTransition?.selected_frame_policy ?? null,
          minimum_frame_constraint_applied:
            outgoingTransition?.minimum_frame_constraint_applied ?? false,
          unconstrained_nearest_frame_count:
            outgoingTransition?.unconstrained_nearest_frame_count ?? null,
          boundary_missed_reason:
            outgoingTransition?.boundary_missed_reason ?? null,
          boundary_initial_due_frame:
            outgoingTransition?.boundary_initial_due_frame ?? null,
          boundary_actual_commit_frame:
            outgoingTransition?.boundary_actual_commit_frame ?? null,
          extra_frames_held: outgoingTransition?.extra_frames_held ?? null,
          incoming_ready_after_target_ms:
            outgoingTransition?.incoming_ready_after_target_ms ?? null,
          precision_path_degraded:
            (outgoingTransition?.precision_path_degraded ?? false) ||
            warmupInsufficient,
          trial_ended_by_response: trialEndedByResponse,
          trial_end_alignment:
            options.postCommitTimestamp !== undefined
              ? "post_commit"
              : "immediate",
          trial_end_request_time: pendingEnd?.requestTimestamp ?? null,
          trial_end_commit_time: options.postCommitTimestamp ?? null,
          // P1.3 (iteración 5): política REAL usada, siempre presente en la
          // fila compacta para correlación con hardware.
          trial_boundary_policy_actual:
            outgoingTransition?.selected_frame_policy ??
            outgoingTransition?.boundary_policy ??
            null,
          schedule_reference_actual:
            outgoingTransition?.schedule_reference ?? "relative_duration",
          stimulus_onset_policy_actual: primaryStimulusPolicy?.onset ?? null,
          stimulus_offset_policy_actual: primaryStimulusPolicy?.offset ?? null,
          prepare_cpu_duration: this.prepareCpuDurationMs,
          prepare_completed_during_response_window:
            this.prepareCompletedDuringResponseWindow,
          prepare_completed_near_visual_deadline:
            this.prepareCompletedNearVisualDeadline,
          // P0.1 (iteración 6): etapas del scheduler de preparación.
          prepare_resource_wait_ms: this.prepareResourceWaitMs,
          prepare_main_thread_ms: this.prepareMainThreadMs,
          prepare_gpu_ms: this.prepareGpuMs,
          prepare_publish_ms: this.preparePublishMs,
          prepare_main_thread_during_response_window:
            this.prepareMainThreadDuringResponseWindow,
          prepare_gpu_during_response_window:
            this.prepareGpuDuringResponseWindow,
          prepare_completion_deferred_until_safe:
            this.prepareCompletionDeferredUntilSafe,
          // P0.2 (iteración 7): materialización runtime response-safe por
          // contrato (recursos ready) — coste medido honestamente.
          runtime_materialization_during_response_window:
            this.runtimeMaterializationDuringResponseWindow,
          runtime_materialization_cost_estimate_ms:
            this.runtimeMaterializationCostEstimateMs,
          runtime_materialization_dom_mutations:
            this.runtimeMaterializationDomMutations,
          runtime_materialization_layout_reads:
            this.runtimeMaterializationLayoutReads,
          runtime_materialization_gpu_calls:
            this.runtimeMaterializationGpuCalls,
          runtime_materialization_cpu_ms:
            this.runtimeMaterializationCpuMs,
          // P0.2 (iteración 6): barrera semántica registrada por el plan
          // físico (conditional/loop/global callback).
          semantic_barrier_type: semanticBarrierType,
          precision_run_broken_at_barrier: semanticBarrierType !== null,
          resource_horizon_warning: resourceHorizonWarning,
          logical_stimulus_key:
            primaryVisualIdentity?.logicalStimulusKey ?? null,
          prepared_resource_key:
            primaryVisualIdentity?.preparedResourceKey ?? null,
          prepared_trial_resource_key:
            createPreparedVisualResourceKey(trial),
          drawable_texture_key:
            primaryVisualIdentity?.drawableTextureKey ?? null,
          physical_activation_index: physicalActivationIndex,
          lookahead_ready_lead_ms:
            outgoingTransition?.incoming_ready_lead_ms ?? null,
          frame_clock_warmup_frames:
            warmupTelemetry?.frame_clock_warmup_frames ?? null,
          frame_clock_warmup_duration_ms:
            warmupTelemetry?.frame_clock_warmup_duration_ms ?? null,
          frame_clock_warmup_refresh_hz:
            warmupTelemetry?.frame_clock_warmup_refresh_hz ?? null,
          frame_clock_warmup_confidence: warmupConfidence,
          frame_clock_warmup_timeout:
            warmupTelemetry?.frame_clock_warmup_timeout === true,
          frame_clock_warmup_regime_generation:
            warmupTelemetry?.frame_clock_warmup_regime_generation ?? null,
        };

        if (diagnostics.includeSummary) {
          Object.assign(trialData, {
            timing_schema_version: 2,
            timing_method: "FrameEngine single-rAF observed-frame authority",
            timing_prepare_status: prepareStatus,
            timing_prepare_started_at: prepareStartedAt,
            timing_prepare_ready_at: prepareReadyAt,
            timing_activation_path: activationPath,
            timing_prepared_resources_used: preparedResourcesUsed,
            precision_path: precisionPath,
            precision_path_active: true,
            precision_fallback_reason: precisionFallbackReason,
            precision_ready: precisionReady,
            precision_ready_at: precisionReadyAt,
            precision_ready_reason: precisionReadyReason,
            resource_ready_at: resourceReadyAt,
            gpu_ready_at: gpuReadyAt,
            early_transition_eligible: allowEarlyActivation,
            early_transition_rejected_reason:
              earlyTransitionRejectedReason ?? "",
            boundary_policy:
              outgoingTransition?.boundary_policy ??
            trial.boundary_policy ??
            "nearest_frame",
            target_frame_index:
              outgoingTransition?.target_frame_index ?? null,
            actual_frame_index:
              outgoingTransition?.actual_frame_index ?? null,
            frames_presented: outgoingTransition?.frames_presented ?? null,
            target_time: outgoingTransition?.target_time ?? null,
            actual_raf_timestamp:
              outgoingTransition?.actual_rAF_timestamp ?? null,
            deadline_error_ms:
              outgoingTransition?.deadline_error_ms ?? null,
            boundary_tolerance_applied_ms:
              outgoingTransition?.boundary_tolerance_applied_ms ?? null,
            predictor_confidence:
              outgoingTransition?.predictor_confidence ?? null,
            phase_prediction_uncertainty_ms:
              outgoingTransition?.phase_prediction_uncertainty_ms ?? null,
            early_error_ms: outgoingTransition?.early_error_ms ?? null,
            late_error_ms: outgoingTransition?.late_error_ms ?? null,
            cumulative_deadline_error_ms:
              outgoingTransition?.cumulative_deadline_error_ms ?? null,
            incoming_ready_before_boundary:
              outgoingTransition?.incoming_ready_before_boundary ?? false,
            incoming_ready_lead_ms:
              outgoingTransition?.incoming_ready_lead_ms ?? null,
            atomic_transition_used:
              outgoingTransition?.atomic_transition_used ?? false,
            visual_commit_count_for_boundary:
              outgoingTransition?.visual_commit_count_for_boundary ?? 0,
            trial_time_origin: timingSummary.trialTimeOrigin,
            trial_time_origin_source: timingSummary.trialTimeOriginSource,
            ...(trial.timing_continuous === true
              ? {
                  trial_end_alignment:
                    options.postCommitTimestamp !== undefined
                      ? "post_commit"
                      : "immediate",
                  trial_end_request_time: pendingEnd?.requestTimestamp ?? null,
                  trial_end_commit_time: options.postCommitTimestamp ?? null,
                  // Keep the engine-owned object reference. The frame engine
                  // fills post_processing_duration immediately after this
                  // post-critical task returns, before Trial.run continues.
                  visual_transition_timing: outgoingTransition,
                  transition_target_time:
                    outgoingTransition?.target_time ?? null,
                  transition_target_frame_index:
                    outgoingTransition?.target_frame_index ?? null,
                  transition_actual_rAF_timestamp:
                    outgoingTransition?.actual_rAF_timestamp ?? null,
                  transition_actual_frame_index:
                    outgoingTransition?.actual_frame_index ?? null,
                  transition_commit_timestamp:
                    outgoingTransition?.commit_timestamp ?? null,
                  transition_frame_interval_estimate:
                    outgoingTransition?.frame_interval_estimate ?? null,
                  transition_phase_error:
                    outgoingTransition?.phase_error ?? null,
                  transition_deadline_error:
                    outgoingTransition?.deadline_error ?? null,
                  transition_dropped_frames_since_previous:
                    outgoingTransition?.dropped_frames_since_previous ?? null,
                  transition_incoming_state_ready_time:
                    outgoingTransition?.incoming_state_ready_time ?? null,
                  transition_boundary_processing_duration:
                    outgoingTransition?.boundary_processing_duration ?? null,
                }
              : {}),
            trial_onset_time: timingSummary.onsetTime,
            trial_offset_time: timingSummary.offsetTime,
            // P1.3 (iteración 5): reportar la política REAL usada, nunca una
            // política histórica hardcodeada.
            trial_duration_policy:
              desiredTrialDuration === null
                ? null
                : (outgoingTransition?.selected_frame_policy ??
                  outgoingTransition?.boundary_policy ??
                  null),
            stimulus_onset_policy: primaryStimulusPolicy?.onset ?? null,
            stimulus_offset_policy: primaryStimulusPolicy?.offset ?? null,
            actual_trial_duration: roundTiming(timingSummary.actualDuration),
            duration_error: roundTiming(trialDurationError),
            trial_ended_by_response: trialEndedByResponse,
            frame_count: timingSummary.frameCount,
            long_frame_count: timingSummary.longFrameCount,
            estimated_dropped_frame_count: timingSummary.droppedFrameCount,
            dropped_frame_count: timingSummary.droppedFrameCount,
            frame_interval_source: "FrameEngine_observed_rAF_gap",
            max_frame_interval: roundTiming(timingSummary.maxFrameInterval),
            mean_frame_interval: roundTiming(timingSummary.meanFrameInterval),
            frame_interval_estimate: roundTiming(
              timingSummary.frameIntervalEstimate,
            ),
            // timing_quality / visual_timing_quality, render metrics and the
            // DOM audit are produced by PHASE B (deferred finalization) and
            // merged into this result object before the core runs on_finish.
            dynamic_trial_sequence: dynamicTrialSequence,
            dynamic_next_trial_sequence: null,
            visual_stimulus: visualStimulus,
            visual_expected_duration: roundTiming(desiredTrialDuration),
            visual_onset_frame_time: roundTiming(visualOnsetCommitTime),
            visual_offset_frame_time: roundTiming(visualOffsetCommitTime),
            visual_onset_commit_time: roundTiming(visualOnsetCommitTime),
            visual_offset_commit_time: roundTiming(visualOffsetCommitTime),
            visual_duration: roundTiming(visualDuration),
            visual_duration_error: roundTiming(visualDurationError),
            visual_duration_source: visualDurationSource,
            persistent_visual_boundary: persistentVisualBoundary,
            persistent_visual_boundary_lead_ms: roundTiming(
              persistentVisualBoundaryLeadMs,
            ),
            response_timing_quality: responseTimingData.response_timing_quality,
            response_timing_quality_reason:
              responseTimingData.response_timing_quality_reason,
            diagnostics_level: diagnostics.level,
            ...responseTimingData,
            rt: responseTimingData.rt,
          });
        }

        // ---- PHASE B: deferred heavy finalization ----
        // Everything below is expensive (renderer aggregation, DOM audit,
        // quality classification, JSON serialization, bounding rects, PNG
        // capture, component destroy, DOM cleanup). It mutates the processed
        // result object in place via the core's deferred-finalizer hook.
        const buildDeferredFields = () => {
          const heavyFields: Record<string, any> = {};
          // PHASE B trabaja sobre el summary COMPLETO (arrays incluidos),
          // nunca sobre el snapshot O(1) de la Phase A.
          const fullSummary = timing.getSummary(offsetTime);
          const renderMetrics = aggregateRenderMetricsFromCursors(
            metricBaselineCursors,
            metricEndCursors,
            renderMetricSlices,
            String(trial.render_backend || "webgl-strict"),
          );
          const domAudit = auditDomLayers(
            stimulusComponents,
            responseComponents,
          );
          const visualTimingQuality = classifyTimingQuality(
            fullSummary,
            desiredTrialDuration,
            resolveTimingMs(trial.timing_quality_bad_threshold, 50) ?? 50,
            renderMetrics,
            domAudit,
            { ignoreTrialDurationError: trialEndedByResponse },
          );
          let timingQuality = mergeQuality(
            visualTimingQuality,
            responseTimingData.response_timing_quality,
            responseTimingData.response_timing_quality_reason,
          );
          // Iteración 7: sin FrameEngine no hay autoridad temporal — la
          // degradación se marca con razón explícita, jamás silenciosa.
          const schedulingDegradedReason =
            (timing as any).getTimingDegradedReason?.() ?? null;
          if (schedulingDegradedReason !== null) {
            timingQuality = {
              quality: "degraded",
              reason: schedulingDegradedReason,
            };
          }
          Object.assign(heavyFields, {
            timing_quality: timingQuality.quality,
            timing_quality_reason: timingQuality.reason,
            visual_timing_quality: visualTimingQuality.quality,
            render_backend_requested: renderMetrics.render_backend_requested,
            render_backend: renderMetrics.render_backend,
            visual_backend: renderMetrics.visual_backend,
            visual_all_commits_frame_synced:
              renderMetrics.visual_all_commits_frame_synced,
            commit_unsynced_count: renderMetrics.commit_unsynced_count,
            visual_all_commits_rAF: renderMetrics.visual_all_commits_rAF,
            commit_outside_raf_count: renderMetrics.commit_outside_raf_count,
            buffer_strategy: renderMetrics.buffer_strategy,
            commit_count: renderMetrics.commit_count,
            mean_commit_duration: renderMetrics.mean_commit_duration,
            max_commit_duration: renderMetrics.max_commit_duration,
            draw_call_count: renderMetrics.draw_call_count,
            texture_uploads_during_trial:
              renderMetrics.texture_uploads_during_trial,
            buffer_uploads_during_trial:
              renderMetrics.buffer_uploads_during_trial,
            shader_compiles_during_trial:
              renderMetrics.shader_compiles_during_trial,
            webgl_context_lost_count: renderMetrics.webgl_context_lost_count,
            gpu_timer_available: renderMetrics.gpu_timer_available,
            mean_gpu_draw_duration: renderMetrics.mean_gpu_draw_duration,
            max_gpu_draw_duration: renderMetrics.max_gpu_draw_duration,
            gpu_pending_query_count: renderMetrics.gpu_pending_query_count,
            gpu_disjoint_count: renderMetrics.gpu_disjoint_count,
            gpu_prepare_sync_mode: renderMetrics.gpu_prepare_sync_mode,
            gpu_prepare_sync_confirmed:
              renderMetrics.gpu_prepare_sync_confirmed,
            gpu_prepare_sync_duration_ms:
              renderMetrics.gpu_prepare_sync_duration_ms,
            gpu_prepare_sync_error: renderMetrics.gpu_prepare_sync_error,
            dom_interactive_components: JSON.stringify(
              domAudit.dom_interactive_components,
            ),
            dom_visual_components: domAudit.dom_visual_components,
            dom_visual_component_names: JSON.stringify(
              domAudit.dom_visual_component_names,
            ),
          });

          if (diagnostics.includeStimulusTiming) {
            heavyFields.stimulus_timing = JSON.stringify(
              fullSummary.stimulusRecords,
            );
          }

          if (diagnostics.includeFrameIntervals) {
            heavyFields.frame_intervals = JSON.stringify(
              fullSummary.frameIntervals,
            );
          }

          if (diagnostics.includeRenderSeries) {
            heavyFields.commit_durations = JSON.stringify(
              renderMetrics.commit_durations,
            );
          }

          if (diagnostics.includeGpuSeries) {
            heavyFields.gpu_draw_durations = JSON.stringify(
              renderMetrics.gpu_draw_durations,
            );
          }

          // Add stimulus components data as individual columns
          stimulusRetirement.forEach((comp) => {
            const { instance, config } = comp;
            const prefix = config.name; // Component name (e.g., "ImageComponent_1")

            // Add type
            heavyFields[`${prefix}_type`] = config.type;

            // Add stimulus if exists
            if (config.stimulus !== undefined) {
              heavyFields[`${prefix}_stimulus`] = config.stimulus;
            }

            // TextComponent: save the text content as stimulus data
            if (config.text !== undefined) {
              heavyFields[`${prefix}_text`] = config.text;
            }

            // Coordinates → pixel center in the actual viewport at trial end time.
            // CSS formula: left = calc(50% + x*0.5 vw), top = calc(50% - y*0.5 vh)
            if (config.coordinates !== undefined) {
              const cx = config.coordinates.x ?? 0;
              const cy = config.coordinates.y ?? 0;
              heavyFields[`${prefix}_coordinates`] = JSON.stringify({
                x: Math.round(window.innerWidth * (0.5 + cx / 200)),
                y: Math.round(window.innerHeight * (0.5 - cy / 200)),
              });
            }

            // Size via component-provided rendered size when canvas rendering is used,
            // otherwise fall back to the DOM element captured at render time.
            // P0.3 (iteración 6): fast-retired components read ONLY frozen data.
            if (comp.frozen?.renderedSize) {
              heavyFields[`${prefix}_size`] = JSON.stringify({
                width: Math.round(comp.frozen.renderedSize.width),
                height: Math.round(comp.frozen.renderedSize.height),
              });
            } else if (
              comp.frozen === null &&
              instance.getRenderedSize &&
              typeof instance.getRenderedSize === "function"
            ) {
              const renderedSize = instance.getRenderedSize();
              if (renderedSize) {
                heavyFields[`${prefix}_size`] = JSON.stringify({
                  width: Math.round(renderedSize.width),
                  height: Math.round(renderedSize.height),
                });
              }
            } else if (comp.frozen === null && comp.renderedEl) {
              const _r = comp.renderedEl.getBoundingClientRect();
              heavyFields[`${prefix}_size`] = JSON.stringify({
                width: Math.round(_r.width),
                height: Math.round(_r.height),
              });
            }

            // If component has response (like SurveyComponent)
            if (
              comp.frozen === null &&
              instance.getResponse &&
              typeof instance.getResponse === "function"
            ) {
              const response = instance.getResponse();

              // For SurveyComponent, flatten the response object
              if (
                config.type === "SurveyComponent" &&
                typeof response === "object" &&
                response !== null
              ) {
                // Each question becomes its own column: {componentName}_{questionName}
                Object.keys(response).forEach((questionName) => {
                  heavyFields[`${prefix}_${questionName}`] =
                    response[questionName];
                });
              } else {
                heavyFields[`${prefix}_response`] = response;
              }
            } else if (
              comp.frozen !== null &&
              comp.frozen.response !== undefined &&
              comp.frozen.response !== null
            ) {
              heavyFields[`${prefix}_response`] = comp.frozen.response;
            }

            // Response timestamp source diagnostic (handler-fallback when no
            // DOM event was available for the semantic response).
            if (
              comp.frozen !== null &&
              comp.frozen.responseTimestampSource !== undefined
            ) {
              heavyFields[`${prefix}_response_timestamp_source`] =
                comp.frozen.responseTimestampSource;
            } else if (
              comp.frozen === null &&
              typeof (instance as any).getResponseTimestampSource === "function"
            ) {
              heavyFields[`${prefix}_response_timestamp_source`] = (
                instance as any
              ).getResponseTimestampSource();
            }

            // AudioComponent timing diagnostics (clock bridge / fallback).
            if (config.type === "AudioComponent") {
              const audioDiagnostics = (instance as any).getDiagnostics?.();
              if (audioDiagnostics && typeof audioDiagnostics === "object") {
                for (const [key, value] of Object.entries(audioDiagnostics)) {
                  heavyFields[`${prefix}_${key}`] = value;
                }
              }
            }
            if (config.type === "VideoComponent") {
              const videoDiagnostics = (instance as any).getDiagnostics?.();
              if (videoDiagnostics && typeof videoDiagnostics === "object") {
                for (const [key, value] of Object.entries(videoDiagnostics)) {
                  heavyFields[`${prefix}_${key}`] = value;
                }
              }
            }
          });

          // Add response components data as individual columns
          responseRetirement.forEach((comp) => {
            const { instance, config } = comp;
            const prefix = config.name; // Component name (e.g., "ButtonResponseComponent_1")

            // Add type
            if (config.type !== "ClickResponseComponent") {
              heavyFields[`${prefix}_type`] = config.type;
            }

            // Coordinates and size (same logic as stimulus components)
            if (
              config.coordinates !== undefined &&
              config.type !== "ClickResponseComponent"
            ) {
              const cx = config.coordinates.x ?? 0;
              const cy = config.coordinates.y ?? 0;
              heavyFields[`${prefix}_coordinates`] = JSON.stringify({
                x: Math.round(window.innerWidth * (0.5 + cx / 200)),
                y: Math.round(window.innerHeight * (0.5 - cy / 200)),
              });
            }
            if (comp.frozen?.renderedSize) {
              heavyFields[`${prefix}_size`] = JSON.stringify({
                width: Math.round(comp.frozen.renderedSize.width),
                height: Math.round(comp.frozen.renderedSize.height),
              });
            } else if (
              comp.frozen === null &&
              instance.getRenderedSize &&
              typeof instance.getRenderedSize === "function"
            ) {
              const renderedSize = instance.getRenderedSize();
              if (renderedSize) {
                heavyFields[`${prefix}_size`] = JSON.stringify({
                  width: Math.round(renderedSize.width),
                  height: Math.round(renderedSize.height),
                });
              }
            } else if (comp.frozen === null && comp.renderedEl) {
              const _r = comp.renderedEl.getBoundingClientRect();
              heavyFields[`${prefix}_size`] = JSON.stringify({
                width: Math.round(_r.width),
                height: Math.round(_r.height),
              });
            }

            // Add response
            if (
              comp.frozen === null &&
              instance.getResponse &&
              typeof instance.getResponse === "function" &&
              config.type !== "ClickResponseComponent"
            ) {
              const response = instance.getResponse();
              heavyFields[`${prefix}_response`] = response;
            } else if (
              comp.frozen !== null &&
              config.type !== "ClickResponseComponent" &&
              comp.frozen.response !== undefined &&
              comp.frozen.response !== null
            ) {
              heavyFields[`${prefix}_response`] = comp.frozen.response;
            }

            // Response timestamp source diagnostic (handler-fallback when no
            // DOM event was available for the semantic response).
            if (
              comp.frozen !== null &&
              comp.frozen.responseTimestampSource !== undefined
            ) {
              heavyFields[`${prefix}_response_timestamp_source`] =
                comp.frozen.responseTimestampSource;
            } else if (
              comp.frozen === null &&
              typeof (instance as any).getResponseTimestampSource === "function"
            ) {
              heavyFields[`${prefix}_response_timestamp_source`] = (
                instance as any
              ).getResponseTimestampSource();
            }

            // KeyboardResponseComponent - correctness score
            if (
              config.type === "KeyboardResponseComponent" &&
              comp.frozen === null &&
              instance.getCorrect &&
              typeof instance.getCorrect === "function"
            ) {
              heavyFields[`${prefix}_correct`] = instance.getCorrect();
            } else if (
              config.type === "KeyboardResponseComponent" &&
              comp.frozen !== null
            ) {
              heavyFields[`${prefix}_correct`] =
                comp.frozen.correct !== undefined ? comp.frozen.correct : null;
            }

            // ButtonResponseComponent - response event type diagnostic
            if (
              config.type === "ButtonResponseComponent" &&
              typeof (instance as any).getResponseEventType === "function"
            ) {
              heavyFields[`${prefix}_response_event_type`] = (
                instance as any
              ).getResponseEventType();
            }

            // SliderResponseComponent - slider_start
            if (
              config.type === "SliderResponseComponent" &&
              instance.getSliderStart
            ) {
              heavyFields[`${prefix}_slider_start`] =
                instance.getSliderStart();
            }

            // SketchpadComponent - strokes and png
            if (config.type === "SketchpadComponent") {
              if (
                instance.getStrokes &&
                typeof instance.getStrokes === "function"
              ) {
                heavyFields[`${prefix}_strokes`] = JSON.stringify(
                  instance.getStrokes(),
                );
              }
              if (
                instance.getImageData &&
                typeof instance.getImageData === "function"
              ) {
                heavyFields[`${prefix}_png`] = instance.getImageData();
              }
            }

            // ClickResponseComponent - response = {x,y}, is_touch separate
            if (config.type === "ClickResponseComponent") {
              const clickResponse =
                comp.frozen !== null
                  ? comp.frozen.response
                  : instance.getResponse
                    ? instance.getResponse()
                    : null;
              if (clickResponse && typeof clickResponse === "object") {
                heavyFields[`${prefix}_response`] = JSON.stringify({
                  x: clickResponse.x,
                  y: clickResponse.y,
                });
                heavyFields[`${prefix}_is_touch`] = clickResponse.is_touch;
              }
            }

            // AudioResponseComponent - special fields
            if (config.type === "AudioResponseComponent") {
              const audioResponse = instance.getResponse
                ? instance.getResponse()
                : null;
              if (audioResponse && typeof audioResponse === "object") {
                heavyFields[`${prefix}_response`] = audioResponse.response;
                heavyFields[`${prefix}_audio_url`] = audioResponse.audio_url;
                heavyFields[`${prefix}_estimated_stimulus_onset`] =
                  audioResponse.estimated_stimulus_onset;
              }
            }

            // FileUploadResponseComponent - file metadata fields
            if (config.type === "FileUploadResponseComponent") {
              if (
                instance.getFileUrl &&
                typeof instance.getFileUrl === "function"
              ) {
                heavyFields[`${prefix}_file_url`] = instance.getFileUrl();
              }
              if (
                instance.getFileSize &&
                typeof instance.getFileSize === "function"
              ) {
                heavyFields[`${prefix}_file_size`] = instance.getFileSize();
              }
              if (
                instance.getFileType &&
                typeof instance.getFileType === "function"
              ) {
                heavyFields[`${prefix}_file_type`] = instance.getFileType();
              }
              heavyFields[`${prefix}_file_selection_response_time`] =
                instance.getFileSelectionResponseTime?.() ?? null;
              heavyFields[`${prefix}_upload_started_at`] =
                instance.getUploadStartedAt?.() ?? null;
              heavyFields[`${prefix}_upload_completed_at`] =
                instance.getUploadCompletedAt?.() ?? null;
              heavyFields[`${prefix}_upload_duration_ms`] =
                instance.getUploadDurationMs?.() ?? null;
            }
          });

          // Fast-retired components were already destroyed in PHASE R; only
          // components without the freeze contract are destroyed here.
          for (const component of stimulusRetirement) {
            if (component.frozen === null) component.lifecycle.destroy();
          }
          for (const component of responseRetirement) {
            if (component.frozen === null) component.lifecycle.destroy();
          }
          // Administrative DOM cleanup remains in PHASE B and therefore never
          // runs inside the response-safe resource-retirement task.
          if (!detachedExecution) mainContainer.remove();

          return heavyFields;
        };

        const criticalLogicalFinalizeDurationMs = Math.max(
          0,
          performance.now() - logicalFinalizeStartedAt,
        );
        trialData.critical_logical_finalize_duration_ms =
          roundTiming(criticalLogicalFinalizeDurationMs);
        trialData.deferred_finalize_duration_ms = null;
        trialData.logical_finalize_deferred = true;
        // P0.3 (iteración 5): recursos vivos/retirados y cola de
        // finalizadores, siempre acotados. P1.2 (iteración 6): el conteo de
        // retirados se registra DESPUÉS de PHASE R (el snapshot pre-retirement
        // infra-reportaba el retiro del propio trial).
        trialData.pending_finalizer_count = pendingFinalizerCount;
        trialData.peak_pending_finalizers = peakPendingFinalizers;
        trialData.retained_texture_references = getCanvasStages(
          visualRenderContainer,
        ).reduce(
          (sum, stage) =>
            sum +
            ((stage.getResourceDiagnostics?.() ?? {})
              .retainedTextureReferences ?? 0),
          0,
        );
        trialData.live_trial_containers =
          display_element.querySelectorAll(
            '[data-dynamic-plugin-container="true"]',
          ).length;
        // ---- PHASE R (P0.3, iteración 5): resource retirement ----
        // P0.4 (iteración 7): snapshot O(1) SIN poll de GPU y sin copiar
        // arrays. P1.1 (iteración 7): las métricas de ESTE trial son deltas
        // de cursores (activación → boundary) + slices acotados por secuencia.
        const metricEndCursors = getCanvasStages(visualRenderContainer).map(
          (stage) => stage.snapshotCountersNoPoll(),
        );
        const metricBaselineCursors = previousTrialMetricEndCursors;
        previousTrialMetricEndCursors = metricEndCursors;
        const renderMetricSlices = getCanvasStages(visualRenderContainer).map(
          (stage, index) => {
            const start = metricBaselineCursors?.[index] ?? null;
            return stage.getMetricSeriesSlice(
              start?.commit_series_next_index ?? 0,
              metricEndCursors[index].commit_series_next_index,
              start?.gpu_series_next_index ?? 0,
              metricEndCursors[index].gpu_series_next_index,
            );
          },
        );
        // Sólo los componentes con contrato freezeDataForFinalize se retiran
        // aquí (destroy + DOM cleanup, acotado y responseSafe). Los que no
        // soportan fast retirement (snapshots inherentemente pesados, p. ej.
        // Sketchpad PNG) se destruyen en PHASE B sobre la instancia viva.
        const stimulusRetirement: Array<{
          config: any;
          frozen: Record<string, any> | null;
          instance: any;
          renderedEl: HTMLElement | null;
          lifecycle: any;
        }> = [];
        const responseRetirement: Array<{
          config: any;
          frozen: Record<string, any> | null;
          instance: any;
          renderedEl: HTMLElement | null;
          lifecycle: any;
        }> = [];
        const retireResources = (components: any[], registry: any[]) => {
          for (const component of components) {
            let frozen: Record<string, any> | null = null;
            try {
              frozen = component.lifecycle.freezeDataForFinalize?.() ?? null;
            } catch {
              frozen = null;
            }
            if (frozen !== null) {
              // P0.3 (iteración 6): fast retirement REAL — el finalizer
              // recibe SÓLO {config, frozenData}. La instancia, el lifecycle
              // y el DOM se sueltan en PHASE R; PHASE B jamás puede volver a
              // consultarlos.
              component.lifecycle.destroy();
              cumulativeRetiredResources += 1;
              registry.push({
                config: component.config,
                frozen,
                instance: null,
                renderedEl: null,
                lifecycle: null,
              });
              component.instance = null;
              component.lifecycle = null;
              component.renderedEl = null;
            } else {
              registry.push({
                config: component.config,
                frozen: null,
                instance: component.instance,
                renderedEl: component.renderedEl ?? null,
                lifecycle: component.lifecycle,
              });
            }
          }
        };
        retireResources(stimulusComponents, stimulusRetirement);
        retireResources(responseComponents, responseRetirement);
        // The cumulative counter is distinct from the live resource gauges.
        trialData.cumulative_retired_resources = cumulativeRetiredResources;
        Object.assign(
          trialData,
          getPreparedVisualResourceCacheTelemetry(),
          getTextFontTelemetry(),
        );
        trialData.live_runtime_component_instances =
          liveRuntimeComponentInstances;
        trialData.live_runtime_lifecycles = liveRuntimeLifecycles;
        trialData.live_drawables = getCanvasStages(
          visualRenderContainer,
        ).reduce(
          (sum, stage) =>
            sum +
            ((stage.getResourceDiagnostics?.() ?? {}).drawableCount ?? 0),
          0,
        );
        trialData.pending_finalization_entries = pendingFinalizerCount;
        // P0.4 (iteración 7): PHASE R es REALMENTE response-safe — sin
        // removal de DOM pesado (va a PHASE B), sin expulsión de texturas
        // (tarea de mantenimiento no-responseSafe), sin poll de GPU.
        for (const dispose of visualBackgroundDisposers) dispose();
        visualBackgroundDisposers.length = 0;
        resizeObserver?.disconnect();
        const runTextureMaintenance = () => {
          for (const stage of getCanvasStages(visualRenderContainer)) {
            stage.runTextureMaintenance?.();
          }
        };
        if (typeof hostFrameEngine.queueSafeTask === "function") {
          hostFrameEngine.queueSafeTask(runTextureMaintenance, {
            label: "dynamic-texture-maintenance",
            estimatedCostMs: 2,
            responseSafe: false,
          });
        } else {
          runTextureMaintenance();
        }

        // P0.5 (iteración 5): PHASE A debe ser O(1). Si excede una fracción
        // configurable del frame period, el precision path se marca
        // explícitamente degraded — nunca se reporta como precisión limpia.
        const phaseABudgetMs =
          (timing.getFrameIntervalEstimate?.() ?? 1000 / 60) *
          Math.max(
            0,
            resolveTimingMs(trial.phase_a_budget_fraction, 0.5) ?? 0.5,
          );
        const criticalFinalizeOverBudget =
          criticalLogicalFinalizeDurationMs > phaseABudgetMs;
        trialData.critical_logical_finalize_over_budget =
          criticalFinalizeOverBudget;
        trialData.phase_a_budget_ms = roundTiming(phaseABudgetMs);
        if (criticalFinalizeOverBudget) {
          trialData.precision_path = "degraded";
          trialData.precision_path_degraded = true;
          trialData.precision_fallback_reason =
            trialData.precision_fallback_reason ||
            "critical_logical_finalize_over_budget";
        }

        // The core fork's Trial.run() awaits this
        // finalizer after processResult and before on_finish, so PHASE B can
        // complete later without ever losing a field.
        pendingFinalizerCount += 1;
        peakPendingFinalizers = Math.max(
          peakPendingFinalizers,
          pendingFinalizerCount,
        );
        const deferredFinalize = (finalResult: Record<string, any>) => {
          const sharedEngine: any =
            hostFrameEngine ?? (this.jsPsych as any)?.precisionTiming;
          return new Promise<void>((resolveFinalize) => {
            let settled = false;
            const settle = () => {
              if (settled) return;
              settled = true;
              pendingFinalizerCount = Math.max(0, pendingFinalizerCount - 1);
              resolveFinalize();
            };
            const removeResetHook =
              typeof sharedEngine?.onReset === "function"
                ? sharedEngine.onReset(settle)
                : null;
            const applyHeavyFields = () => {
              const deferredStartedAt = performance.now();
              try {
                Object.assign(finalResult, buildDeferredFields());
                finalResult.deferred_finalize_duration_ms = roundTiming(
                  Math.max(0, performance.now() - deferredStartedAt),
                );
              } finally {
                removeResetHook?.();
                settle();
              }
            };
            const task =
              typeof sharedEngine?.queueSafeTask === "function"
                ? sharedEngine.queueSafeTask(applyHeavyFields, {
                    label: "dynamic_deferred_finalize",
                    estimatedCostMs: 8,
                  })
                : null;
            if (!task) {
              removeResetHook?.();
              settle();
            }
          });
        };
        trialData.__finalize = deferredFinalize;

        // Return the minimal trial data through jsPsych's promise-result
        // path. PHASE B completes before the core runs on_finish.
        resolveTrial(trialData);
      };

      const startPresentation = (): void | Promise<void> => {
        if (trialEnded) return;
        if (previousTrialMetricEndCursors === null) {
          // Primer trial del experimento: baseline antes de cualquier commit.
          previousTrialMetricEndCursors = getCanvasStages(
            visualRenderContainer,
          ).map((stage) => stage.snapshotCountersNoPoll());
        }

        const trialDuration = resolveTimingMs(trial.trial_duration, null);
        persistentVisualBoundary = isFrameBoundaryVisualTrial(
          trialDuration,
          stimulusComponents,
          responseComponents,
        );
        if (persistentVisualBoundary) {
          if (!detachedExecution) {
            throw new Error("persistent_visual_descriptor_mismatch");
          }
          visualRenderContainer = mainContainer;
          responseTiming.setContainer(visualRenderContainer);
        } else {
          removePersistentVisualSurface();
          visualRenderContainer = mainContainer;
        }

        // P1.1 (iteración 6): habilitar la grabación de series de métricas
        // del renderer para ESTE trial (debug diagnostics) — el snapshot del
        // boundary depende de estos contadores.
        for (const stage of getCanvasStages(visualRenderContainer)) {
          stage.setMetricSeriesRecording?.(
            initialDiagnostics.includeRenderSeries,
            initialDiagnostics.includeGpuSeries,
          );
        }

        const finishPresentation = () => {
        const componentReadiness = allComponents.map((component) =>
          component.lifecycle.getReadinessDiagnostics(),
        );
        const unavailable = componentReadiness.find((item) => !item.ready);
        if (unavailable) {
          throw new Error(
            unavailable.fallbackReason || unavailable.reason || "component_not_ready",
          );
        }
        resourceReadyAt = componentReadiness.reduce<number | null>(
          (latest, item) =>
            item.resourceReadyAt === null
              ? latest
              : Math.max(latest ?? item.resourceReadyAt, item.resourceReadyAt),
          null,
        );
        gpuReadyAt = componentReadiness.reduce<number | null>(
          (latest, item) =>
            item.gpuReadyAt === null
              ? latest
              : Math.max(latest ?? item.gpuReadyAt, item.gpuReadyAt),
          null,
        );
        // Arming belongs to preparation, not to the presentation tick. Any
        // listener/resource setup exposed by a precision component is complete
        // before this state can be marked ready for an atomic transition.
        for (const component of allComponents) {
          component.lifecycle.arm();
        }
        // P1.3: optional prepare-time GPU synchronization. Runs ONLY here
        // (preparation), never inside the critical rAF tick. `fence` can
        // CONFIRM driver completion of the texture uploads; `finish`/`none`
        // only guarantee that commands were issued — the metrics distinguish
        // the two honestly.
        // P0.5 (iteración 6): materializar las transacciones visuales
        // agrupadas (offsets+onsets del mismo target) como transacciones
        // atómicas del FrameEngine antes de declarar readiness.
        timing.flushVisualTransactions?.();
        const gpuPrepareSyncMode = String(
          resolveRawValue(trial.gpu_prepare_sync) ?? "none",
        );
        if (gpuPrepareSyncMode !== "none") {
          const gpuStartedAt = performance.now();
          this.prepareGpuDuringResponseWindow =
            hostFrameEngine.getDiagnostics?.().response_sensitive === true;
          for (const stage of getCanvasStages(visualRenderContainer)) {
            try {
              stage.syncGpuForPrepare();
            } catch (error) {
              console.warn("DynamicPlugin prepare-time GPU sync failed:", error);
            }
          }
          this.prepareGpuMs = Math.max(0, performance.now() - gpuStartedAt);
        }
        // Install one shared response event hub during preparation. The onset
        // tick only switches its active manager; it does not add DOM listeners.
        if (hasResponseInputs) {
          responseTiming.arm();
          responseTiming.refreshPointerLayout?.();
          ensureSafePointerLayoutRefresh(responseTiming);
        }
        for (const stage of getCanvasStages(visualRenderContainer)) {
          visualBackgroundDisposers.push(
            stage.registerRect({
              id: visualBackgroundId,
              x: 0,
              y: 0,
              width: canvasWidth,
              height: canvasHeight,
              color: trial.__canvasStyles?.backgroundColor ?? "transparent",
              zIndex: -2147483648,
              visible: false,
            }),
          );
        }
        // P1.1/P1.2 (iteración 4): para Image/Text (+ KeyboardResponse o
        // ClickResponse sin marker, que no dibujan UI) los píxeles
        // experimentales viven enteramente en la superficie WebGL persistente.
        // Las mutaciones DOM de layout/style no son parte del path crítico y
        // jamás deben correr dentro del rAF tick.
        const responseComponentsDrawDomVisuals = responseComponents.some(
          ({ config }) => {
            const type = String(resolveRawValue(config.type) ?? "");
            if (type === "KeyboardResponseComponent") return false;
            if (
              type === "ClickResponseComponent" &&
              resolveRawValue(config.show_click_marker) === false &&
              resolveRawValue(config.capture_full_screen) !== false &&
              resolveRawValue(config.relative_to_element) !== true &&
              !resolveRawValue(config.target_selector)
            ) {
              return false;
            }
            return true;
          },
        );
        const pureWebGLPresentation =
          persistentVisualBoundary &&
          !responseComponentsDrawDomVisuals;
        const setContainerVisibility = (visible: boolean) => {
          if (pureWebGLPresentation) return;
          mainContainer.style.visibility = visible ? "visible" : "hidden";
          trialContext.recordCriticalDomMutation?.(1);
        };
        timing.onStart((timestamp) => {
          presentationActivated = true;
          physicalActivationIndex ??= ++physicalActivationSequenceCounter;
          setContainerVisibility(true);
          for (const stage of getCanvasStages(visualRenderContainer)) {
            stage.setDrawableVisibility(visualBackgroundId, true);
          }
          for (const component of stimulusComponents) {
            component.lifecycle.activate({ timestamp });
          }
          // P0.1 (iteration 3): for an early-transition-safe trial the shared
          // response hub switches authority in the SAME rAF tick where the
          // presentation changes. Between the visual commit of B and the core
          // reaching Trial B.run(), hub.active must already be B — a keydown
          // whose event.timeStamp is after the commit is never lost. No DOM
          // listeners are added here: the hub was armed during prepare() and
          // activate() is an O(1) pointer switch.
          if (hasResponseInputs && !responseTimingAttached) {
            activateLogicalResponses();
          }
          for (const stage of getCanvasStages(visualRenderContainer)) {
            stage.setTrialActive(true);
          }
        });
        trialContext.setPresentationLifecycle({
          arm: (info) => {
            for (const component of allComponents) {
              component.lifecycle.arm({
                scheduledTimestamp: info.targetTime,
                predictedSelectedFrameTime:
                  info.predictedSelectedFrameTime,
                reason: info.reason,
              });
            }
          },
          deactivate: (info) => {
            for (const stage of getCanvasStages(visualRenderContainer)) {
              stage.setDrawableVisibility(visualBackgroundId, false);
            }
            for (const component of allComponents) {
              component.lifecycle.deactivate({ timestamp: info.timestamp });
            }
            setContainerVisibility(false);
            if (responseTimingAttached) {
              responseTiming.deactivate();
              responseTimingAttached = false;
            }
            trialContext.setResponseSensitive?.(false);
            // Image/Text offset callbacks are completed by the single shared
            // stage commit later in this same rAF tick.
          },
        });

        // Handle trial duration on measured animation frames.
        if (trialDuration !== null) {
          persistentVisualBoundaryLeadMs = persistentVisualBoundary
            ? 0
            : null;

          // P0.1 (iteración 5): la duración máxima se PREDECLARA como
          // boundary en el FrameEngine desde el onset, aunque
          // response_ends_trial=true. Así nearest_frame puede escoger el
          // frame correcto (3 a 60.1 Hz, no 4); una respuesta temprana
          // reemplaza el boundary pendiente con un único commit.
          timing.onStart((timestamp) => {
            requestTrialEnd(timestamp, "trial_duration");
          });
        }

        precisionReadyAt = performance.now();
        precisionReady = true;
        precisionReadyReason = "all_first_commit_resources_ready";
        const publishStartedAt = performance.now();
        trialContext.markReady(precisionReadyAt, {
          precisionReadyReason,
          precisionFallbackReason: "",
          resourceReadyAt,
          gpuReadyAt,
        });
        this.preparePublishMs = Math.max(
          0,
          performance.now() - publishStartedAt,
        );
        execution.onReady?.();
        };
        const rendering = renderAllComponents();
        if (rendering) return rendering.then(finishPresentation);
        finishPresentation();
      };

      // P4 fast activation path: when every image asset is SYNCHRONOUSLY READY
      // (present in the shared P3 cache AND usable for synchronous drawing —
      // `getReadyPreloadedBitmap`, which rejects cached elements that resolved
      // via the preload timeout with zero intrinsic dimensions) and there is no
      // audio/video to schedule, start the presentation SYNCHRONOUSLY (no
      // preload promise hop). This never waits for anything: if any resource is
      // not ready for synchronous draw, the normal preload path runs unchanged.
      let activationPath: "prepared_fast" | "normal" = "normal";
      let preparedResourcesUsed = 0;
      const beginPresentation = () => {
        const handlePreparationError = (error: unknown) => {
          execution.onPreparationError?.(error);
          if (!execution.onPreparationError) {
            console.error(
              "DynamicPlugin presentation preparation failed:",
              error,
            );
            resolveTrial({
              rt: null,
              timing_quality: "degraded",
              timing_quality_reason: "presentation_preparation_failed",
            });
          }
        };
        try {
          const pending = startPresentation();
          if (pending) {
            void pending.catch(handlePreparationError);
            return pending;
          }
        } catch (error) {
          handlePreparationError(error);
        }
      };

      // P0.2 (iteración 7): DOS NIVELES de preparación.
      // RESOURCE PREP (fetch/decode/GPU pesado) es SAFE-only y se difiere
      // durante ventanas response-sensitive. RUNTIME CONTEXT MATERIALIZATION
      // (recursos YA ready, bounded por contrato) puede ejecutarse entre
      // frames de un trial response-sensitive.
      const scheduleMainPresentation = (materializationOnly: boolean) => {
        for (const component of allComponents) {
          component.config.__materializationOnly = materializationOnly;
        }
        const prepEngine = hostFrameEngine;
        const deferNeeded =
          !materializationOnly &&
          (prepEngine.getDiagnostics?.().response_sensitive === true ||
            prepEngine.getWorkPhase?.() === "CRITICAL");
        const measuredRun = () => {
          const mainThreadStartedAt = performance.now();
          const wasDuringResponseWindow =
            hostFrameEngine.getDiagnostics?.().response_sensitive === true;
          try {
            const pending = beginPresentation();
            if (materializationOnly && pending) {
              throw new Error(
                "response_safe_materialization_became_asynchronous",
              );
            }
          } finally {
            const duration = Math.max(
              0,
              performance.now() - mainThreadStartedAt,
            );
            // P1.2 (iteración 7): la etapa main-thread se mide COMPLETA —
            // se acumulan todas las fases scheduler-owned del trial.
            this.prepareMainThreadMs = Math.max(
              0,
              (this.prepareMainThreadMs ?? 0) + duration,
            );
            this.prepareMainThreadDuringResponseWindow =
              this.prepareMainThreadDuringResponseWindow === true ||
              wasDuringResponseWindow;
            if (materializationOnly) {
              this.runtimeMaterializationDuringResponseWindow =
                wasDuringResponseWindow;
            }
          }
        };
        if (
          deferNeeded &&
          typeof prepEngine?.queuePreparationTask === "function"
        ) {
          this.prepareCompletionDeferredUntilSafe = true;
          prepEngine.queuePreparationTask(measuredRun, {
            label: "dynamic-trial-main-prep",
            estimatedCostMs: 4,
          });
        } else {
          measuredRun();
        }
      };

      // P0.2 (iteración 7): materialization-only requiere que TODOS los
      // componentes declaren sus recursos ready (contrato honesto). Un
      // componente sin contrato va por el camino pesado (SAFE-only).
      const componentsResourceReady = allComponents.every((component: any) => {
        const state =
          component.lifecycle.getResourceReadinessState?.(component.config) ?? {};
        return state.resourceReady === true && state.gpuResourceReady === true;
      });
      if (descriptorMaterializationOnly && !componentsResourceReady) {
        throw new Error("prepared_descriptor_readiness_mismatch");
      }
      if (trial.preload_assets !== false) {
        const currentAssets = collectAssetPreloadList(allComponents);
        const cachedImageCount = currentAssets.images.filter(
          (url) => getReadyPreloadedBitmap(url) !== null,
        ).length;
        preparedResourcesUsed = cachedImageCount;
        const allImagesCached =
          cachedImageCount === currentAssets.images.length;
        const fastPathEligible =
          allImagesCached &&
          currentAssets.video.length === 0;
        const materializationOnly =
          descriptorMaterializationOnly &&
          fastPathEligible &&
          componentsResourceReady;

        if (materializationOnly) {
          activationPath = "prepared_fast";
          scheduleMainPresentation(true);
        } else {
          // RESOURCE_ASYNC: la espera del recurso es medible y puede estar en
          // vuelo durante una response window; su continuación vuelve al
          // scheduler (nunca continúa arbitrariamente en el main thread).
          const resourcesStartedAt = performance.now();
          preloadAssets(
            this.jsPsych,
            currentAssets,
            resolveTimingMs(trial.asset_preload_timeout, 10000) ?? 10000,
          )
            .catch((error) => {
              console.warn("DynamicPlugin asset preload failed:", error);
            })
            .then(() => {
              this.prepareResourceWaitMs = Math.max(
                0,
                performance.now() - resourcesStartedAt,
              );
              scheduleMainPresentation(false);
            });
        }
      } else {
        // Desactivar el preloader no concede autoridad para inferir seguridad.
        // Sólo un PreparedTrialDescriptor publicado explícitamente habilita
        // materialización durante una ventana response-sensitive.
        scheduleMainPresentation(
          descriptorMaterializationOnly && componentsResourceReady,
        );
      }
    });
  }
}

export default DynamicPlugin;
