import { ParameterType } from "jspsych";
import { getCanvasStage, CanvasStage } from "../renderer/CanvasStage";
import { getResponseRT, setResponseStartTime } from "../utils/PrecisionTiming";

var version = "2.1.1";

const info = {
  name: "SliderResponseComponent",
  version,
  parameters: {
    name: {
      type: ParameterType.STRING,
      default: undefined,
    },
    /** Sets the minimum value of the slider. */
    min: {
      type: ParameterType.INT,
      default: 0,
    },
    /** Sets the maximum value of the slider. */
    max: {
      type: ParameterType.INT,
      default: 100,
    },
    /** Sets the starting value of the slider. */
    slider_start: {
      type: ParameterType.INT,
      default: 50,
    },
    /** Sets the step of the slider. */
    step: {
      type: ParameterType.INT,
      default: 1,
    },
    /** Labels displayed at equidistant locations on the slider. For example, two labels will be placed at the ends of the slider.
     * Three labels would place two at the ends and one in the middle. Four will place two at the ends, and the other two will
     * be at 33% and 67% of the slider width. */
    labels: {
      type: ParameterType.STRING,
      default: [],
      array: true,
    },
    /** Set the width of the slider in pixels. If left null, then the width will be equal to the widest element in the display. */
    slider_width: {
      type: ParameterType.INT,
      default: null,
    },
    /** If true, the participant must move the slider before response is considered valid. */
    require_movement: {
      type: ParameterType.BOOL,
      default: false,
    },
    /** Position coordinates for the slider. x and y should be between -1 and 1, mapped to -50vw/vh to 50vw/vh. */
    coordinates: {
      type: ParameterType.OBJECT,
      default: { x: 0, y: 0 },
    },
    /** Z-index for layering (higher values appear on top) */
    zIndex: {
      type: ParameterType.INT,
      pretty_name: "Z-Index",
      default: 0,
      description: "Layer order - higher values render on top of lower values",
    },
  },
  data: {
    /** The numeric value of the slider. */
    response: {
      type: ParameterType.INT,
    },
    /** The response time in milliseconds for the participant to make a response. The time is measured from when the component is rendered. */
    rt: {
      type: ParameterType.FLOAT,
    },
    /** The starting value of the slider. */
    slider_start: {
      type: ParameterType.INT,
    },
  },

  // prettier-ignore
  citations: {
    "apa": "de Leeuw, J. R., Gilbert, R. A., & Luchterhandt, B. (2023). jsPsych: Enabling an Open-Source Collaborative Ecosystem of Behavioral Experiments. Journal of Open Source Software, 8(85), 5351. https://doi.org/10.21105/joss.05351 ",
    "bibtex": '@article{Leeuw2023jsPsych, 	author = {de Leeuw, Joshua R. and Gilbert, Rebecca A. and Luchterhandt, Bj{\\" o}rn}, 	journal = {Journal of Open Source Software}, 	doi = {10.21105/joss.05351}, 	issn = {2475-9066}, 	number = {85}, 	year = {2023}, 	month = {may 11}, 	pages = {5351}, 	publisher = {Open Journals}, 	title = {jsPsych: Enabling an {Open}-{Source} {Collaborative} {Ecosystem} of {Behavioral} {Experiments}}, 	url = {https://joss.theoj.org/papers/10.21105/joss.05351}, 	volume = {8}, }  '
  },
};

type SliderLayout = {
  centerX: number;
  centerY: number;
  width: number;
  height: number;
  trackX: number;
  trackY: number;
  trackWidth: number;
  thumbRadius: number;
  min: number;
  max: number;
  labels: string[];
  requireMovement: boolean;
  zIndex: number;
};

let sliderComponentCounter = 0;

/**
 * SliderResponseComponent
 *
 * Canvas-rendered slider visuals with a transparent native range input overlaid
 * for pointer, keyboard, focus, and value behavior.
 */
