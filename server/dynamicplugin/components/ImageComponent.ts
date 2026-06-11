import { ParameterType } from "jspsych";
import { getCanvasStage, CanvasStage } from "../renderer/CanvasStage";
import {
  CanvasBitmapSource,
  createPrecisionTiming,
  preloadBitmap,
  resolveTimingMs,
} from "../utils/PrecisionTiming";

var version = "2.2.0";

const info = {
  name: "ImageComponent",
  version,
  parameters: {
    name: {
      type: ParameterType.STRING,
      default: undefined,
    },
    /** The path of the image file to be displayed. */
    stimulus: {
      type: ParameterType.IMAGE,
      default: void 0,
    },
    /** Set the height of the image in pixels. If left null (no value specified), then the image will display at its natural height. */
    height: {
      type: ParameterType.INT,
      default: null,
    },
    /** Set the width of the image in pixels. If left null (no value specified), then the image will display at its natural width. */
    width: {
      type: ParameterType.INT,
      default: null,
    },
    /** If setting *only* the width or *only* the height and this parameter is true, then the other dimension will be
     * scaled to maintain the image's aspect ratio.  */
    maintain_aspect_ratio: {
      type: ParameterType.BOOL,
      default: true,
    },

    /** Delay in milliseconds before showing the stimulus. If null, the stimulus appears immediately. */
    stimulus_onset: {
      type: ParameterType.INT,
      default: null,
    },
    /** How long to show the stimulus for in milliseconds. If null, the stimulus stays visible for the whole trial. */
    stimulus_duration: {
      type: ParameterType.INT,
      default: null,
    },
    /** Position coordinates for the image */
    coordinates: {
      type: ParameterType.OBJECT,
      pretty_name: "Coordinates",
      default: { x: 0, y: 0 },
      description: "Object with x and y properties for absolute positioning",
    },
    /** Z-index for layering (higher values appear on top) */
    zIndex: {
      type: ParameterType.INT,
      pretty_name: "Z-Index",
      default: 0,
      description: "Layer order - higher values render on top of lower values",
    },
  },

  // prettier-ignore
  citations: {
    "apa": "de Leeuw, J. R., Gilbert, R. A., & Luchterhandt, B. (2023). jsPsych: Enabling an Open-Source Collaborative Ecosystem of Behavioral Experiments. Journal of Open Source Software, 8(85), 5351. https://doi.org/10.21105/joss.05351 ",
    "bibtex": '@article{Leeuw2023jsPsych, 	author = {de Leeuw, Joshua R. and Gilbert, Rebecca A. and Luchterhandt, Bj{\\" o}rn}, 	journal = {Journal of Open Source Software}, 	doi = {10.21105/joss.05351}, 	issn = {2475-9066}, 	number = {85}, 	year = {2023}, 	month = {may 11}, 	pages = {5351}, 	publisher = {Open Journals}, 	title = {jsPsych: Enabling an {Open}-{Source} {Collaborative} {Ecosystem} of {Behavioral} {Experiments}}, 	url = {https://joss.theoj.org/papers/10.21105/joss.05351}, 	volume = {8}, }  '
  },
};

type DrawRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

let imageComponentCounter = 0;

/**
 * ImageComponent - Renders an image stimulus on the shared canvas stage.
 * The public component type/config stays the same; only the runtime renderer
 * changes from a DOM <img> to a retained canvas drawable.
 */
class ImageComponent {
  private jsPsych: any;
  private stage: CanvasStage | null = null;
  private element: HTMLElement | null = null;
  private source: CanvasBitmapSource | null = null;
  private sourcePromise: Promise<CanvasBitmapSource> | null = null;
  private cancelSchedule: Array<() => void> = [];
  private removeDrawable: (() => void) | null = null;
  private deferredRafHandle: number | null = null;
  private drawableId = "";
  private drawRect: DrawRect | null = null;
  private drawn = false;
  private prepared = false;
  private visible = false;
  private offsetReached = false;
  private destroyed = false;

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
    const canvasStyles = this.resolveParam(config.__canvasStyles, {});
    const canvasWidth = this.resolveParam(canvasStyles?.width, 1024);
    const canvasHeight = this.resolveParam(canvasStyles?.height, 768);
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
      // used by ImageComponent's old DOM path, so keep that conversion.
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

  private getStageScale() {
    if (!this.stage) return { x: 1, y: 1 };
    const rect = this.stage.canvas.getBoundingClientRect();
    return {
      x: this.stage.width > 0 ? rect.width / this.stage.width : 1,
      y: this.stage.height > 0 ? rect.height / this.stage.height : 1,
    };
  }

  private updateTrackingElement(rect: DrawRect, zIndex: number) {
    if (!this.element) return;
    this.element.style.left = `${rect.x}px`;
    this.element.style.top = `${rect.y}px`;
    this.element.style.width = `${rect.width}px`;
    this.element.style.height = `${rect.height}px`;
    this.element.style.zIndex = String(zIndex);
    this.element.style.visibility = "visible";
  }

