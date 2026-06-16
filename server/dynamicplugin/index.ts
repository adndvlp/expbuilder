import { JsPsych, JsPsychPlugin, ParameterType, TrialType } from "jspsych";

const version = "1.0.0";

// Import all component types
import ImageComponent from "./components/ImageComponent";
import VideoComponent from "./components/VideoComponent";
import HtmlComponent from "./components/HtmlComponent";
import TextComponent from "./components/TextComponent";
import AudioComponent from "./components/AudioComponent";

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
  preloadAssets,
  resolveTimingMs,
} from "./utils/PrecisionTiming";
import ResponseTimingManager from "./utils/ResponseTimingManager";
import { getCanvasStages, StageMetrics } from "./renderer/CanvasStage";

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
    trial_onset_time: {
      type: ParameterType.FLOAT,
    },
    trial_offset_time: {
      type: ParameterType.FLOAT,
    },
    actual_trial_duration: {
      type: ParameterType.FLOAT,
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
    commit_outside_raf_count: {
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
    external_reference_id: {
      type: ParameterType.STRING,
    },
    response_error_ms: {
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

function mergeAssetPreloadLists(...lists: AssetPreloadList[]): AssetPreloadList {
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

function collectAssetPreloadList(components: Array<{ config: any }>): AssetPreloadList {
  const assets = emptyAssetPreloadList();
  for (const { config } of components) {
    if (
      config.type === "ImageComponent" &&
      typeof config.stimulus === "string"
    ) {
      assets.images.push(config.stimulus);
    }
    if (config.type === "AudioComponent" && typeof config.stimulus === "string") {
      assets.audio.push(config.stimulus);
    }
    if (config.type === "VideoComponent" && Array.isArray(config.stimulus)) {
      assets.video.push(...config.stimulus.filter((src: any) => typeof src === "string"));
    }
    if (config.type === "SketchpadComponent" && typeof config.background_image === "string") {
      assets.images.push(config.background_image);
    }
    if (config.type === "ButtonResponseComponent" && Array.isArray(config.choices)) {
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
    ...(Array.isArray(trial?.response_components) ? trial.response_components : []),
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
  const currentTrialIndex = jsPsych?.getProgress?.()?.current_trial_global ?? -1;
  const upcomingTrials = flatTrials.slice(
    currentTrialIndex + 1,
    currentTrialIndex + 1 + trialCount,
  );

  return mergeAssetPreloadLists(
    ...upcomingTrials.map((trial) => collectAssetPreloadListFromTrial(trial)),
  );
}

function attachPrecisionTiming(config: any, timing: ReturnType<typeof createPrecisionTiming>) {
  Object.defineProperty(config, "__timing", {
    value: timing,
    enumerable: false,
    configurable: true,
  });
}

function attachResponseTiming(config: any, responseTiming: ResponseTimingManager) {
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

function resolveRawValue(value: any) {
  return value && typeof value === "object" && "value" in value
    ? value.value
    : value;
}

function componentLabel(config: any) {
  return config.name ? `${config.name}:${config.type}` : String(config.type);
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
    includeGpuSeries: recordRenderTiming && recordGpuTiming && level === "debug",
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
  const mean = (values: number[]) =>
    values.length > 0
      ? values.reduce((sum, value) => sum + value, 0) / values.length
      : null;
  const max = (values: number[]) =>
    values.length > 0 ? Math.max(...values) : null;
  const renderBackends = [...new Set(stageMetrics.map((m) => m.render_backend))];
  const bufferStrategies = [
    ...new Set(stageMetrics.map((m) => m.buffer_strategy)),
  ];

  return {
    render_backend_requested: requestedBackend,
    render_backend: renderBackends.join("+") || "none",
    visual_backend: renderBackends.join("+") || "none",
    visual_all_commits_rAF: stageMetrics.every(
      (metrics) => metrics.visual_all_commits_rAF,
    ),
    commit_outside_raf_count: stageMetrics.reduce(
      (sum, metrics) => sum + metrics.commit_outside_raf_count,
      0,
    ),
    buffer_strategy: bufferStrategies.join("+") || "none",
    commit_count: stageMetrics.reduce(
      (sum, metrics) => sum + metrics.commit_count,
      0,
    ),
    commit_durations: commitDurations.map(roundTiming),
    mean_commit_duration: roundTiming(mean(commitDurations)),
    max_commit_duration: roundTiming(max(commitDurations)),
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
    mean_gpu_draw_duration: roundTiming(mean(gpuDrawDurations)),
    max_gpu_draw_duration: roundTiming(max(gpuDrawDurations)),
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
  const quality = responseRank > visualRank ? responseQuality : visualQuality.quality;
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
    reasons.push(`${renderMetrics?.webgl_context_lost_count} WebGL context loss event(s)`);
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
      reasons.push(`${renderMetrics?.gpu_disjoint_count} GPU disjoint event(s)`);
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

  constructor(private jsPsych: JsPsych) {}

  trial(display_element: HTMLElement, trial: TrialType<Info>) {
    // Inject plugin styles if not already present
    if (!document.getElementById("jspsych-dynamic-plugin-styles")) {
      const styleElement = document.createElement("style");
      styleElement.id = "jspsych-dynamic-plugin-styles";
      styleElement.textContent = `
        #jspsych-dynamic-plugin-container {
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
    mainContainer.id = "jspsych-dynamic-plugin-container";
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
        window.innerHeight / canvasHeight
      );
      mainContainer.style.width = canvasWidth + "px";
      mainContainer.style.height = canvasHeight + "px";
      mainContainer.style.transform = "translate(-50%, -50%) scale(" + ratio + ")";
    };
    updateScale();

    const resizeObserver = new ResizeObserver(() => updateScale());
    resizeObserver.observe(document.documentElement);

    const initialDiagnostics = getDiagnosticsOptions(trial);
    const timing = createPrecisionTiming({
      recordFrameTiming: initialDiagnostics.recordFrameTiming,
      longFrameThreshold: resolveTimingMs(trial.frame_lag_threshold, 34) ?? 34,
    });

    // Store component instances and rendered elements
    const stimulusComponents: any[] = [];
    const responseComponents: any[] = [];
    let hasResponded = false;
    let trialEnded = false;
    let trialEndedByResponse = false;
    let handleParticipantResponse: (
      offsetTime?: number | null,
      options?: { force?: boolean },
    ) => boolean = () => false;
    const responseTiming = new ResponseTimingManager({
      trial,
      timing,
      container: mainContainer,
      canvasWidth,
      canvasHeight,
      onFinish: (timestamp, options) =>
        handleParticipantResponse(timestamp, options),
    });

    // Instantiate all components first
    const stimulusTypeCounts: Record<string, number> = {};

    if (trial.components && trial.components.length > 0) {
      trial.components.forEach((rawConfig: any, idx: number) => {
        const config = { ...rawConfig };
        // Inject __canvasStyles so components can compute pixel coords
        config.__canvasStyles = trial.__canvasStyles;
        config.__renderBackend = trial.render_backend || "webgl-strict";
        config.__recordGpuTiming = trial.record_gpu_timing !== false;
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
        config.__canvasStyles = trial.__canvasStyles;
        config.__renderBackend = trial.render_backend || "webgl-strict";
        config.__recordGpuTiming = trial.record_gpu_timing !== false;
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
    allComponents.sort(
      (a, b) => (a.config.zIndex ?? 0) - (b.config.zIndex ?? 0),
    );

    const renderAllComponents = () => {
      // Pass onResponse callback to ALL components so they can end the trial if needed
      allComponents.forEach((comp) => {
        const { instance, config } = comp;
        const _prevLen = mainContainer.children.length;
        const renderedElement = instance.render(mainContainer, config, () => {
          handleParticipantResponse();
        });
        // Capture the topmost new child appended during render (synchronous DOM op)
        comp.renderedEl =
          mainContainer.children.length > _prevLen
            ? (mainContainer.lastElementChild as HTMLElement)
            : renderedElement instanceof HTMLElement
              ? renderedElement
              : null;
      });
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
      endTrial(typeof offsetTime === "number" ? offsetTime : performance.now());
      return true;
    };

    // Function to end the trial and collect data
    const endTrial = (offsetTime = performance.now()) => {
      if (trialEnded) return;
      trialEnded = true;

      const timingSummary = timing.getSummary(offsetTime);
      const desiredTrialDuration = resolveTimingMs(trial.trial_duration, null);
      const trialDurationError =
        desiredTrialDuration === null || timingSummary.actualDuration === null
          ? null
          : timingSummary.actualDuration - desiredTrialDuration;
      const diagnostics = getDiagnosticsOptions(trial);
      for (const stage of getCanvasStages(mainContainer)) {
        stage.setTrialActive(false);
      }
      const renderMetrics = aggregateRenderMetrics(
        getCanvasStages(mainContainer).map((stage) => stage.getMetrics()),
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
      const responseTimingData = responseTiming.getData();
      const timingQuality = mergeQuality(
        visualTimingQuality,
        responseTimingData.response_timing_quality,
        responseTimingData.response_timing_quality_reason,
      );
      timing.stop();

      // Keep normal exports compact unless Dynamic diagnostics are explicitly enabled.
      const trialData: any = {
        rt: responseTimingData.rt,
      };

      if (diagnostics.includeSummary) {
        Object.assign(trialData, {
          timing_method:
            "performance.now + requestAnimationFrame frame-nearest scheduler",
          trial_onset_time: timingSummary.onsetTime,
          trial_offset_time: timingSummary.offsetTime,
          actual_trial_duration: roundTiming(timingSummary.actualDuration),
          duration_error: roundTiming(trialDurationError),
          trial_ended_by_response: trialEndedByResponse,
          frame_count: timingSummary.frameCount,
          long_frame_count: timingSummary.longFrameCount,
          dropped_frame_count: timingSummary.droppedFrameCount,
          max_frame_interval: roundTiming(timingSummary.maxFrameInterval),
          mean_frame_interval: roundTiming(timingSummary.meanFrameInterval),
          frame_interval_estimate: roundTiming(
            timingSummary.frameIntervalEstimate,
          ),
          timing_quality: timingQuality.quality,
          timing_quality_reason: timingQuality.reason,
          visual_timing_quality: visualTimingQuality.quality,
          response_timing_quality: responseTimingData.response_timing_quality,
          response_timing_quality_reason:
            responseTimingData.response_timing_quality_reason,
          diagnostics_level: diagnostics.level,
          render_backend_requested: renderMetrics.render_backend_requested,
          render_backend: renderMetrics.render_backend,
          visual_backend: renderMetrics.visual_backend,
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
        trialData.stimulus_timing = JSON.stringify(timingSummary.stimulusRecords);
      }

      if (diagnostics.includeFrameIntervals) {
        trialData.frame_intervals = JSON.stringify(timingSummary.frameIntervals);
      }

      if (diagnostics.includeRenderSeries) {
        trialData.commit_durations = JSON.stringify(renderMetrics.commit_durations);
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

      // Clean up components
      stimulusComponents.forEach(({ instance }) => {
        if (instance.destroy) instance.destroy();
      });

      responseComponents.forEach(({ instance }) => {
        if (instance.destroy) instance.destroy();
      });

      // Clean up resize observer
      resizeObserver.disconnect();

      // Clear display
      display_element.innerHTML = "";

      // Save trial data
      this.jsPsych.finishTrial(trialData);
    };

    const startPresentation = () => {
      if (trialEnded) return;

      renderAllComponents();
      responseTiming.attach();
      timing.onStart(() => {
        mainContainer.style.visibility = "visible";
        for (const stage of getCanvasStages(mainContainer)) {
          stage.setTrialActive(true);
        }
      });
      timing.onFrameCommit((timestamp) => {
        for (const stage of getCanvasStages(mainContainer)) {
          stage.commit(timestamp, true);
        }
      });

      // Handle trial duration on measured animation frames.
      const trialDuration = resolveTimingMs(trial.trial_duration, null);
      if (trialDuration !== null) {
        timing.scheduleAt(trialDuration, (timestamp) => {
          if (trialEnded) return;
          if (!hasResponded) {
            hasResponded = true;
            recordAllPendingResponses();
          }
          endTrial(timestamp);
        });
      }

      timing.start();

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
          console.warn("DynamicPlugin upcoming asset prefetch failed:", error);
        });
      }
    };

    if (trial.preload_assets !== false) {
      preloadAssets(
        this.jsPsych,
        collectAssetPreloadList(allComponents),
        resolveTimingMs(trial.asset_preload_timeout, 10000) ?? 10000,
      )
        .catch((error) => {
          console.warn("DynamicPlugin asset preload failed:", error);
        })
        .then(startPresentation);
    } else {
      startPresentation();
    }
  }
}

export default DynamicPlugin;