class SliderResponseComponent {
  private jsPsych: any;
  private response: number | null;
  private rt: number | null;
  private slider_start: number;
  private start_time: number | null;
  private sliderContainer: HTMLElement | null;
  private sliderElement: HTMLInputElement | null;
  private hasMoved: boolean;
  private timing: any = null;
  private stage: CanvasStage | null = null;
  private removeDrawable: (() => void) | null = null;
  private drawableId = "";
  private layout: SliderLayout | null = null;
  private validationError = false;

  static info = info;

  constructor(jsPsych: any) {
    this.jsPsych = jsPsych;
    this.response = null;
    this.rt = null;
    this.slider_start = 50; // Will be set in render()
    this.start_time = null;
    this.sliderContainer = null;
    this.sliderElement = null;
    this.hasMoved = false;
  }

  private resolveParam(raw: any, fallback: any): any {
    if (raw === undefined || raw === null) return fallback;
    if (
      typeof raw === "object" &&
      "value" in raw &&
      (raw.source === "typed" || raw.source === "csv")
    ) {
      return raw.value !== undefined && raw.value !== null
        ? raw.value
        : fallback;
    }
    return raw;
  }

  private getCanvasSize(trial: any) {
    const canvasStyles = this.resolveParam(trial.__canvasStyles, {});
    return {
      width: this.resolveParam(canvasStyles?.width, 1024),
      height: this.resolveParam(canvasStyles?.height, 768),
    };
  }

  private getLabels(raw: any): string[] {
    const labels = this.resolveParam(raw, []);
    if (Array.isArray(labels)) return labels.map((label) => String(label));
    if (typeof labels === "string" && labels.trim()) {
      return labels.split(",").map((label) => label.trim());
    }
    return [];
  }

  private createLayout(trial: any): SliderLayout {
    const { width: canvasWidth, height: canvasHeight } = this.getCanvasSize(trial);
    const configuredWidth = this.resolveParam(trial.width, null);
    const configuredHeight = this.resolveParam(trial.height, null);
    const configuredSliderWidth = this.resolveParam(trial.slider_width, null);
    const width =
      configuredWidth != null
        ? (Number(configuredWidth) / 100) * canvasWidth
        : configuredSliderWidth != null
          ? Number(configuredSliderWidth)
          : 300;
    const height =
      configuredHeight != null
        ? (Number(configuredHeight) / 100) * canvasWidth
        : 120;
    const coordinates = this.resolveParam(trial.coordinates, { x: 0, y: 0 });
    const centerX =
      canvasWidth / 2 + ((coordinates?.x ?? 0) / 100) * (canvasWidth / 2);
    const centerY =
      canvasHeight / 2 - ((coordinates?.y ?? 0) / 100) * (canvasHeight / 2);
    const padding = Math.max(10, Math.min(40, width * 0.14));

    return {
      centerX,
      centerY,
      width,
      height,
      trackX: padding,
      trackY: height * 0.4,
      trackWidth: Math.max(1, width - padding * 2),
      thumbRadius: Math.max(5, Math.min(10, height * 0.07)),
      min: Number(this.resolveParam(trial.min, 0)),
      max: Number(this.resolveParam(trial.max, 100)),
      labels: this.getLabels(trial.labels),
      requireMovement: Boolean(this.resolveParam(trial.require_movement, false)),
      zIndex: Number(this.resolveParam(trial.zIndex, 0)),
    };
  }

  private getCurrentNormalizedValue(): number {
    if (!this.layout) return 0.5;
    const value = this.sliderElement
      ? this.sliderElement.valueAsNumber
      : this.slider_start;
    const range = this.layout.max - this.layout.min;
    if (!Number.isFinite(value) || range === 0) return 0.5;
    return Math.max(0, Math.min(1, (value - this.layout.min) / range));
  }