  private prepareDrawable(config: any, zIndex: number): boolean {
    if (this.destroyed || !this.source || !this.stage) return false;
    if (this.prepared) return true;

    const rect = this.computeDrawRect(config, this.source);
    if (!rect) return false;

    this.drawRect = rect;
    this.updateTrackingElement(rect, zIndex);
    this.removeDrawable?.();
    this.removeDrawable = this.stage.registerDrawable({
      id: this.drawableId,
      zIndex,
      visible: false,
      draw: (ctx) => {
        if (!this.source || !this.drawRect) return;
        ctx.drawImage(
          this.source,
          this.drawRect.x,
          this.drawRect.y,
          this.drawRect.width,
          this.drawRect.height,
        );
      },
    });
    this.prepared = true;
    return true;
  }

  render(container: HTMLElement, config: any): HTMLElement {
    const canvasStyles = this.resolveParam(config.__canvasStyles, {});
    const canvasWidth = this.resolveParam(canvasStyles?.width, 1024);
    const canvasHeight = this.resolveParam(canvasStyles?.height, 768);
    const zIndex = resolveTimingMs(config.zIndex, 0) ?? 0;

    this.destroyed = false;
    this.offsetReached = false;
    this.drawn = false;
    this.prepared = false;
    this.visible = false;
    this.drawRect = null;
    this.drawableId = config.name
      ? `image-${config.name}`
      : `image-${++imageComponentCounter}`;

    this.stage = getCanvasStage(container, {
      width: canvasWidth,
      height: canvasHeight,
      backgroundColor: "transparent",
      zIndex,
    });

    this.element = document.createElement("div");
    this.element.id = config.name
      ? `jspsych-dynamic-${config.name}-stimulus`
      : "jspsych-dynamic-image-stimulus";
    this.element.className = "dynamic-image-component";
    this.element.setAttribute("aria-hidden", "true");
    this.element.style.position = "absolute";
    this.element.style.left = "0";
    this.element.style.top = "0";
    this.element.style.width = "0";
    this.element.style.height = "0";
    this.element.style.margin = "0";
    this.element.style.padding = "0";
    this.element.style.background = "transparent";
    this.element.style.pointerEvents = "none";
    this.element.style.visibility = "hidden";
    this.element.style.zIndex = String(zIndex);
    container.appendChild(this.element);

    const stimulus = this.resolveParam(config.stimulus, "");
    if (stimulus) {
      this.sourcePromise = preloadBitmap(stimulus).then((source) => {
        this.source = source;
        this.prepareDrawable(config, zIndex);
        return source;
      });
    }

    const timing = config.__timing as
      | ReturnType<typeof createPrecisionTiming>
      | undefined;
    const stimulusOnset = resolveTimingMs(config.stimulus_onset, null);
    const stimulusDuration = resolveTimingMs(config.stimulus_duration, null);
    const stimulusTiming = timing?.registerStimulus?.(
      config.name || config.type || this.drawableId,
      stimulusOnset,
      stimulusDuration,
    );

    const draw = (timestamp: number) => {
      if (this.destroyed || this.offsetReached) return;

      if (!this.prepareDrawable(config, zIndex)) {
        this.sourcePromise?.then(() => {
          if (this.destroyed || this.offsetReached) return;
          this.deferredRafHandle = requestAnimationFrame((frameTimestamp) => {
            this.deferredRafHandle = null;
            draw(frameTimestamp);
          });
        });
        return;
      }

      this.drawn = true;
      this.visible = true;
      this.stage?.setDrawableVisibility(this.drawableId, true);
      stimulusTiming?.markOnset(timestamp);
    };

    const hide = (timestamp: number) => {
      if (this.destroyed) return;
      this.offsetReached = true;
      this.visible = false;
      this.stage?.setDrawableVisibility(this.drawableId, false);
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
          timing.scheduleAt((stimulusOnset ?? 0) + stimulusDuration, hide),
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
        const hideHandle = window.setTimeout(
          () => hide(performance.now()),
          drawDelay + stimulusDuration,
        );
        this.cancelSchedule.push(() => window.clearTimeout(hideHandle));
      }
    }

    return this.stage.canvas;
  }

  hide() {
    this.visible = false;
    if (this.element) {
      this.element.style.visibility = "hidden";
    }
    this.stage?.setDrawableVisibility(this.drawableId, false);
  }

  show() {
    if (!this.drawn) return;
    this.visible = true;
    if (this.element) {
      this.element.style.visibility = "visible";
    }
    this.stage?.setDrawableVisibility(this.drawableId, true);
  }

  destroy() {
    this.destroyed = true;
    this.cancelSchedule.forEach((cancel) => cancel());
    this.cancelSchedule = [];
    if (this.deferredRafHandle !== null) {
      cancelAnimationFrame(this.deferredRafHandle);
      this.deferredRafHandle = null;
    }
    this.removeDrawable?.();
    this.removeDrawable = null;
    if (this.element && this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
    this.element = null;
    this.stage = null;
    this.source = null;
    this.sourcePromise = null;
    this.drawRect = null;
    this.prepared = false;
  }

  getRenderedSize(): { width: number; height: number } | null {
    if (!this.drawRect) return null;
    const scale = this.getStageScale();
    return {
      width: this.drawRect.width * scale.x,
      height: this.drawRect.height * scale.y,
    };
  }

  getElement(): HTMLElement | null {
    return this.element ?? this.stage?.canvas ?? null;
  }
}

export { ImageComponent as default };
