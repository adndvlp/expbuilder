import { JsPsych, JsPsychPlugin, ParameterType, TrialType } from "jspsych";

const version = "1.0.0";

// Import all component types
import ImageComponent from "./components/ImageComponent";
import VideoComponent from "./components/VideoComponent";
import HtmlComponent from "./components/HtmlComponent";
import TextComponent from "./components/TextComponent";
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
  VisualBoundaryPolicy,
} from "./utils/PrecisionTiming";
import ResponseTimingManager from "./utils/ResponseTimingManager";
import {
  createVisualHandoff,
  VisualHandoffSnapshot,
} from "./utils/VisualHandoff";
import { getCanvasStages, StageMetrics } from "./renderer/CanvasStage";

const DYNAMIC_CONTAINER_ID = "jspsych-dynamic-plugin-container";
const DYNAMIC_VISUAL_BRIDGE_ID = "jspsych-dynamic-visual-bridge";
const DYNAMIC_PERSISTENT_VISUAL_ID = "jspsych-dynamic-persistent-visual";

/**
 * Structural (runtime) contract of the ExpBuilder jsPsych Timing V1
 * coordinator (`jsPsych.timing`, P0). Feature-detected at runtime — never by
 * version strings — so this plugin keeps working with official jsPsych
 * (legacy VisualHandoff path) and with the Timing fork (host path).
 */
interface HostTrialOrigin {
  timestamp: number;
  source: "host_coordinator";
  fromTrialIndex: number;
  frameIndex: number | null;
  acquiredAt: number;
}

interface TimingTransitionOutcome {
  fromTrialIndex: number;
  toTrialIndex: number;
  status: "acquired" | "lost";
  reason: string | null;
}

interface HostTimingCoordinator {
  /** Defines host authority: feature-detected and required. */
  acquireTrialOrigin(requesterTrialIndex: number): HostTrialOrigin | null;
  /** Feature-detected individually at call sites. */
  registerHandoff?(
    timestamp: number,
    meta?: { frameIndex?: number; frameIntervalEstimateMs?: number },
  ): { status: "pending" } | { status: "rejected"; reason: string };
  /** Feature-detected individually at call sites. */
  getTransitionOutcome?(
    requesterTrialIndex: number,
  ): TimingTransitionOutcome | null;
}

interface HostFrameEngine {
  createTrialContext(options?: {
    id?: string;
    trialIndex?: number | null;
    continuous?: boolean;
    allowEarlyActivation?: boolean;
  }): HostTrialTimingContext;
  onVisualCommit(
    callback: (timestamp: number, observation: any) => void,
  ): () => void;
  onReset(callback: () => void): () => void;
  canStartBackgroundWork(): boolean;
  queueSafeTask(
    task: () => void,
    options?: { label?: string; estimatedCostMs?: number },
  ): void;
}

type TimingContinuity = "logical_only" | "lost" | "none";

let preservedVisualBridge: HTMLElement | null = null;
let preservedVisualBridgeObserver: MutationObserver | null = null;
let persistentVisualSurface: HTMLElement | null = null;
let persistentVisualFrameEngine: HostFrameEngine | null = null;
let removePersistentVisualCommit: (() => void) | null = null;
let removePersistentVisualReset: (() => void) | null = null;
let persistentVisualResizeObserver: ResizeObserver | null = null;
let persistentVisualLayout: {
  width: number;
  height: number;
  backgroundColor: string;
} | null = null;
const visualHandoff = createVisualHandoff();
let dynamicTrialSequenceCounter = 0;

type ContainerTeardownRegistry = {
  callbacks: Map<HTMLElement, () => void>;
  observer: MutationObserver;
};

const containerTeardownRegistries = new WeakMap<
  HTMLElement,
  ContainerTeardownRegistry
>();

