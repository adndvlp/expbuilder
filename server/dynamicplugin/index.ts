import { JsPsych, JsPsychPlugin, ParameterType, TrialType } from "jspsych";

const version = "1.0.0";

// Import all component types
import ImageComponent from "./components/ImageComponent";
import CanvasImageComponent from "./components/CanvasImageComponent";
import CanvasTextComponent from "./components/CanvasTextComponent";
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
      default: true,
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
  },
  data: {
    /** The response time in milliseconds for the participant to make a response. The time is measured from when the trial
     * starts until the participant's response. */
    rt: {
      type: ParameterType.INT,
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
    frame_count: {
      type: ParameterType.INT,
    },
    long_frame_count: {
      type: ParameterType.INT,
    },
    max_frame_interval: {
      type: ParameterType.FLOAT,
    },
    mean_frame_interval: {
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
  },
};

type Info = typeof info;

// Map component type names to their classes
const COMPONENT_MAP: Record<string, any> = {
  ImageComponent,
  CanvasImageComponent,
  CanvasTextComponent,
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

/**
 * Picks the saved per-screen layout that best matches the current viewport.
 * Uses width-axis Manhattan distance with a 200px threshold so narrow
 * viewports never pick a desktop layout and vice-versa.
 * Falls back to the default saved layout when no close match exists.
 */
function resolveScreenLayout(config: any): any {
  if (!config.screenLayouts || typeof config.screenLayouts !== "object") {
    return config;
  }

  const entries = Object.entries(config.screenLayouts) as [string, any][];
  if (entries.length === 0) return config;

  const vw = window.innerWidth;
  const WIDTH_THRESHOLD = 200;

  let bestMatch: any = null;
  let bestDist = Infinity;

  for (const [key, layout] of entries) {
    const [w] = key.split("x").map(Number);
    const dist = Math.abs(w - vw);
    if (dist < WIDTH_THRESHOLD && dist < bestDist) {
      bestDist = dist;
      bestMatch = layout;
    }
  }

  if (!bestMatch) return config;

  return {
    ...config,
    coordinates:
      bestMatch.x !== undefined && bestMatch.y !== undefined
        ? { x: bestMatch.x, y: bestMatch.y }
        : config.coordinates,
    width:  bestMatch.width  !== undefined ? bestMatch.width  : config.width,
    height: bestMatch.height !== undefined ? bestMatch.height : config.height,
  };
}

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
      (config.type === "ImageComponent" ||
        config.type === "CanvasImageComponent") &&
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

function roundTiming(value: number | null): number | null {
  return value === null ? null : Math.round(value * 1000) / 1000;
}

function classifyTimingQuality(
  timingSummary: any,
  desiredTrialDuration: number | null,
  badThreshold: number,
) {
  const reasons: string[] = [];
  const maxFrameInterval = timingSummary.maxFrameInterval ?? 0;
  const trialDurationError =
    desiredTrialDuration === null || timingSummary.actualDuration === null
      ? 0
      : Math.abs(timingSummary.actualDuration - desiredTrialDuration);
  const stimulusDurationErrors = timingSummary.stimulusRecords
    .map((record: any) =>
      typeof record.duration_error === "number"
        ? Math.abs(record.duration_error)
        : 0,
    );
  const maxStimulusDurationError =
    stimulusDurationErrors.length > 0 ? Math.max(...stimulusDurationErrors) : 0;

  if (timingSummary.longFrameCount > 0) {
    reasons.push(`${timingSummary.longFrameCount} long frame(s)`);
  }
  if (maxFrameInterval >= badThreshold) {
    reasons.push(`max frame ${roundTiming(maxFrameInterval)}ms`);
  }
  if (trialDurationError >= badThreshold) {
    reasons.push(`trial duration error ${roundTiming(trialDurationError)}ms`);
  }
  if (maxStimulusDurationError >= badThreshold) {
    reasons.push(
      `stimulus duration error ${roundTiming(maxStimulusDurationError)}ms`,
    );
  }

  if (
    maxFrameInterval >= badThreshold ||
    trialDurationError >= badThreshold ||
    maxStimulusDurationError >= badThreshold
  ) {
    return { quality: "bad", reason: reasons.join("; ") };
  }

  if (timingSummary.longFrameCount > 0 || trialDurationError > 1) {
    return {
      quality: "warning",
      reason: reasons.length > 0 ? reasons.join("; ") : "minor timing drift",
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

    const timing = createPrecisionTiming({
      recordFrameTiming: trial.record_frame_timing !== false,
      longFrameThreshold: resolveTimingMs(trial.frame_lag_threshold, 34) ?? 34,
    });

    // Store component instances and rendered elements
    const stimulusComponents: any[] = [];
    const responseComponents: any[] = [];
    let hasResponded = false;
    let trialEnded = false;

    // Instantiate all components first
    const stimulusTypeCounts: Record<string, number> = {};

    if (trial.components && trial.components.length > 0) {
      trial.components.forEach((rawConfig: any, idx: number) => {
        const config = resolveScreenLayout(rawConfig);
        // Inject __canvasStyles so components can compute pixel coords
        config.__canvasStyles = trial.__canvasStyles;
        attachPrecisionTiming(config, timing);
        const ComponentClass = COMPONENT_MAP[config.type];
        if (ComponentClass) {
          stimulusTypeCounts[config.type] =
            (stimulusTypeCounts[config.type] || 0) + 1;
          if (!config.name) {
            config.name = `${config.type}_${stimulusTypeCounts[config.type]}`;
          }
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
        const config = resolveScreenLayout(rawConfig);
        config.__canvasStyles = trial.__canvasStyles;
        attachPrecisionTiming(config, timing);
        const ComponentClass = RESPONSE_COMPONENT_MAP[config.type];
        if (ComponentClass) {
          responseTypeCounts[config.type] =
            (responseTypeCounts[config.type] || 0) + 1;
          if (!config.name) {
            config.name = `${config.type}_${responseTypeCounts[config.type]}`;
          }
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
          if (!hasResponded && trial.response_ends_trial) {
            if (trial.require_response) {
              // Clear previous highlights
              responseComponents.forEach(({ instance: ri }) => {
                if (typeof (ri as any).clearValidationError === "function") {
                  (ri as any).clearValidationError();
                }
              });
              // Check every response component is satisfied
              const allValid = responseComponents.every(
                ({ instance: ri, config: rc }) =>
                  typeof (ri as any).isValid === "function"
                    ? (ri as any).isValid(rc)
                    : true,
              );
              if (!allValid) {
                // Reset triggering components (button/keyboard) so user can interact again
                responseComponents.forEach(({ instance: ri }) => {
                  if (typeof (ri as any).reset === "function") {
                    (ri as any).reset();
                  }
                });
                // Highlight still-invalid components
                responseComponents.forEach(({ instance: ri, config: rc }) => {
                  if (
                    typeof (ri as any).isValid === "function" &&
                    !(ri as any).isValid(rc)
                  ) {
                    if (typeof (ri as any).showValidationError === "function") {
                      (ri as any).showValidationError();
                    }
                  }
                });
                return; // Block trial end
              }
            }
            hasResponded = true;
            recordAllPendingResponses();
            endTrial();
          }
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

    // Function to end the trial and collect data
    const endTrial = (offsetTime = performance.now()) => {
      if (trialEnded) return;
      trialEnded = true;

      // Calculate response time
      const onsetTime = timing.getOnsetTime() ?? offsetTime;
      const rt = Math.round(offsetTime - onsetTime);
      const timingSummary = timing.getSummary(offsetTime);
      const desiredTrialDuration = resolveTimingMs(trial.trial_duration, null);
      const timingQuality = classifyTimingQuality(
        timingSummary,
        desiredTrialDuration,
        resolveTimingMs(trial.timing_quality_bad_threshold, 50) ?? 50,
      );
      timing.stop();

      // Create flat data structure (like PsychoPy) instead of nested arrays
      const trialData: any = {
        rt: rt,
        timing_method: "performance.now + requestAnimationFrame",
        trial_onset_time: timingSummary.onsetTime,
        trial_offset_time: timingSummary.offsetTime,
        actual_trial_duration: roundTiming(timingSummary.actualDuration),
        frame_count: timingSummary.frameCount,
        long_frame_count: timingSummary.longFrameCount,
        max_frame_interval: roundTiming(timingSummary.maxFrameInterval),
        mean_frame_interval: roundTiming(timingSummary.meanFrameInterval),
        frame_intervals: JSON.stringify(timingSummary.frameIntervals),
        stimulus_timing: JSON.stringify(timingSummary.stimulusRecords),
        timing_quality: timingQuality.quality,
        timing_quality_reason: timingQuality.reason,
      };

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

        // Size via element captured at render time
        if (comp.renderedEl) {
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

          if (instance.getRT && typeof instance.getRT === "function") {
            trialData[`${prefix}_rt`] = instance.getRT();
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
        if (comp.renderedEl) {
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

        // Add RT
        if (instance.getRT && typeof instance.getRT === "function") {
          trialData[`${prefix}_rt`] = instance.getRT();
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
      timing.onStart(() => {
        mainContainer.style.visibility = "visible";
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