  private updateOverlay(layout: SliderLayout) {
    if (!this.sliderContainer || !this.sliderElement) return;

    this.sliderContainer.style.left = `${layout.centerX}px`;
    this.sliderContainer.style.top = `${layout.centerY}px`;
    this.sliderContainer.style.width = `${layout.width}px`;
    this.sliderContainer.style.height = `${layout.height}px`;
    this.sliderContainer.style.transform = "translate(-50%, -50%)";
    this.sliderContainer.style.zIndex = String(layout.zIndex);

    this.sliderElement.style.left = `${layout.trackX}px`;
    this.sliderElement.style.top = `${layout.trackY - layout.thumbRadius * 2}px`;
    this.sliderElement.style.width = `${layout.trackWidth}px`;
    this.sliderElement.style.height = `${layout.thumbRadius * 4}px`;
  }

  private drawLayout(ctx: CanvasRenderingContext2D, layout: SliderLayout) {
    const valuePosition = this.getCurrentNormalizedValue();
    const thumbX = layout.trackX + layout.trackWidth * valuePosition;
    const thumbY = layout.trackY;
    const originX = -layout.width / 2;
    const originY = -layout.height / 2;

    ctx.save();
    ctx.translate(layout.centerX + originX, layout.centerY + originY);

    if (this.validationError) {
      ctx.strokeStyle = "#e74c3c";
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 4]);
      ctx.strokeRect(0, 0, layout.width, layout.height);
      ctx.setLineDash([]);
    }

    ctx.strokeStyle = "#9333ea";
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(layout.trackX, layout.trackY);
    ctx.lineTo(layout.trackX + layout.trackWidth, layout.trackY);
    ctx.stroke();

    ctx.fillStyle = "#9333ea";
    ctx.beginPath();
    ctx.arc(thumbX, thumbY, layout.thumbRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.stroke();

    if (layout.labels.length >= 2) {
      ctx.font = "12px sans-serif";
      ctx.fillStyle = "#6b21a8";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";

      layout.labels.forEach((label, index) => {
        const ratio =
          layout.labels.length === 1
            ? 0
            : index / Math.max(1, layout.labels.length - 1);
        const x = layout.trackX + layout.trackWidth * ratio;
        ctx.fillText(label, x, layout.trackY + layout.thumbRadius + 8);
      });
    }

    if (layout.requireMovement) {
      ctx.font = "italic 11px sans-serif";
      ctx.fillStyle = "#9333ea";
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.fillText("(movement required)", layout.width / 2, layout.height - 8);
    }

    ctx.restore();
  }

  private renderCanvas() {
    this.stage?.render();
  }

  /**
   * Render the slider and submit button into the display element
   */
  render(
    display_element: HTMLElement,
    trial: any,
    onResponse?: () => void,
  ): HTMLElement {
    this.timing = trial.__timing || null;
    this.validationError = false;
    this.response = null;
    this.rt = null;
    this.hasMoved = false;

    const { width: canvasWidth, height: canvasHeight } = this.getCanvasSize(trial);
    const zIndex = Number(this.resolveParam(trial.zIndex, 0));
    this.drawableId = trial.name
      ? `slider-${trial.name}`
      : `slider-${++sliderComponentCounter}`;

    this.stage = getCanvasStage(display_element, {
      width: canvasWidth,
      height: canvasHeight,
      backgroundColor: "transparent",
      zIndex,
      backend: this.resolveParam(trial.__renderBackend, "webgl-strict"),
      recordGpuTiming: this.resolveParam(trial.__recordGpuTiming, true),
    });

    this.layout = this.createLayout(trial);

    // Store slider_start for data collection
    this.slider_start = Number(this.resolveParam(trial.slider_start, 50));

    this.sliderContainer = document.createElement("div");
    this.sliderContainer.classList.add("jspsych-slider-response-container");
    this.sliderContainer.style.position = "absolute";
    this.sliderContainer.style.margin = "0";
    this.sliderContainer.style.background = "transparent";
    this.sliderContainer.style.pointerEvents = "auto";
    this.sliderContainer.style.boxSizing = "border-box";

    this.sliderElement = document.createElement("input");
    this.sliderElement.type = "range";
    this.sliderElement.className = "jspsych-slider";
    this.sliderElement.id = "jspsych-slider-response-component";
    this.sliderElement.value = String(this.slider_start);
    this.sliderElement.min = String(this.layout.min);
    this.sliderElement.max = String(this.layout.max);
    this.sliderElement.step = String(this.resolveParam(trial.step, 1));
    this.sliderElement.style.position = "absolute";
    this.sliderElement.style.margin = "0";
    this.sliderElement.style.padding = "0";
    this.sliderElement.style.opacity = "0";
    this.sliderElement.style.cursor = "pointer";
    this.sliderElement.style.pointerEvents = "auto";

    this.sliderContainer.appendChild(this.sliderElement);
    display_element.appendChild(this.sliderContainer);
    this.updateOverlay(this.layout);

    const trackMovement = () => {
      this.hasMoved = true;
      this.renderCanvas();
    };

    this.sliderElement.addEventListener("mousedown", trackMovement);
    this.sliderElement.addEventListener("touchstart", trackMovement);
    this.sliderElement.addEventListener("change", trackMovement);
    this.sliderElement.addEventListener("input", trackMovement);

    if (!this.layout.requireMovement) {
      this.hasMoved = true;
    }

    this.removeDrawable?.();
    this.removeDrawable = this.stage.registerDrawable({
      id: this.drawableId,
      zIndex,
      visible: true,
      draw: (ctx) => {
        if (this.layout) this.drawLayout(ctx, this.layout);
      },
    });

    setResponseStartTime(this, this.timing);
    return this.sliderContainer;
  }

  /**
   * Record the slider response and RT (called externally, e.g., by a button)
   */
  recordResponse(trial: any): boolean {
    if (this.response !== null) {
      return false; // Already responded
    }

    // Check if movement is required but hasn't happened
    if (this.resolveParam(trial.require_movement, false) && !this.hasMoved) {
      return false; // Can't record yet
    }

    this.rt = getResponseRT(this, this.timing);
    this.response = this.sliderElement!.valueAsNumber;

    return true; // Successfully recorded
  }

  /**
   * Get the response (slider value)
   */
  getResponse(): number | null {
    return this.response;
  }

  /**
   * Get current slider value without recording response
   */
  getCurrentValue(): number {
    return this.sliderElement
      ? this.sliderElement.valueAsNumber
      : this.slider_start;
  }

  /**
   * Check if response is currently valid (without recording it)
   */
  isValid(trial: any): boolean {
    if (this.resolveParam(trial.require_movement, false) && !this.hasMoved) {
      return false;
    }
    return true;
  }

  /**
   * Get the response time
   */
  getRT(): number | null {
    return this.rt;
  }

  /**
   * Get the slider starting value
   */
  getSliderStart(): number {
    return this.slider_start;
  }

  /** Highlight the slider container to indicate a response is required */
  showValidationError(): void {
    this.validationError = true;
    if (this.sliderContainer) {
      this.sliderContainer.classList.add("jspsych-require-response-error");
    }
    this.renderCanvas();
  }

  /** Remove validation error highlight */
  clearValidationError(): void {
    this.validationError = false;
    if (this.sliderContainer) {
      this.sliderContainer.classList.remove("jspsych-require-response-error");
    }
    this.renderCanvas();
  }

  getRenderedSize(): { width: number; height: number } | null {
    if (this.sliderContainer) {
      const rect = this.sliderContainer.getBoundingClientRect();
      return {
        width: rect.width,
        height: rect.height,
      };
    }
    return this.layout
      ? {
          width: this.layout.width,
          height: this.layout.height,
        }
      : null;
  }

  /**
   * Cleanup: remove elements from DOM
   */
  destroy(): void {
    this.removeDrawable?.();
    this.removeDrawable = null;
    if (this.sliderContainer) {
      this.sliderContainer.remove();
      this.sliderContainer = null;
    }
    this.sliderElement = null;
    this.stage = null;
    this.layout = null;
  }
}

export default SliderResponseComponent;