/** One DOM-removal observer per display, regardless of prepared trial count. */
function registerContainerTeardown(
  displayElement: HTMLElement,
  container: HTMLElement,
  callback: () => void,
) {
  let registry = containerTeardownRegistries.get(displayElement);
  if (!registry) {
    const callbacks = new Map<HTMLElement, () => void>();
    const visitRemovedNode = (node: Node) => {
      if (!(node instanceof HTMLElement)) return;
      callbacks.get(node)?.();
      for (const descendant of node.querySelectorAll<HTMLElement>(
        '[data-dynamic-plugin-container="true"]',
      )) {
        callbacks.get(descendant)?.();
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
    registry = { callbacks, observer };
    containerTeardownRegistries.set(displayElement, registry);
  }

  registry.callbacks.set(container, callback);
  let registered = true;
  return () => {
    if (!registered) return;
    registered = false;
    registry!.callbacks.delete(container);
    if (registry!.callbacks.size === 0) {
      registry!.observer.disconnect();
      containerTeardownRegistries.delete(displayElement);
    }
  };
}

// ---------------------------------------------------------------------------
// P3 — prepared presentation (static resource prewarm).
//
// Ordinary timelines cannot safely reveal an unresolved next trial. P3 is the
// legacy/resource-only fallback driven by a builder-generated STATIC manifest
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

type PendingVisualDurationPatch = {
  jsPsych: any;
  trialSequence: number;
  onsetCommitTime: number | null;
  expectedDuration: number | null;
  stimulus: string | null;
  frameBoundaryHandoff: boolean;
};

let pendingVisualDurationPatch: PendingVisualDurationPatch | null = null;

function removePreservedVisualBridge() {
  preservedVisualBridgeObserver?.disconnect();
  preservedVisualBridgeObserver = null;
  preservedVisualBridge?.remove();
  preservedVisualBridge = null;
}

function monitorPreservedVisualBridge(displayElement: HTMLElement) {
  preservedVisualBridgeObserver?.disconnect();
  preservedVisualBridgeObserver = new MutationObserver(() => {
    if (!preservedVisualBridge) return;
    if (displayElement.childNodes.length === 0) return;
    if (
      displayElement.querySelector(
        `#${DYNAMIC_CONTAINER_ID}, [data-dynamic-plugin-container="true"]`,
      )
    )
      return;
    removePreservedVisualBridge();
  });
  preservedVisualBridgeObserver.observe(displayElement, {
    childList: true,
    subtree: true,
  });
}

function preserveCanvasVisualBridge(
  mainContainer: HTMLElement,
  displayElement: HTMLElement,
) {
  const canvases = getCanvasStages(mainContainer).filter(
    (stage) => stage.canvas.parentNode !== null,
  );

  removePreservedVisualBridge();
  if (canvases.length === 0) return;

  const bridge = document.createElement("div");
  bridge.id = DYNAMIC_VISUAL_BRIDGE_ID;
  bridge.setAttribute("aria-hidden", "true");
  bridge.style.position = "fixed";
  bridge.style.left = "0";
  bridge.style.top = "0";
  bridge.style.width = "100vw";
  bridge.style.height = "100vh";
  bridge.style.margin = "0";
  bridge.style.padding = "0";
  bridge.style.overflow = "hidden";
  bridge.style.pointerEvents = "none";
  bridge.style.zIndex = "2147483647";

  for (const stage of canvases) {
    const canvas = stage.canvas;
    const rect = canvas.getBoundingClientRect();
    canvas.style.position = "fixed";
    canvas.style.left = `${rect.left}px`;
    canvas.style.top = `${rect.top}px`;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    canvas.style.margin = "0";
    canvas.style.transform = "none";
    canvas.style.pointerEvents = "none";
    bridge.appendChild(canvas);
  }

  document.body.appendChild(bridge);
  preservedVisualBridge = bridge;
  monitorPreservedVisualBridge(displayElement);
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

function getPersistentVisualSurface(
  width: number,
  height: number,
  backgroundColor: string,
) {
  if (!persistentVisualSurface) {
    persistentVisualSurface = document.createElement("div");
    persistentVisualSurface.id = DYNAMIC_PERSISTENT_VISUAL_ID;
    persistentVisualSurface.setAttribute("aria-hidden", "true");
    persistentVisualSurface.style.pointerEvents = "none";
    persistentVisualSurface.style.zIndex = "2147483646";
    document.body.appendChild(persistentVisualSurface);
  }
  persistentVisualLayout = { width, height, backgroundColor };
  styleVisualContainer(persistentVisualSurface, width, height, backgroundColor);
  if (
    !persistentVisualResizeObserver &&
    typeof ResizeObserver !== "undefined"
  ) {
    persistentVisualResizeObserver = new ResizeObserver(() => {
      if (!persistentVisualSurface || !persistentVisualLayout) return;
      styleVisualContainer(
        persistentVisualSurface,
        persistentVisualLayout.width,
        persistentVisualLayout.height,
        persistentVisualLayout.backgroundColor,
      );
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
    removePersistentVisualSurface();
  });
}

function removePersistentVisualSurface() {
  persistentVisualResizeObserver?.disconnect();
  persistentVisualResizeObserver = null;
  persistentVisualLayout = null;
  if (persistentVisualSurface) {
    visualHandoff.clear("surface_removed");
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

function setPersistentVisualHandoff(
  timestamp: number,
  fromTrialSequence: number,
) {
  visualHandoff.set(timestamp, fromTrialSequence);
}

function consumePersistentVisualHandoffTimestamp(): VisualHandoffSnapshot {
  return visualHandoff.consume();
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
    /** Visual-boundary policy. Builder defaults to bounded frame tolerance. */
    boundary_policy: {
      type: ParameterType.STRING,
      default: "frame_tolerant_not_before",
    },
    /** Required frame count for frame_count paradigms. */
    boundary_frame_count: {
      type: ParameterType.INT,
      default: null,
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
    visual_frame_boundary_handoff: {
      type: ParameterType.BOOL,
    },
    visual_frame_boundary_handoff_lead_ms: {
      type: ParameterType.FLOAT,
    },
    visual_handoff_available: {
      type: ParameterType.BOOL,
    },
    visual_handoff_consumed: {
      type: ParameterType.BOOL,
    },
    visual_handoff_lost: {
      type: ParameterType.BOOL,
    },
    visual_handoff_lost_reason: {
      type: ParameterType.STRING,
    },
    visual_handoff_from_trial_sequence: {
      type: ParameterType.INT,
    },
    timing_continuity: {
      type: ParameterType.STRING,
    },
    timing_lost_reason: {
      type: ParameterType.STRING,
    },
    timing_handoff_from_trial_index: {
      type: ParameterType.INT,
    },
    timing_handoff_frame_index: {
      type: ParameterType.INT,
    },
    timing_handoff_acquired_at: {
      type: ParameterType.FLOAT,
    },
    timing_handoff_register_status: {
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

function patchPreviousVisualDuration(
  jsPsych: any,
  nextOnsetCommitTime: number | null,
  nextStimulus: string | null,
  nextTrialSequence: number,
) {
  const pending = pendingVisualDurationPatch;
  if (
    !pending ||
    pending.jsPsych !== jsPsych ||
    !pending.frameBoundaryHandoff ||
    typeof pending.onsetCommitTime !== "number" ||
    typeof nextOnsetCommitTime !== "number"
  ) {
    return null;
  }

  const visualDuration = nextOnsetCommitTime - pending.onsetCommitTime;
  const visualDurationError = roundTiming(
    pending.expectedDuration === null
      ? null
      : visualDuration - pending.expectedDuration,
  );
  const currentRowPreviousVisualData = {
    previous_visual_trial_sequence: pending.trialSequence,
    previous_visual_stimulus: pending.stimulus,
    previous_visual_onset_commit_time: roundTiming(pending.onsetCommitTime),
    previous_visual_offset_commit_time: roundTiming(nextOnsetCommitTime),
    previous_visual_duration: roundTiming(visualDuration),
    previous_visual_duration_error: visualDurationError,
    previous_visual_duration_source: "next_visual_onset_commit",
  };

  pendingVisualDurationPatch = null;
  return currentRowPreviousVisualData;
}

function closePendingVisualDuration(jsPsych: any, reason: string) {
  const pending = pendingVisualDurationPatch;
  if (!pending || pending.jsPsych !== jsPsych) return;
  pendingVisualDurationPatch = null;
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
  const responsesDoNotDrawVisuals = responseComponents.every(
    ({ config }) =>
      String(resolveRawValue(config.type) ?? "") ===
      "KeyboardResponseComponent",
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
  const usesPersistentBackend = visualStimuli.every(({ config }) => {
    const type = String(resolveRawValue(config.type) ?? "");
    return (
      (type === "ImageComponent" ||
        (type === "TextComponent" && !isClozeTextComponent(config))) &&
      usesWholeTrialStimulusWindow(config, trialDuration)
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

function aggregateRenderMetrics(
  stageMetrics: StageMetrics[],
  requestedBackend: string,
) {
  const commitDurations = stageMetrics.flatMap(
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
  private preparedTrialReady = true;
  private preparedTrialFallbackReason: string | null = null;

  constructor(private jsPsych: JsPsych) {}

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

    const context = preparation.frameEngine.createTrialContext({
      id: `dynamic-${dynamicTrialSequenceCounter + 1}`,
      trialIndex: preparation.trialIndex,
      continuous: true,
      allowEarlyActivation: true,
    });
    bindPersistentVisualSurfaceToFrameEngine(preparation.frameEngine);

    let resolveReady!: () => void;
    let rejectReady!: (error: unknown) => void;
    const ready = new Promise<void>((resolve, reject) => {
      resolveReady = resolve;
      rejectReady = reject;
    });
    let dispose = () => context.stop();
    let startLogicalLifecycle = () => {};
    const result = this.runTrial(displayElement, trial, {
      frameEngine: preparation.frameEngine,
      trialContext: context,
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
    } catch (error) {
      const reason =
        error instanceof Error && error.message
          ? `precision_prepare_failed:${error.message}`
          : "precision_prepare_failed";
      this.preparedTrialReady = false;
      this.preparedTrialFallbackReason = reason;
      context.markNotReady?.(reason, {
        precisionFallbackReason: reason,
      });
      if (this.preparedExecution === preparedExecution) {
        this.preparedExecution = null;
      }
      dispose();
    }
  }

  isPreparedTrialReady() {
    return this.preparedTrialReady && this.preparedExecution !== null;
  }

  getPreparedTrialFallbackReason() {
    return this.preparedTrialFallbackReason;
  }

  discardPreparedTrial() {
    const prepared = this.preparedExecution;
    if (!prepared) return;
    this.preparedExecution = null;
    prepared.dispose();
  }

  setPreparedTrialIndex(trialIndex: number) {
    this.preparedExecution?.context.setTrialIndex(trialIndex);
  }

  trial(displayElement: HTMLElement, trial: TrialType<Info>) {
    const prepared = this.preparedExecution;
    if (prepared) {
      this.preparedExecution = null;
      Object.assign(prepared.trial, trial);
      prepared.context.start();
      prepared.startLogicalLifecycle();
      return prepared.result;
    }
    return this.runTrial(displayElement, trial);
  }

  private runTrial(
    display_element: HTMLElement,
    trial: TrialType<Info> | any,
    execution: {
      frameEngine?: HostFrameEngine;
      trialContext?: HostTrialTimingContext;
      onReady?: () => void;
      onPreparationError?: (error: unknown) => void;
      registerCancel?: (cancel: () => void) => void;
      registerLogicalStart?: (start: () => void) => void;
    } = {},
  ) {
    const dynamicTrialSequence = ++dynamicTrialSequenceCounter;
    const trialContext = execution.trialContext ?? null;
    const hostFrameEngine = execution.frameEngine ?? null;

    // Single timing-authority decision per trial. When the host exposes the
    // Timing V1 coordinator, it is the ONLY origin authority (success or
    // fresh_raf); the legacy VisualHandoff path is used exclusively when the
    // coordinator is absent (official jsPsych).
    const hostTiming = (this.jsPsych as any)?.timing as
      | HostTimingCoordinator
      | undefined;
    const hostTimingAvailable =
      trialContext === null &&
      typeof hostTiming?.acquireTrialOrigin === "function";

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
      // Inject plugin styles if not already present
      if (!document.getElementById("jspsych-dynamic-plugin-styles")) {
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

      // Create main container for all components
      const mainContainer = document.createElement("div");
      mainContainer.id = trialContext
        ? `${DYNAMIC_CONTAINER_ID}-${dynamicTrialSequence}`
        : DYNAMIC_CONTAINER_ID;
      mainContainer.dataset.dynamicPluginContainer = "true";
      mainContainer.style.visibility = "hidden";
      mainContainer.style.background =
        trial.__canvasStyles?.backgroundColor ?? "transparent";
      display_element.appendChild(mainContainer);

      // Design canvas dimensions
      const canvasWidth = trial.__canvasStyles?.width ?? 1024;
      const canvasHeight = trial.__canvasStyles?.height ?? 768;

      // Scale to fit viewport (same mechanism as ExperimentPreview iframe)
      const updateScale = () => {
        const ratio = Math.min(
          window.innerWidth / canvasWidth,
          window.innerHeight / canvasHeight,
        );
        mainContainer.style.width = canvasWidth + "px";
        mainContainer.style.height = canvasHeight + "px";
        mainContainer.style.transform =
          "translate(-50%, -50%) scale(" + ratio + ")";
      };
      updateScale();

      const resizeObserver = trialContext
        ? null
        : new ResizeObserver(() => updateScale());
      resizeObserver?.observe(document.documentElement);

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
      const visualBackgroundId = `dynamic-background-${trialContext?.id ?? dynamicTrialSequence}`;
      let hasResponded = false;
      let trialEnded = false;
      let trialEndedByResponse = false;
      let visualFrameBoundaryHandoff = false;
      let visualFrameBoundaryHandoffLeadMs: number | null = null;
      let consumedVisualHandoff: VisualHandoffSnapshot | null = null;
      let hostOrigin: HostTrialOrigin | null = null;
      let timingContinuity: TimingContinuity = "none";
      let timingLostReason: string | null = null;
      let hostRegisterStatus: string | null = null;
      let pendingEnd: { requestTimestamp: number; reason: string } | null =
        null;
      let previousVisualDurationPatched = false;
      let previousVisualDurationData: Record<string, any> | null = null;
      let handleParticipantResponse: (
        offsetTime?: number | null,
        options?: { force?: boolean },
      ) => boolean = () => false;
      let precisionReady = false;
      let precisionReadyAt: number | null = null;
      let precisionReadyReason = "";
      let precisionFallbackReason = this.preparedTrialFallbackReason ?? "";
      let resourceReadyAt: number | null = null;
      let gpuReadyAt: number | null = null;
      const responseTiming = new ResponseTimingManager({
        trial,
        timing,
        container: mainContainer,
        canvasWidth,
        canvasHeight,
        onFinish: (timestamp, options) =>
          handleParticipantResponse(timestamp, options),
      });
      let presentationActivated = false;
      let logicalLifecycleStarted = trialContext === null;
      let responseTimingAttached = false;
      const activateLogicalResponses = () => {
        logicalLifecycleStarted = true;
        if (!presentationActivated || responseTimingAttached) return;
        for (const component of responseComponents) {
          component.lifecycle.activate({
            timestamp:
              trialContext?.getLatestFrameTime() ??
              timing.getTrialTimeOrigin() ??
              performance.now(),
          });
        }
        if (hasResponseInputs) {
          responseTiming.activate();
          responseTimingAttached = true;
          trialContext?.setResponseSensitive?.(true);
        }
      };
      execution.registerLogicalStart?.(activateLogicalResponses);

      // External core teardown detection. `jsPsych.abortExperiment()` resolves
      // the core trial promise and clears `display_element` WITHOUT resolving
      // this plugin's own promise. When the core removes our container while
      // the trial is still active, cancel every internal resource. This works
      // identically on official jsPsych (no jsPsych.timing involved).
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
        trialContext?.setResponseSensitive?.(false);
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
        mainContainer.remove();
        if (removeGlobalVisuals) {
          removePersistentVisualSurface();
          removePreservedVisualBridge();
        }
        if (
          pendingVisualDurationPatch?.trialSequence === dynamicTrialSequence
        ) {
          pendingVisualDurationPatch = null;
        }
      };

      if (typeof MutationObserver !== "undefined") {
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
          config.__canvasStyles = trialContext
            ? { ...trial.__canvasStyles, backgroundColor: "transparent" }
            : trial.__canvasStyles;
          config.__renderBackend = trial.render_backend || "webgl-strict";
          config.__recordGpuTiming = trial.record_gpu_timing !== false;
          config.__recordCommitSeries = initialDiagnostics.includeRenderSeries;
          config.__recordGpuSeries = initialDiagnostics.includeGpuSeries;
          config.__precisionGlobalPath = trialContext !== null;
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
            config.__runtimeComponentId = `${trialContext?.id ?? dynamicTrialSequence}:${config.__componentId}`;
            config.__deferOffsetToTrialBoundary =
              trialContext !== null &&
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
          config.__canvasStyles = trialContext
            ? { ...trial.__canvasStyles, backgroundColor: "transparent" }
            : trial.__canvasStyles;
          config.__renderBackend = trial.render_backend || "webgl-strict";
          config.__recordGpuTiming = trial.record_gpu_timing !== false;
          config.__recordCommitSeries = initialDiagnostics.includeRenderSeries;
          config.__recordGpuSeries = initialDiagnostics.includeGpuSeries;
          config.__precisionGlobalPath = trialContext !== null;
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
            config.__runtimeComponentId = `${trialContext?.id ?? dynamicTrialSequence}:${config.__componentId}`;
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
        component.lifecycle = createPrecisionComponentLifecycle(
          component.instance,
        );
      }
      allComponents.sort(
        (a, b) => (a.config.zIndex ?? 0) - (b.config.zIndex ?? 0),
      );

      const renderAllComponents = async () => {
        // Pass onResponse callback to ALL components so they can end the trial if needed
        const preparations = allComponents.map((comp) => {
          const { instance, config } = comp;
          const _prevLen = visualRenderContainer.children.length;
          const renderedElement = comp.lifecycle.prepare(
            visualRenderContainer,
            config,
            () => {
              handleParticipantResponse();
            },
          );
          // Capture the topmost new child appended during render (synchronous DOM op)
          comp.renderedEl =
            visualRenderContainer.children.length > _prevLen
              ? (visualRenderContainer.lastElementChild as HTMLElement)
              : null;
          return Promise.resolve(renderedElement).then((resolvedElement) => {
            if (!comp.renderedEl && resolvedElement instanceof HTMLElement) {
              comp.renderedEl = resolvedElement;
            }
          });
        });
        await Promise.all(preparations);
      };

      // Function to record all pending responses before ending trial
      const recordAllPendingResponses = () => {
        // Record responses from all response components that haven't responded yet
        responseComponents.forEach(({ instance, config }) => {
          if (
            instance.recordResponse &&
            typeof instance.recordResponse === "function"
          ) {
            // Try to record response (will fail gracefully if validation fails)
            instance.recordResponse(config);
          }
        });

        // Record responses from stimulus components that have response capability
        stimulusComponents.forEach(({ instance, config }) => {
          if (
            instance.recordResponse &&
            typeof instance.recordResponse === "function"
          ) {
            // Try to record response (will fail gracefully if validation fails)
            instance.recordResponse(config);
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
        offsetTime: number | null = null,
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
        recordAllPendingResponses();
        const responseTime =
          typeof offsetTime === "number" ? offsetTime : performance.now();
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
        if (trialEnded || pendingEnd) {
          return false;
        }
        pendingEnd = { requestTimestamp, reason };
        if (timing.isGlobalFrameEngine()) {
          const trialDuration = resolveTimingMs(trial.trial_duration, null);
          const actualOrigin = timing.getTrialTimeOrigin();
          const targetTime =
            reason === "trial_duration" &&
            trialDuration !== null &&
            actualOrigin !== null
              ? actualOrigin + trialDuration
              : requestTimestamp;
          const requestedPolicy = String(
            trial.boundary_policy ?? "frame_tolerant_not_before",
          ) as VisualBoundaryPolicy;
          const validPolicies: VisualBoundaryPolicy[] = [
            "strict_not_before_ms",
            "frame_tolerant_not_before",
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
          return timing.requestBoundary({
            targetTimeMs: targetTime,
            boundaryPolicy,
            frameCount:
              boundaryPolicy === "frame_count" &&
              configuredFrameCount !== null
                ? configuredFrameCount
                : null,
            requestedAt: requestTimestamp,
            reason,
            allowTerminal: true,
            onCommit: (boundary) => {
              timing.queuePostCritical(
                () =>
                  endTrial(boundary.timestamp, {
                    postCommitTimestamp: boundary.timestamp,
                  }),
                { label: "dynamic_trial_finalize", estimatedCostMs: 8 },
              );
            },
          });
        }
        timing.queuePostCommit((commitTimestamp) => {
          endTrial(commitTimestamp, { postCommitTimestamp: commitTimestamp });
        });
        return true;
      };

      // Function to end the trial and collect data
      const endTrial = (
        offsetTime = performance.now(),
        options: { postCommitTimestamp?: number } = {},
      ) => {
        if (trialEnded) return;
        trialEnded = true;
        // Our own DOM cleanup must never be interpreted as an external abort.
        unregisterTeardown?.();
        unregisterTeardown = null;

        const timingSummary = timing.getSummary(offsetTime);
        const outgoingTransition = trialContext
          ? (timingSummary.transitionTelemetry.find(
              (transition: any) =>
                transition.outgoing_context_id === trialContext.id,
            ) ?? null)
          : null;

        // Outgoing host handoff: must be registered BEFORE control returns to
        // jsPsych (resolveTrial). For a P2-aligned end the explicit post-commit
        // timestamp is authoritative. A continuous end WITHOUT an aligned
        // commit timestamp is a hard/un-aligned end: NEVER register a previous
        // committed frame as if it were a valid transition.
        if (hostTimingAvailable && trial.timing_continuous === true) {
          if (typeof options.postCommitTimestamp !== "number") {
            hostRegisterStatus = "skipped_unaligned_end";
          } else if (typeof hostTiming.registerHandoff === "function") {
            const registerResult = hostTiming.registerHandoff(
              options.postCommitTimestamp,
              {
                frameIntervalEstimateMs: timing.getFrameIntervalEstimate(),
              },
            );
            hostRegisterStatus =
              registerResult.status === "pending"
                ? "pending"
                : `rejected:${registerResult.reason}`;
          } else {
            hostRegisterStatus = "skipped_no_register_api";
          }
        }
        const desiredTrialDuration = resolveTimingMs(
          trial.trial_duration,
          null,
        );
        const trialDurationError =
          desiredTrialDuration === null || timingSummary.actualDuration === null
            ? null
            : timingSummary.actualDuration - desiredTrialDuration;
        const diagnostics = getDiagnosticsOptions(trial);
        if (!trialContext) {
          for (const stage of getCanvasStages(visualRenderContainer)) {
            stage.setTrialActive(false);
          }
        }
        const renderMetrics = aggregateRenderMetrics(
          getCanvasStages(visualRenderContainer).map((stage) =>
            stage.getMetrics(),
          ),
          String(trial.render_backend || "webgl-strict"),
        );
        const domAudit = auditDomLayers(stimulusComponents, responseComponents);
        const visualTimingQuality = classifyTimingQuality(
          timingSummary,
          desiredTrialDuration,
          resolveTimingMs(trial.timing_quality_bad_threshold, 50) ?? 50,
          renderMetrics,
          domAudit,
          { ignoreTrialDurationError: trialEndedByResponse },
        );
        responseTiming.finishWithoutResponse(
          typeof offsetTime === "number" ? offsetTime : null,
        );
        responseTiming.detach();
        trialContext?.setResponseSensitive?.(false);
        const responseTimingData = responseTiming.getData();
        const timingQuality = mergeQuality(
          visualTimingQuality,
          responseTimingData.response_timing_quality,
          responseTimingData.response_timing_quality_reason,
        );
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
          visualFrameBoundaryHandoff && !trialContext
            ? null
            : typeof primaryStimulusRecord?.frame_offset_abs === "number"
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
          visualFrameBoundaryHandoff && !trialContext
            ? "reported_on_next_row_previous_visual_duration"
            : visualDuration === null
              ? "unavailable"
              : "stimulus_offset_commit";

        if (trialContext === null && !precisionFallbackReason) {
          precisionFallbackReason = (this.jsPsych as any)?.precisionTiming
            ? "precision_context_not_selected"
            : "global_frame_engine_unavailable";
        }
        const precisionPath = trialContext
          ? precisionFallbackReason
            ? "degraded"
            : "global_frame_engine"
          : precisionFallbackReason.startsWith("precision_prepare_failed")
            ? "degraded"
            : "legacy";

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
          response_valid: responseTimingData.response_valid,
          response_invalid_reason: responseTimingData.response_invalid_reason,
          precision_path: precisionPath,
          precision_path_active: trialContext !== null,
          precision_fallback_reason: precisionFallbackReason,
          precision_ready: precisionReady,
          precision_ready_at: precisionReadyAt,
          precision_ready_reason: precisionReadyReason,
          resource_ready_at: resourceReadyAt,
          gpu_ready_at: gpuReadyAt,
          early_transition_eligible: trialContext !== null,
          early_transition_rejected_reason:
            trialContext === null ? precisionFallbackReason : "",
          boundary_policy:
            outgoingTransition?.boundary_policy ??
            trial.boundary_policy ??
            "frame_tolerant_not_before",
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
        };

        if (diagnostics.includeSummary) {
          Object.assign(trialData, {
            timing_schema_version: 2,
            timing_method:
              "performance.now + requestAnimationFrame frame-nearest scheduler",
            timing_prepare_status: prepareStatus,
            timing_prepare_started_at: prepareStartedAt,
            timing_prepare_ready_at: prepareReadyAt,
            timing_activation_path: activationPath,
            timing_prepared_resources_used: preparedResourcesUsed,
            precision_path: precisionPath,
            precision_path_active: trialContext !== null,
            precision_fallback_reason: precisionFallbackReason,
            precision_ready: precisionReady,
            precision_ready_at: precisionReadyAt,
            precision_ready_reason: precisionReadyReason,
            resource_ready_at: resourceReadyAt,
            gpu_ready_at: gpuReadyAt,
            early_transition_eligible: trialContext !== null,
            early_transition_rejected_reason:
              trialContext === null ? precisionFallbackReason : "",
            boundary_policy:
              outgoingTransition?.boundary_policy ??
              trial.boundary_policy ??
              "frame_tolerant_not_before",
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
            ...(hostTimingAvailable
              ? {
                  timing_continuity: timingContinuity,
                  timing_lost_reason: timingLostReason,
                  ...(hostOrigin
                    ? {
                        timing_handoff_from_trial_index:
                          hostOrigin.fromTrialIndex,
                        timing_handoff_frame_index: hostOrigin.frameIndex,
                        timing_handoff_acquired_at: hostOrigin.acquiredAt,
                      }
                    : {}),
                  ...(hostRegisterStatus !== null
                    ? { timing_handoff_register_status: hostRegisterStatus }
                    : {}),
                }
              : {}),
            trial_onset_time: timingSummary.onsetTime,
            trial_offset_time: timingSummary.offsetTime,
            trial_duration_policy:
              desiredTrialDuration === null ? null : "not_before",
            stimulus_onset_policy: "nearest",
            stimulus_offset_policy: "not_before",
            actual_trial_duration: roundTiming(timingSummary.actualDuration),
            duration_error: roundTiming(trialDurationError),
            trial_ended_by_response: trialEndedByResponse,
            frame_count: timingSummary.frameCount,
            long_frame_count: timingSummary.longFrameCount,
            estimated_dropped_frame_count: timingSummary.droppedFrameCount,
            dropped_frame_count: timingSummary.droppedFrameCount,
            frame_interval_source: "requestAnimationFrame_gap",
            max_frame_interval: roundTiming(timingSummary.maxFrameInterval),
            mean_frame_interval: roundTiming(timingSummary.meanFrameInterval),
            frame_interval_estimate: roundTiming(
              timingSummary.frameIntervalEstimate,
            ),
            timing_quality: timingQuality.quality,
            timing_quality_reason: timingQuality.reason,
            visual_timing_quality: visualTimingQuality.quality,
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
            visual_next_onset_commit_time: null,
            visual_next_stimulus: null,
            previous_visual_trial_sequence: null,
            previous_visual_stimulus: null,
            previous_visual_onset_commit_time: null,
            previous_visual_offset_commit_time: null,
            previous_visual_duration: null,
            previous_visual_duration_error: null,
            previous_visual_duration_source: null,
            ...(previousVisualDurationData ?? {}),
            visual_frame_boundary_handoff: visualFrameBoundaryHandoff,
            visual_frame_boundary_handoff_lead_ms: roundTiming(
              visualFrameBoundaryHandoffLeadMs,
            ),
            visual_handoff_available: hostTimingAvailable
              ? false
              : (consumedVisualHandoff?.available ?? false),
            visual_handoff_consumed: hostTimingAvailable
              ? false
              : (consumedVisualHandoff?.consumed ?? false),
            visual_handoff_lost: hostTimingAvailable
              ? false
              : (consumedVisualHandoff?.lost ?? false) ||
                (visualFrameBoundaryHandoff &&
                  !(consumedVisualHandoff?.available ?? false)),
            visual_handoff_lost_reason: hostTimingAvailable
              ? ""
              : consumedVisualHandoff?.lostReason ||
                (visualFrameBoundaryHandoff &&
                !(consumedVisualHandoff?.available ?? false)
                  ? "not_available"
                  : ""),
            visual_handoff_from_trial_sequence: hostTimingAvailable
              ? null
              : (consumedVisualHandoff?.fromTrialSequence ?? null),
            response_timing_quality: responseTimingData.response_timing_quality,
            response_timing_quality_reason:
              responseTimingData.response_timing_quality_reason,
            diagnostics_level: diagnostics.level,
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
            dom_interactive_components: JSON.stringify(
              domAudit.dom_interactive_components,
            ),
            dom_visual_components: domAudit.dom_visual_components,
            dom_visual_component_names: JSON.stringify(
              domAudit.dom_visual_component_names,
            ),
            ...responseTimingData,
            rt: responseTimingData.rt,
          });
        }

        if (diagnostics.includeStimulusTiming) {
          trialData.stimulus_timing = JSON.stringify(
            timingSummary.stimulusRecords,
          );
        }

        if (diagnostics.includeFrameIntervals) {
          trialData.frame_intervals = JSON.stringify(
            timingSummary.frameIntervals,
          );
        }

        if (diagnostics.includeRenderSeries) {
          trialData.commit_durations = JSON.stringify(
            renderMetrics.commit_durations,
          );
        }

        if (diagnostics.includeGpuSeries) {
          trialData.gpu_draw_durations = JSON.stringify(
            renderMetrics.gpu_draw_durations,
          );
        }

        // Add stimulus components data as individual columns
        stimulusComponents.forEach((comp) => {
          const { instance, config } = comp;
          const prefix = config.name; // Component name (e.g., "ImageComponent_1")

          // Add type
          trialData[`${prefix}_type`] = config.type;

          // Add stimulus if exists
          if (config.stimulus !== undefined) {
            trialData[`${prefix}_stimulus`] = config.stimulus;
          }

          // TextComponent: save the text content as stimulus data
          if (config.text !== undefined) {
            trialData[`${prefix}_text`] = config.text;
          }

          // Coordinates → pixel center in the actual viewport at trial end time.
          // CSS formula: left = calc(50% + x*0.5 vw), top = calc(50% - y*0.5 vh)
          if (config.coordinates !== undefined) {
            const cx = config.coordinates.x ?? 0;
            const cy = config.coordinates.y ?? 0;
            trialData[`${prefix}_coordinates`] = JSON.stringify({
              x: Math.round(window.innerWidth * (0.5 + cx / 200)),
              y: Math.round(window.innerHeight * (0.5 - cy / 200)),
            });
          }

          // Size via component-provided rendered size when canvas rendering is used,
          // otherwise fall back to the DOM element captured at render time.
          if (
            instance.getRenderedSize &&
            typeof instance.getRenderedSize === "function"
          ) {
            const renderedSize = instance.getRenderedSize();
            if (renderedSize) {
              trialData[`${prefix}_size`] = JSON.stringify({
                width: Math.round(renderedSize.width),
                height: Math.round(renderedSize.height),
              });
            }
          } else if (comp.renderedEl) {
            const _r = comp.renderedEl.getBoundingClientRect();
            trialData[`${prefix}_size`] = JSON.stringify({
              width: Math.round(_r.width),
              height: Math.round(_r.height),
            });
          }

          // If component has response (like SurveyComponent)
          if (
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
                trialData[`${prefix}_${questionName}`] = response[questionName];
              });
            } else {
              trialData[`${prefix}_response`] = response;
            }
          }

          // Response timestamp source diagnostic (handler-fallback when no
          // DOM event was available for the semantic response).
          if (
            typeof (instance as any).getResponseTimestampSource === "function"
          ) {
            trialData[`${prefix}_response_timestamp_source`] = (
              instance as any
            ).getResponseTimestampSource();
          }

          // AudioComponent timing diagnostics (clock bridge / fallback).
          if (config.type === "AudioComponent") {
            const audioDiagnostics = (instance as any).getDiagnostics?.();
            if (audioDiagnostics && typeof audioDiagnostics === "object") {
              for (const [key, value] of Object.entries(audioDiagnostics)) {
                trialData[`${prefix}_${key}`] = value;
              }
            }
          }
          if (config.type === "VideoComponent") {
            const videoDiagnostics = (instance as any).getDiagnostics?.();
            if (videoDiagnostics && typeof videoDiagnostics === "object") {
              for (const [key, value] of Object.entries(videoDiagnostics)) {
                trialData[`${prefix}_${key}`] = value;
              }
            }
          }
        });

        // Add response components data as individual columns
        responseComponents.forEach((comp) => {
          const { instance, config } = comp;
          const prefix = config.name; // Component name (e.g., "ButtonResponseComponent_1")

          // Add type
          if (config.type !== "ClickResponseComponent") {
            trialData[`${prefix}_type`] = config.type;
          }

          // Coordinates and size (same logic as stimulus components)
          if (
            config.coordinates !== undefined &&
            config.type !== "ClickResponseComponent"
          ) {
            const cx = config.coordinates.x ?? 0;
            const cy = config.coordinates.y ?? 0;
            trialData[`${prefix}_coordinates`] = JSON.stringify({
              x: Math.round(window.innerWidth * (0.5 + cx / 200)),
              y: Math.round(window.innerHeight * (0.5 - cy / 200)),
            });
          }
          if (
            instance.getRenderedSize &&
            typeof instance.getRenderedSize === "function"
          ) {
            const renderedSize = instance.getRenderedSize();
            if (renderedSize) {
              trialData[`${prefix}_size`] = JSON.stringify({
                width: Math.round(renderedSize.width),
                height: Math.round(renderedSize.height),
              });
            }
          } else if (comp.renderedEl) {
            const _r = comp.renderedEl.getBoundingClientRect();
            trialData[`${prefix}_size`] = JSON.stringify({
              width: Math.round(_r.width),
              height: Math.round(_r.height),
            });
          }

          // Add response
          if (
            instance.getResponse &&
            typeof instance.getResponse === "function" &&
            config.type !== "ClickResponseComponent"
          ) {
            const response = instance.getResponse();
            trialData[`${prefix}_response`] = response;
          }

          // Response timestamp source diagnostic (handler-fallback when no
          // DOM event was available for the semantic response).
          if (
            typeof (instance as any).getResponseTimestampSource === "function"
          ) {
            trialData[`${prefix}_response_timestamp_source`] = (
              instance as any
            ).getResponseTimestampSource();
          }

          // KeyboardResponseComponent - correctness score
          if (
            config.type === "KeyboardResponseComponent" &&
            instance.getCorrect &&
            typeof instance.getCorrect === "function"
          ) {
            trialData[`${prefix}_correct`] = instance.getCorrect();
          }

          // ButtonResponseComponent - response event type diagnostic
          if (
            config.type === "ButtonResponseComponent" &&
            typeof (instance as any).getResponseEventType === "function"
          ) {
            trialData[`${prefix}_response_event_type`] = (
              instance as any
            ).getResponseEventType();
          }

          // SliderResponseComponent - slider_start
          if (
            config.type === "SliderResponseComponent" &&
            instance.getSliderStart
          ) {
            trialData[`${prefix}_slider_start`] = instance.getSliderStart();
          }

          // SketchpadComponent - strokes and png
          if (config.type === "SketchpadComponent") {
            if (
              instance.getStrokes &&
              typeof instance.getStrokes === "function"
            ) {
              trialData[`${prefix}_strokes`] = JSON.stringify(
                instance.getStrokes(),
              );
            }
            if (
              instance.getImageData &&
              typeof instance.getImageData === "function"
            ) {
              trialData[`${prefix}_png`] = instance.getImageData();
            }
          }

          // ClickResponseComponent - response = {x,y}, is_touch separate
          if (config.type === "ClickResponseComponent") {
            const clickResponse = instance.getResponse
              ? instance.getResponse()
              : null;
            if (clickResponse && typeof clickResponse === "object") {
              trialData[`${prefix}_response`] = JSON.stringify({
                x: clickResponse.x,
                y: clickResponse.y,
              });
              trialData[`${prefix}_is_touch`] = clickResponse.is_touch;
            }
          }

          // AudioResponseComponent - special fields
          if (config.type === "AudioResponseComponent") {
            const audioResponse = instance.getResponse
              ? instance.getResponse()
              : null;
            if (audioResponse && typeof audioResponse === "object") {
              trialData[`${prefix}_response`] = audioResponse.response;
              trialData[`${prefix}_audio_url`] = audioResponse.audio_url;
              trialData[`${prefix}_estimated_stimulus_onset`] =
                audioResponse.estimated_stimulus_onset;
            }
          }

          // FileUploadResponseComponent - file metadata fields
          if (config.type === "FileUploadResponseComponent") {
            if (
              instance.getFileUrl &&
              typeof instance.getFileUrl === "function"
            ) {
              trialData[`${prefix}_file_url`] = instance.getFileUrl();
            }
            if (
              instance.getFileSize &&
              typeof instance.getFileSize === "function"
            ) {
              trialData[`${prefix}_file_size`] = instance.getFileSize();
            }
            if (
              instance.getFileType &&
              typeof instance.getFileType === "function"
            ) {
              trialData[`${prefix}_file_type`] = instance.getFileType();
            }
          }
        });

        if (visualFrameBoundaryHandoff && !trialContext) {
          pendingVisualDurationPatch = {
            jsPsych: this.jsPsych,
            trialSequence: dynamicTrialSequence,
            onsetCommitTime: visualOnsetCommitTime,
            expectedDuration: desiredTrialDuration,
            stimulus: visualStimulus,
            frameBoundaryHandoff: visualFrameBoundaryHandoff,
          };
        }

        if (
          !hostTimingAvailable &&
          !trialContext &&
          visualFrameBoundaryHandoff &&
          typeof offsetTime === "number"
        ) {
          setPersistentVisualHandoff(offsetTime, dynamicTrialSequence);
        } else if (!trialContext) {
          preserveCanvasVisualBridge(mainContainer, display_element);
        }

        // Clean up components
        stimulusComponents.forEach((component) => {
          component.lifecycle.destroy();
        });

        responseComponents.forEach((component) => {
          component.lifecycle.destroy();
        });
        for (const dispose of visualBackgroundDisposers) dispose();
        visualBackgroundDisposers.length = 0;

        // Clean up resize observer
        resizeObserver?.disconnect();

        // A prepared successor may already be physically active in another
        // state container. Retire only this trial's administrative layer.
        if (trialContext) {
          mainContainer.remove();
        } else {
          display_element.innerHTML = "";
        }

        // Return trial data through jsPsych's promise-result path.
        resolveTrial(trialData);
      };

      const startPresentation = async () => {
        if (trialEnded) return;

        const trialDuration = resolveTimingMs(trial.trial_duration, null);
        visualFrameBoundaryHandoff = isFrameBoundaryVisualTrial(
          trialDuration,
          stimulusComponents,
          responseComponents,
        );
        if (visualFrameBoundaryHandoff) {
          removePreservedVisualBridge();
          visualRenderContainer = getPersistentVisualSurface(
            canvasWidth,
            canvasHeight,
            trialContext
              ? "transparent"
              : (trial.__canvasStyles?.backgroundColor ?? "transparent"),
          );
          if (hostFrameEngine) {
            bindPersistentVisualSurfaceToFrameEngine(hostFrameEngine);
          } else {
            for (const stage of getCanvasStages(visualRenderContainer)) {
              stage.resetForTrial();
            }
          }
        } else {
          closePendingVisualDuration(
            this.jsPsych,
            "unclosed_no_next_visual_onset_commit",
          );
          removePersistentVisualSurface();
          visualRenderContainer = mainContainer;
        }

        await renderAllComponents();
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
        // Install one shared response event hub during preparation. The onset
        // tick only switches its active manager; it does not add DOM listeners.
        if (hasResponseInputs) responseTiming.arm();
        if (trialContext) {
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
        }
        timing.onStart((timestamp) => {
          presentationActivated = true;
          mainContainer.style.visibility = "visible";
          for (const stage of getCanvasStages(visualRenderContainer)) {
            stage.setDrawableVisibility(visualBackgroundId, true);
          }
          const physicalComponents = trialContext
            ? stimulusComponents
            : allComponents;
          for (const component of physicalComponents) {
            component.lifecycle.activate({ timestamp });
          }
          if (
            logicalLifecycleStarted &&
            hasResponseInputs &&
            !responseTimingAttached
          ) {
            if (trialContext) {
              for (const component of responseComponents) {
                component.lifecycle.activate({ timestamp });
              }
            }
            responseTiming.activate();
            responseTimingAttached = true;
            trialContext?.setResponseSensitive?.(true);
          }
          for (const stage of getCanvasStages(visualRenderContainer)) {
            stage.setTrialActive(true);
          }
        });
        const afterVisualCommit = (timestamp: number) => {
          if (visualFrameBoundaryHandoff && !previousVisualDurationPatched) {
            const currentVisualRecord = findPrimaryVisualTimingRecord(
              timing,
              stimulusComponents,
            );
            const currentOnsetCommitTime =
              typeof currentVisualRecord?.frame_onset_abs === "number"
                ? currentVisualRecord.frame_onset_abs
                : null;
            previousVisualDurationData = patchPreviousVisualDuration(
              this.jsPsych,
              currentOnsetCommitTime,
              getPrimaryStimulusValue(stimulusComponents),
              dynamicTrialSequence,
            );
            previousVisualDurationPatched = previousVisualDurationData !== null;
          }
          removePreservedVisualBridge();
        };
        if (trialContext) {
          // The global engine already closes outgoing offsets and incoming
          // onsets through the shared stage commit. The legacy
          // `patchPreviousVisualDuration()` path reads jsPsych data and must not
          // run in this rAF tick; it is only required when separate legacy
          // trials preserve pixels without a shared transition context.
          trialContext.setPresentationLifecycle({
            arm: (info) => {
              for (const component of allComponents) {
                component.lifecycle.arm({
                  scheduledTimestamp: info.targetTime,
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
              mainContainer.style.visibility = "hidden";
              if (responseTimingAttached) {
                responseTiming.deactivate();
                responseTimingAttached = false;
              }
              trialContext?.setResponseSensitive?.(false);
              // Image/Text offset callbacks are completed by the single shared
              // stage commit later in this same rAF tick. Closing them here
              // would erase commit-index/CPU metadata before that commit occurs.
            },
          });
        } else {
          timing.onFrameCommit((timestamp) => {
            for (const stage of getCanvasStages(visualRenderContainer)) {
              stage.commit(timestamp, true);
            }
            afterVisualCommit(timestamp);
          });
        }

        // Handle trial duration on measured animation frames.
        if (trialDuration !== null) {
          visualFrameBoundaryHandoffLeadMs = visualFrameBoundaryHandoff
            ? 0
            : null;

          // A fixed, non-response-controlled boundary is knowable at onset.
          // Declare it immediately so the frame engine can arm the already
          // prepared successor (notably WebAudio) before the target frame.
          if (
            trialContext &&
            (responseComponents.length === 0 ||
              trial.response_ends_trial === false)
          ) {
            timing.onStart((timestamp) => {
              requestTrialEnd(timestamp, "trial_duration");
            });
          }

          timing.scheduleAt(
            trialDuration,
            (timestamp) => {
              if (trialEnded) return;
              if (!hasResponded) {
                hasResponded = true;
                recordAllPendingResponses();
              }
              if (trial.timing_continuous === true) {
                // P2: the due frame must reach its commit phase before the
                // trial finalizes; the outgoing handoff will use the commit
                // timestamp (this same frame), not the previous frame.
                requestTrialEnd(timestamp, "trial_duration");
              } else {
                endTrial(timestamp);
              }
            },
            { policy: "not_before" },
          );
        }

        if (trialContext) {
          precisionReadyAt = performance.now();
          precisionReady = true;
          precisionReadyReason = "all_first_commit_resources_ready";
          trialContext.markReady(precisionReadyAt, {
            precisionReadyReason,
            precisionFallbackReason: "",
            resourceReadyAt,
            gpuReadyAt,
          });
          execution.onReady?.();
          return;
        }

        // Origin authority selection. With the host coordinator present it is
        // the ONLY authority: a successful acquire starts at the handoff
        // timestamp; a null acquire falls back to fresh_raf — the legacy
        // VisualHandoff state is never consulted nor consumed in that case.
        if (hostTimingAvailable) {
          const currentTrialIndex =
            this.jsPsych.getProgress()?.current_trial_global ?? 0;

          // Only a timing_continuous successor acquires a host origin. A normal
          // trial never acquires (P0 would return null anyway — its slot was
          // discarded with successor_not_continuous) but may still report that
          // outcome. Trial index 0 has no predecessor: skip acquisition.
          if (currentTrialIndex > 0 && trial.timing_continuous === true) {
            hostOrigin = hostTiming.acquireTrialOrigin(currentTrialIndex);
          }

          // Outcome MUST be consulted AFTER the acquisition attempt:
          // acquireTrialOrigin may CREATE the outcome (never_registered,
          // expired, ...) and returns null.
          const outcome =
            typeof hostTiming.getTransitionOutcome === "function"
              ? hostTiming.getTransitionOutcome(currentTrialIndex)
              : null;

          if (hostOrigin && typeof hostOrigin.timestamp === "number") {
            // The retired coordinator can still identify a logical predecessor,
            // but its past timestamp is not a new presentation opportunity.
            // Preserve it as diagnostics and acquire a fresh observed rAF origin.
            timing.start();
            timingContinuity = "logical_only";
            timingLostReason = "legacy_timestamp_not_replayed";
          } else {
            timing.start();
            if (outcome && outcome.status === "lost" && outcome.reason) {
              timingContinuity = "lost";
              timingLostReason = outcome.reason;
            } else {
              timingContinuity = "none";
              timingLostReason = null;
            }
          }
        } else {
          // Official-jsPsych compatibility path: the bridge may preserve the
          // outgoing pixels, but its timestamp is diagnostics only. A past
          // handoff timestamp must never be replayed as a new observed frame.
          const handoff = consumePersistentVisualHandoffTimestamp();
          consumedVisualHandoff = handoff;
          timing.start();
        }

        const startSpeculativePreparation = () => {
          if (trial.prepare_next_manifest) {
            prepareNextPresentation(this.jsPsych, trial.prepare_next_manifest);
          }

          if (trial.prefetch_next_trials !== false) {
            const upcomingAssets = collectUpcomingAssetPreloadList(
              this.jsPsych,
              resolveTimingMs(trial.prefetch_trial_count, 3) ?? 3,
            );
            preloadAssets(
              this.jsPsych,
              upcomingAssets,
              resolveTimingMs(trial.asset_preload_timeout, 10000) ?? 10000,
            ).catch((error) => {
              console.warn(
                "DynamicPlugin upcoming asset prefetch failed:",
                error,
              );
            });
          }
        };
        const sharedEngine =
          hostFrameEngine ??
          ((this.jsPsych as any)?.precisionTiming as HostFrameEngine);
        if (typeof sharedEngine?.queueSafeTask === "function") {
          sharedEngine.queueSafeTask(startSpeculativePreparation, {
            label: "dynamic-successor-prefetch",
            estimatedCostMs: 4,
          });
        } else if (sharedEngine?.canStartBackgroundWork?.() !== false) {
          startSpeculativePreparation();
        }
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
        void startPresentation().catch((error) => {
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
        });
      };

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
          currentAssets.audio.length === 0 &&
          currentAssets.video.length === 0;

        if (fastPathEligible) {
          activationPath = "prepared_fast";
          beginPresentation();
        } else {
          preloadAssets(
            this.jsPsych,
            currentAssets,
            resolveTimingMs(trial.asset_preload_timeout, 10000) ?? 10000,
          )
            .catch((error) => {
              console.warn("DynamicPlugin asset preload failed:", error);
            })
            .then(beginPresentation);
        }
      } else {
        beginPresentation();
      }
    });
  }
}

export default DynamicPlugin;
