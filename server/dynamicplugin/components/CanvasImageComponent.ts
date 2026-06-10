import { ParameterType } from "jspsych";
import { getCanvasStage, CanvasStage } from "../renderer/CanvasStage";
import {
  CanvasBitmapSource,
  createPrecisionTiming,
  preloadBitmap,
  resolveTimingMs,
} from "../utils/PrecisionTiming";

var version = "1.0.0";

const info = {
  name: "CanvasImageComponent",
  version,
  parameters: {
    name: {
      type: ParameterType.STRING,
      default: undefined,
    },
    stimulus: {
      type: ParameterType.IMAGE,
      default: void 0,
    },
    height: {
      type: ParameterType.INT,
      default: null,
    },
    width: {
      type: ParameterType.INT,
      default: null,
    },
    maintain_aspect_ratio: {
      type: ParameterType.BOOL,
      default: true,
    },
    stimulus_onset: {
      type: ParameterType.INT,
      default: null,
    },
    stimulus_duration: {
      type: ParameterType.INT,
      default: null,
    },
    coordinates: {
      type: ParameterType.OBJECT,
      default: { x: 0, y: 0 },
    },
    zIndex: {
      type: ParameterType.INT,
      default: 0,
    },
    background_color: {
      type: ParameterType.STRING,
      default: null,
    },
    clear_before_draw: {
      type: ParameterType.BOOL,
      default: true,
    },
    clear_on_offset: {
      type: ParameterType.BOOL,
      default: true,
    },
  },
};

type DrawRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

class CanvasImageComponent {
  private jsPsych: any;
  private stage: CanvasStage | null = null;
  private source: CanvasBitmapSource | null = null;
  private sourcePromise: Promise<CanvasBitmapSource> | null = null;
  private cancelSchedule: Array<() => void> = [];
  private deferredRafHandle: number | null = null;
  private drawn = false;
  private offsetReached = false;
  private destroyed = false;
  private lastDrawRect: DrawRect | null = null;

  constructor(jsPsych: any) {
    this.jsPsych = jsPsych;
  }

  static info = info;

  private resolveParam(raw: any, fallback: any): any {
    if (raw === undefined || raw === null) return fallback;
    if (typeof raw === "object" && "value" in raw) {
      return raw.value !== undefined && raw.value !== null ? raw.value : fallback;
    }
    return raw;
  }

  private getSourceSize(source: CanvasBitmapSource) {
    if ("naturalWidth" in source) {
      return {
        width: source.naturalWidth,
        height: source.naturalHeight,
      };
    }
    return {
      width: source.width,
      height: source.height,
    };
  }

  private computeDrawRect(config: any, source: CanvasBitmapSource): DrawRect | null {
    const canvasWidth = this.resolveParam(config.__canvasStyles?.width, 1024);
    const canvasHeight = this.resolveParam(config.__canvasStyles?.height, 768);
    const sourceSize = this.getSourceSize(source);

    if (sourceSize.width <= 0 || sourceSize.height <= 0) return null;

    const maintainAspectRatio = this.resolveParam(
      config.maintain_aspect_ratio,
      true,
    );
    const configuredWidth = this.resolveParam(config.width, null);
    const configuredHeight = this.resolveParam(config.height, null);

    let drawWidth = sourceSize.width;
    let drawHeight = sourceSize.height;

    if (configuredWidth !== null) {
      drawWidth = (Number(configuredWidth) / 100) * canvasWidth;
      if (configuredHeight === null && maintainAspectRatio) {
        drawHeight = sourceSize.height * (drawWidth / sourceSize.width);
      }
    }

    if (configuredHeight !== null) {
      // Builder stores image height in the same percent-of-canvas-width units
      // used by ImageComponent, so CanvasImage must use the same conversion.
      drawHeight = (Number(configuredHeight) / 100) * canvasWidth;
      if (configuredWidth === null && maintainAspectRatio) {
        drawWidth = sourceSize.width * (drawHeight / sourceSize.height);
      }
    }

    const coordinates = this.resolveParam(config.coordinates, { x: 0, y: 0 });
    const centerX =
      canvasWidth / 2 + ((coordinates?.x ?? 0) / 100) * (canvasWidth / 2);
    const centerY =
      canvasHeight / 2 - ((coordinates?.y ?? 0) / 100) * (canvasHeight / 2);

    return {
      x: centerX - drawWidth / 2,
      y: centerY - drawHeight / 2,
      width: drawWidth,
      height: drawHeight,
    };
  }

  render(container: HTMLElement, config: any): HTMLElement {
    const canvasWidth = this.resolveParam(config.__canvasStyles?.width, 1024);
    const canvasHeight = this.resolveParam(config.__canvasStyles?.height, 768);
    const backgroundColor =
      this.resolveParam(config.background_color, null) ||
      this.resolveParam(config.__canvasStyles?.backgroundColor, "#ffffff");

    this.destroyed = false;
    this.offsetReached = false;
    this.drawn = false;
    this.lastDrawRect = null;
    this.stage = getCanvasStage(container, {
      width: canvasWidth,
      height: canvasHeight,
      backgroundColor,
      zIndex: resolveTimingMs(config.zIndex, 0) ?? 0,
    });

    const stimulus = this.resolveParam(config.stimulus, "");
    if (stimulus) {
      this.sourcePromise = preloadBitmap(stimulus).then((source) => {
        this.source = source;
        return source;
      });
    }

    const timing = config.__timing as
      | ReturnType<typeof createPrecisionTiming>
      | undefined;
    const stimulusOnset = resolveTimingMs(config.stimulus_onset, null);
    const stimulusDuration = resolveTimingMs(config.stimulus_duration, null);
    const stimulusTiming = timing?.registerStimulus?.(
      config.name || config.type || "canvas-image",
      stimulusOnset,
      stimulusDuration,
    );

    const draw = (timestamp: number) => {
      if (this.destroyed || this.offsetReached) return;

      if (!this.source) {
        this.sourcePromise?.then(() => {
          if (this.destroyed || this.offsetReached) return;
          this.deferredRafHandle = requestAnimationFrame((frameTimestamp) => {
            this.deferredRafHandle = null;
            draw(frameTimestamp);
          });
        });
        return;
      }

      const rect = this.computeDrawRect(config, this.source);
      if (!rect || !this.stage) return;

      if (this.resolveParam(config.clear_before_draw, true)) {
        this.stage.clear(backgroundColor);
      }
      this.stage.drawImage(this.source, rect.x, rect.y, rect.width, rect.height);
      this.lastDrawRect = rect;
      this.drawn = true;
      stimulusTiming?.markOnset(timestamp);
    };

    const clear = (timestamp: number) => {
      if (this.destroyed) return;
      this.offsetReached = true;
      if (this.stage && this.resolveParam(config.clear_on_offset, true)) {
        this.stage.clear(backgroundColor);
      }
      if (this.drawn) {
        stimulusTiming?.markOffset(timestamp);
      }
    };

    if (timing) {
      if (stimulusOnset === null) {
        timing.onStart(draw);
      } else {
        this.cancelSchedule.push(timing.scheduleAt(stimulusOnset, draw));
      }

      if (stimulusDuration !== null) {
        this.cancelSchedule.push(
          timing.scheduleAt((stimulusOnset ?? 0) + stimulusDuration, clear),
        );
      }
    } else {
      const drawDelay = stimulusOnset ?? 0;
      const drawHandle = window.setTimeout(
        () => draw(performance.now()),
        drawDelay,
      );
      this.cancelSchedule.push(() => window.clearTimeout(drawHandle));

      if (stimulusDuration !== null) {
        const clearHandle = window.setTimeout(
          () => clear(performance.now()),
          drawDelay + stimulusDuration,
        );
        this.cancelSchedule.push(() => window.clearTimeout(clearHandle));
      }
    }

    return this.stage.canvas;
  }

  hide() {
    if (this.stage) {
      this.stage.clear();
    }
  }

  show() {
    if (this.source && this.stage) {
      const rect = this.lastDrawRect;
      if (rect) {
        this.stage.drawImage(
          this.source,
          rect.x,
          rect.y,
          rect.width,
          rect.height,
        );
      }
    }
  }

  destroy() {
    this.destroyed = true;
    this.cancelSchedule.forEach((cancel) => cancel());
    this.cancelSchedule = [];
    if (this.deferredRafHandle !== null) {
      cancelAnimationFrame(this.deferredRafHandle);
      this.deferredRafHandle = null;
    }
    this.stage = null;
    this.source = null;
    this.sourcePromise = null;
    this.lastDrawRect = null;
  }

  getElement(): HTMLElement | null {
    return this.stage?.canvas ?? null;
  }
}

export default CanvasImageComponent;
