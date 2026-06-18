import { ParameterType } from "jspsych";
import { getCanvasStage, CanvasStage } from "../renderer/CanvasStage";
import {
  createPrecisionTiming,
  getResponseRT,
  resolveTimingMs,
  scheduleFrameEvent,
  scheduleStimulusVisibility,
  setResponseStartTime,
} from "../utils/PrecisionTiming";

var version = "1.0.0";

const info = {
  name: "TextComponent",
  version,
  parameters: {
    name: {
      type: ParameterType.STRING,
      default: undefined,
    },
    /**
     * The text content to display. Use %% to create inline input fields (cloze blanks).
     * You can embed a correct answer between the percent signs (e.g. %answer%) and optionally
     * allow multiple correct answers by separating them with a slash (e.g. %yes/yep%).
     */
    text: {
      type: ParameterType.STRING,
      pretty_name: "Text",
      default: "Text",
      description:
        "The text content to display. Use %% (or %answer%) to embed inline input fields.",
    },
    /** Position coordinates for the text block. x and y should be between -1 and 1. */
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
    /** Rotation angle in degrees */
    rotation: {
      type: ParameterType.INT,
      pretty_name: "Rotation",
      default: 0,
      description: "Rotation of the text block in degrees",
    },

    // ── Style params ─────────────────────────────────────────────
    /** Text (foreground) color */
    font_color: {
      type: ParameterType.STRING,
      pretty_name: "Font Color",
      default: "#000000",
      description: "CSS color for the text",
    },
    /** Font size in pixels */
    font_size: {
      type: ParameterType.INT,
      pretty_name: "Font Size",
      default: 16,
      description: "Font size of the text in pixels",
    },
    /** CSS font-family */
    font_family: {
      type: ParameterType.STRING,
      pretty_name: "Font Family",
      default: "sans-serif",
      description: "CSS font-family value",
    },
    /** Font weight: normal or bold */
    font_weight: {
      type: ParameterType.STRING,
      pretty_name: "Font Weight",
      default: "normal",
      description: "Font weight (normal / bold / 100–900)",
    },
    /** Font style: normal or italic */
    font_style: {
      type: ParameterType.STRING,
      pretty_name: "Font Style",
      default: "normal",
      description: "Font style (normal / italic)",
    },
    /** Text alignment: left, center, or right */
    text_align: {
      type: ParameterType.STRING,
      pretty_name: "Text Align",
      default: "center",
      description: "Horizontal alignment of the text (left / center / right)",
    },
    /** Line height (unitless multiplier, e.g. 1.5) */
    line_height: {
      type: ParameterType.FLOAT,
      pretty_name: "Line Height",
      default: 1.5,
      description: "Line height as a unitless multiplier",
    },
    /** Background color of the text container */
    background_color: {
      type: ParameterType.STRING,
      pretty_name: "Background Color",
      default: "transparent",
      description: "Background color of the text block",
    },
    /** Padding inside the text container (CSS shorthand) */
    padding: {
      type: ParameterType.STRING,
      pretty_name: "Padding",
      default: "0px",
      description: "CSS padding shorthand for the text block",
    },
    /** Border radius in pixels */
    border_radius: {
      type: ParameterType.INT,
      pretty_name: "Border Radius",
      default: 0,
      description: "Corner radius of the text block in pixels",
    },
    /** Border color */
    border_color: {
      type: ParameterType.STRING,
      pretty_name: "Border Color",
      default: "transparent",
      description: "Border color of the text block",
    },
    /** Border width in pixels */
    border_width: {
      type: ParameterType.INT,
      pretty_name: "Border Width",
      default: 0,
      description: "Border width of the text block in pixels",
    },
    /** Fixed width of the text block in pixels. null = max-content */
    width: {
      type: ParameterType.INT,
      pretty_name: "Width",
      default: null,
      description: "Width of the text block in pixels (null = auto)",
    },
    /** Delay in milliseconds before showing the stimulus. If null, the stimulus appears immediately. */
    stimulus_onset: {
      type: ParameterType.INT,
      default: null,
    },
    /** How long to show the stimulus for in milliseconds. If null, it stays visible for the whole trial. */
    stimulus_duration: {
      type: ParameterType.INT,
      default: null,
    },

    // ── Cloze / inline-input params (only relevant when text contains %%) ──
    /**
     * When true, answers are checked against the correct solutions embedded in the text.
     * Incorrect answers are highlighted in red and the response is NOT recorded until
     * all answers are correct.
     */
    check_answers: {
      type: ParameterType.BOOL,
      pretty_name: "Check Answers",
      default: false,
      description:
        "Validate participant answers against the solutions embedded in %%",
    },
    /** When false, all input fields must be filled before a response is recorded. */
    allow_blanks: {
      type: ParameterType.BOOL,
      pretty_name: "Allow Blanks",
      default: true,
      description: "Whether empty input fields are accepted",
    },
    /** Whether answer checking is case-sensitive. */
    case_sensitivity: {
      type: ParameterType.BOOL,
      pretty_name: "Case Sensitivity",
      default: true,
      description: "Whether the answer check is case-sensitive",
    },
    /** Auto-focus the first inline input field on render. */
    autofocus: {
      type: ParameterType.BOOL,
      pretty_name: "Autofocus",
      default: true,
      description:
        "Auto-focus the first input field when the component renders",
    },
  },
  data: {
    /** Answers collected from inline input fields (only present when %% is used). */
    response: {
      type: ParameterType.STRING,
      array: true,
    },
    /** Time from render to recordResponse in milliseconds (only when %% is used). */
    rt: {
      type: ParameterType.FLOAT,
    },
  },
  citations: {
    apa: "de Leeuw, J. R., Gilbert, R. A., & Luchterhandt, B. (2023). jsPsych: Enabling an Open-Source Collaborative Ecosystem of Behavioral Experiments. Journal of Open Source Software, 8(85), 5351. https://doi.org/10.21105/joss.05351 ",
    bibtex:
      "@article{Leeuw2023jsPsych, author = {de Leeuw, Joshua R. and Gilbert, Rebecca A. and Luchterhandt, Björn}, journal = {Journal of Open Source Software}, doi = {10.21105/joss.05351}, issn = {2475-9066}, number = {85}, year = {2023}, month = {may 11}, pages = {5351}, publisher = {Open Journals}, title = {jsPsych: Enabling an {Open}-{Source} {Collaborative} {Ecosystem} of {Behavioral} {Experiments}}, url = {https://joss.theoj.org/papers/10.21105/joss.05351}, volume = {8}, }  ",
  },
};

type Padding = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

type TextLayout = {
  canvasWidth: number;
  canvasHeight: number;
  centerX: number;
  centerY: number;
  width: number;
  height: number;
  rotation: number;
  lines: string[];
  font: string;
  fontColor: string;
  textAlign: CanvasTextAlign;
  lineHeightPx: number;
  padding: Padding;
  backgroundColor: string;
  borderRadius: number;
  borderColor: string;
  borderWidth: number;
};

let textComponentCounter = 0;

/**
 * TextComponent - Renders plain text as a prebuilt WebGL texture.
 * Cloze/input text stays DOM-based because it is interactive.
 */
class TextComponent {
  private jsPsych: any;
  private element: HTMLElement | null = null;
  private stage: CanvasStage | null = null;
  private cancelVisibilitySchedule: (() => void) | null = null;
  private cancelSchedule: Array<() => void> = [];
  private removeDrawable: (() => void) | null = null;
  private drawableId = "";
  private layout: TextLayout | null = null;
  private prepared = false;
  private drawn = false;
  private offsetReached = false;
  private destroyed = false;

  // ── Cloze state ─────────────────────────────────────────────────────────
  private isClozeMode: boolean = false;
  private response: string[] | null = null;
  private rt: number | null = null;
  private start_time: number | null = null;
  private solutions: string[][] = [];
  private inputElements: HTMLInputElement[] = [];

  constructor(jsPsych: any) {
    this.jsPsych = jsPsych;
  }

  static info = info;

  /**
   * Resolve a parameter value that may be stored as a raw value OR as the
   * ParameterMapper envelope `{source: "typed"|"csv", value: ...}`.
   */
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

  private isTransparent(color: string | null | undefined): boolean {
    if (!color) return true;
    const normalized = String(color).trim().toLowerCase();
    return (
      normalized === "transparent" ||
      normalized === "none" ||
      normalized === "rgba(0,0,0,0)" ||
      normalized === "rgba(0, 0, 0, 0)"
    );
  }

  private parseCssPx(raw: string | number | null | undefined): number {
    if (raw === null || raw === undefined) return 0;
    if (typeof raw === "number") return Number.isFinite(raw) ? raw : 0;
    const match = String(raw).trim().match(/^(-?\d+(?:\.\d+)?)/);
    return match ? Number(match[1]) : 0;
  }

  private parsePadding(raw: any): Padding {
    const value = String(this.resolveParam(raw, "0px")).trim();
    const parts = value.split(/\s+/).map((part) => this.parseCssPx(part));
    const [top = 0, right = top, bottom = top, left = right] =
      parts.length === 1
        ? [parts[0], parts[0], parts[0], parts[0]]
        : parts.length === 2
          ? [parts[0], parts[1], parts[0], parts[1]]
          : parts.length === 3
            ? [parts[0], parts[1], parts[2], parts[1]]
            : [parts[0], parts[1], parts[2], parts[3]];

    return { top, right, bottom, left };
  }

  private roundedRectPath(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number,
  ) {
    const r = Math.max(0, Math.min(radius, width / 2, height / 2));
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + width - r, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + r);
    ctx.lineTo(x + width, y + height - r);
    ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
    ctx.lineTo(x + r, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  private wrapLine(
    ctx: CanvasRenderingContext2D,
    line: string,
    maxWidth: number,
  ): string[] {
    if (!line) return [""];
    if (!maxWidth || ctx.measureText(line).width <= maxWidth) return [line];

    const words = line.split(/(\s+)/);
    const lines: string[] = [];
    let current = "";

    for (const word of words) {
      const next = current + word;
      if (current && ctx.measureText(next).width > maxWidth) {
        lines.push(current.trimEnd());
        current = word.trimStart();
      } else {
        current = next;
      }
    }

    if (current) lines.push(current.trimEnd());
    return lines.length > 0 ? lines : [line];
  }

  private createTextLayout(config: any): TextLayout | null {
    if (!this.stage) return null;

    const measurementCanvas = document.createElement("canvas");
    const measurementCtx = measurementCanvas.getContext("2d");
    if (!measurementCtx) return null;

    const canvasStyles = this.resolveParam(config.__canvasStyles, {});
    const canvasWidth = this.resolveParam(canvasStyles?.width, 1024);
    const canvasHeight = this.resolveParam(canvasStyles?.height, 768);
    const text = String(this.resolveParam(config.text, "Text"));
    const fontSizeVw = this.resolveParam(config._font_size_runtime_vw, null);
    const configuredFontSize = this.resolveParam(config.font_size, 16);
    const fontSize =
      configuredFontSize != null
        ? Number(configuredFontSize)
        : fontSizeVw != null
          ? (Number(fontSizeVw) / 100) * canvasWidth
          : 16;
    const fontFamily = this.resolveParam(config.font_family, "sans-serif");
    const fontWeight = this.resolveParam(config.font_weight, "normal");
    const fontStyle = this.resolveParam(config.font_style, "normal");
    const font = `${fontStyle} ${fontWeight} ${fontSize}px ${fontFamily}`;
    const lineHeight = Number(this.resolveParam(config.line_height, 1.5));
    const lineHeightPx = Math.max(1, fontSize * lineHeight);
    const padding = this.parsePadding(config.padding);
    const configuredWidth = this.resolveParam(config.width, null);
    const explicitWidth =
      configuredWidth != null ? (Number(configuredWidth) / 100) * canvasWidth : null;
    const maxBlockWidth = explicitWidth ?? Math.max(200, canvasWidth * 0.86);
    const maxTextWidth = Math.max(
      1,
      maxBlockWidth - padding.left - padding.right,
    );

    measurementCtx.save();
    measurementCtx.font = font;
    const lines = text
      .split(/\r?\n/)
      .flatMap((line) => this.wrapLine(measurementCtx, line, maxTextWidth));
    const measuredTextWidth = Math.max(
      1,
      ...lines.map((line) => measurementCtx.measureText(line).width),
    );
    measurementCtx.restore();

    const blockWidth =
      explicitWidth ?? measuredTextWidth + padding.left + padding.right;
    const blockHeight =
      lines.length * lineHeightPx + padding.top + padding.bottom;
    const coordinates = this.resolveParam(config.coordinates, { x: 0, y: 0 });
    const centerX =
      canvasWidth / 2 + ((coordinates?.x ?? 0) / 100) * (canvasWidth / 2);
    const centerY =
      canvasHeight / 2 - ((coordinates?.y ?? 0) / 100) * (canvasHeight / 2);

    return {
      canvasWidth,
      canvasHeight,
      centerX,
      centerY,
      width: blockWidth,
      height: blockHeight,
      rotation: Number(this.resolveParam(config.rotation, 0)),
      lines,
      font,
      fontColor: this.resolveParam(config.font_color, "#000000"),
      textAlign: this.resolveParam(config.text_align, "center") as CanvasTextAlign,
      lineHeightPx,
      padding,
      backgroundColor: this.resolveParam(config.background_color, "transparent"),
      borderRadius: Number(this.resolveParam(config.border_radius, 0)),
      borderColor: this.resolveParam(config.border_color, "transparent"),
      borderWidth: Number(this.resolveParam(config.border_width, 0)),
    };
  }

  private updateTrackingElement(layout: TextLayout, zIndex: number) {
    if (!this.element) return;
    this.element.style.left = `${layout.centerX}px`;
    this.element.style.top = `${layout.centerY}px`;
    this.element.style.width = `${layout.width}px`;
    this.element.style.height = `${layout.height}px`;
    this.element.style.transform = `translate(-50%, -50%) rotate(${layout.rotation}deg)`;
    this.element.style.zIndex = String(zIndex);
    this.element.style.visibility = "visible";
  }

  private drawLayout(ctx: CanvasRenderingContext2D, layout: TextLayout) {
    const originX = -layout.width / 2;
    const originY = -layout.height / 2;

    ctx.save();
    ctx.translate(layout.centerX, layout.centerY);
    ctx.rotate((layout.rotation * Math.PI) / 180);

    if (!this.isTransparent(layout.backgroundColor)) {
      ctx.fillStyle = layout.backgroundColor;
      this.roundedRectPath(
        ctx,
        originX,
        originY,
        layout.width,
        layout.height,
        layout.borderRadius,
      );
      ctx.fill();
    }

    if (layout.borderWidth > 0 && !this.isTransparent(layout.borderColor)) {
      ctx.strokeStyle = layout.borderColor;
      ctx.lineWidth = layout.borderWidth;
      this.roundedRectPath(
        ctx,
        originX + layout.borderWidth / 2,
        originY + layout.borderWidth / 2,
        layout.width - layout.borderWidth,
        layout.height - layout.borderWidth,
        layout.borderRadius,
      );
      ctx.stroke();
    }

    ctx.font = layout.font;
    ctx.fillStyle = layout.fontColor;
    ctx.textAlign = layout.textAlign;
    ctx.textBaseline = "middle";

    const textX =
      layout.textAlign === "left"
        ? originX + layout.padding.left
        : layout.textAlign === "right"
          ? originX + layout.width - layout.padding.right
          : 0;
    const firstLineY =
      originY + layout.padding.top + layout.lineHeightPx / 2;

    layout.lines.forEach((line, index) => {
      ctx.fillText(line, textX, firstLineY + index * layout.lineHeightPx);
    });

    ctx.restore();
  }

  private prepareCanvasText(config: any, zIndex: number): boolean {
    if (this.destroyed || !this.stage || this.prepared) return this.prepared;

    const layout = this.createTextLayout(config);
    if (!layout) return false;

    this.layout = layout;
    this.updateTrackingElement(layout, zIndex);
    this.removeDrawable?.();
    const textureCanvas = document.createElement("canvas");
    const dpr = window.devicePixelRatio || 1;
    textureCanvas.width = Math.round(layout.canvasWidth * dpr);
    textureCanvas.height = Math.round(layout.canvasHeight * dpr);
    const textureCtx = textureCanvas.getContext("2d", { alpha: true });
    if (!textureCtx) return false;
    textureCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    textureCtx.clearRect(0, 0, layout.canvasWidth, layout.canvasHeight);
    this.drawLayout(textureCtx, layout);
    this.stage.preloadTexture(this.drawableId, textureCanvas);
    this.removeDrawable = this.stage.registerSprite({
      id: this.drawableId,
      zIndex,
      visible: false,
      textureKey: this.drawableId,
      source: textureCanvas,
      x: 0,
      y: 0,
      width: layout.canvasWidth,
      height: layout.canvasHeight,
    });
    this.prepared = true;
    return true;
  }

  private renderCanvasText(container: HTMLElement, config: any): HTMLElement {
    const canvasStyles = this.resolveParam(config.__canvasStyles, {});
    const canvasWidth = this.resolveParam(canvasStyles?.width, 1024);
    const canvasHeight = this.resolveParam(canvasStyles?.height, 768);
    const zIndex = resolveTimingMs(config.zIndex, 0) ?? 0;

    this.destroyed = false;
    this.offsetReached = false;
    this.drawn = false;
    this.prepared = false;
    this.layout = null;
    this.drawableId = config.name
      ? `text-${config.name}`
      : `text-${++textComponentCounter}`;

    this.stage = getCanvasStage(container, {
      width: canvasWidth,
      height: canvasHeight,
      backgroundColor: "transparent",
      zIndex,
      backend: this.resolveParam(config.__renderBackend, "webgl-strict"),
      recordGpuTiming: this.resolveParam(config.__recordGpuTiming, true),
    });

    this.element = document.createElement("div");
    this.element.id = config.name
      ? `jspsych-text-component-${config.name}`
      : "jspsych-text-component";
    this.element.className = "dynamic-text-component";
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

    this.prepareCanvasText(config, zIndex);

    const timing = config.__timing as
      | ReturnType<typeof createPrecisionTiming>
      | undefined;
    const stimulusOnset = resolveTimingMs(config.stimulus_onset, null);
    const stimulusDuration = resolveTimingMs(config.stimulus_duration, null);
    const stimulusTiming = timing?.registerStimulus?.(
      config.name || config.type || this.drawableId,
      stimulusOnset,
      stimulusDuration,
      config.__componentId ?? config.builder_id ?? config.id ?? null,
    );

    const draw = (timestamp: number) => {
      if (this.destroyed || this.offsetReached) return;
      if (!this.prepareCanvasText(config, zIndex)) return;
      this.drawn = true;
      this.stage?.setDrawableVisibility(this.drawableId, true, (commitInfo) => {
        stimulusTiming?.markOnset(timestamp, commitInfo);
      });
    };

    const hide = (timestamp: number) => {
      if (this.destroyed) return;
      this.offsetReached = true;
      if (this.drawn) {
        this.stage?.setDrawableVisibility(this.drawableId, false, (commitInfo) => {
          stimulusTiming?.markOffset(timestamp, commitInfo);
        });
      } else {
        this.stage?.setDrawableVisibility(this.drawableId, false);
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
      this.cancelSchedule.push(scheduleFrameEvent(drawDelay, draw));

      if (stimulusDuration !== null) {
        this.cancelSchedule.push(
          scheduleFrameEvent(drawDelay + stimulusDuration, hide),
        );
      }
    }

    return this.element;
  }

  render(container: HTMLElement, config: any): HTMLElement {
    const text = this.resolveParam(config.text, "Text");
    const parts = String(text).split("%");
    this.isClozeMode = parts.length >= 3 && parts.length % 2 === 1;

    if (!this.isClozeMode) {
      return this.renderCanvasText(container, config);
    }

    const mapValue = (value: number): number => {
      if (value < -100) return -50;
      if (value > 100) return 50;
      return value * 0.5;
    };

    // Resolve all params
    const fontColor = this.resolveParam(config.font_color, "#000000");
    const fontSizeVw = this.resolveParam(config._font_size_runtime_vw, null);
    const fontSize = this.resolveParam(config.font_size, 16);
    const fontFamily = this.resolveParam(config.font_family, "sans-serif");
    const fontWeight = this.resolveParam(config.font_weight, "normal");
    const fontStyle = this.resolveParam(config.font_style, "normal");
    const textAlign = this.resolveParam(config.text_align, "center");
    const lineHeight = this.resolveParam(config.line_height, 1.5);
    const bgColor = this.resolveParam(config.background_color, "transparent");
    const padding = this.resolveParam(config.padding, "0px");
    const borderRadius = this.resolveParam(config.border_radius, 0);
    const borderColor = this.resolveParam(config.border_color, "transparent");
    const borderWidth = this.resolveParam(config.border_width, 0);
    const width = this.resolveParam(config.width, null);
    const rotation = this.resolveParam(config.rotation, 0);
    const canvasStyles = this.resolveParam(config.__canvasStyles, {});
    const canvasWidth = this.resolveParam(canvasStyles?.width, window.innerWidth);

    // Create element
    this.element = document.createElement("div");
    this.element.id = config.name
      ? `jspsych-text-component-${config.name}`
      : "jspsych-text-component";

    // Position
    this.element.style.position = "absolute";
    const coordinates = config.coordinates || { x: 0, y: 0 };
    const xVw = mapValue(coordinates.x);
    const yVh = mapValue(coordinates.y);
    this.element.style.left = `calc(50% + ${xVw}vw)`;
    this.element.style.top = `calc(50% - ${yVh}vh)`;
    this.element.style.transform = `translate(-50%, -50%) rotate(${rotation}deg)`;
    if (config.zIndex !== undefined) {
      this.element.style.zIndex = String(this.resolveParam(config.zIndex, 0));
    }

    // Style
    this.element.style.color = fontColor;
    this.element.style.fontSize =
      fontSizeVw != null ? `${fontSizeVw}vw` : `${fontSize}px`;
    this.element.style.fontFamily = fontFamily;
    this.element.style.fontWeight = String(fontWeight);
    this.element.style.fontStyle = fontStyle;
    this.element.style.textAlign = textAlign;
    this.element.style.lineHeight = String(lineHeight);
    this.element.style.backgroundColor = bgColor;
    this.element.style.padding = padding;
    this.element.style.borderRadius = `${borderRadius}px`;
    this.element.style.border =
      borderWidth > 0 ? `${borderWidth}px solid ${borderColor}` : "none";
    this.element.style.width = width != null ? `${width}vw` : "max-content";
    this.element.style.maxWidth =
      width != null ? "none" : `${Math.max(200, canvasWidth * 0.86)}px`;
    this.element.style.boxSizing = "border-box";
    this.element.style.whiteSpace = "nowrap";

    // ── Cloze mode: same logic as InputResponseComponent ────────────────
    const caseSensitive = this.resolveParam(config.case_sensitivity, true);
    this.solutions = this.parseSolutions(parts, caseSensitive);

    let html = "";
    let solution_counter = 0;
    for (let i = 0; i < parts.length; i++) {
      if (i % 2 === 0) {
        html += parts[i];
      } else {
        // No CSS class – all layout via inline styles so nothing overrides
        html += `<input type="text" id="input${solution_counter}" value="" style="display:inline;font:inherit;color:inherit;vertical-align:baseline;width:10ch;box-sizing:content-box;">`;
        solution_counter++;
      }
    }

    this.element.innerHTML = html;
    container.appendChild(this.element);

    // Collect input element references
    this.inputElements = [];
    for (let i = 0; i < this.solutions.length; i++) {
      const input = document.getElementById(`input${i}`) as HTMLInputElement;
      if (input) {
        this.inputElements.push(input);
      }
    }

    // Autofocus first input if enabled
    const autofocus = this.resolveParam(config.autofocus, true);
    if (autofocus && this.inputElements.length > 0) {
      this.inputElements[0].focus();
    }

    setResponseStartTime(this, config.__timing);
    this.cancelVisibilitySchedule = scheduleStimulusVisibility(
      this.element,
      config,
      config.__timing,
    );

    return this.element;
  }

  // ── Cloze helpers ──────────────────────────────────────────────────────

  /**
   * Parse correct solutions from the odd-indexed segments of the split text.
   * Accepts multiple correct answers separated by `/`.
   */
  private parseSolutions(parts: string[], caseSensitive: boolean): string[][] {
    const solutions: string[][] = [];
    for (let i = 1; i < parts.length; i += 2) {
      const raw = caseSensitive
        ? parts[i].trim()
        : parts[i].toLowerCase().trim();
      solutions.push(raw.split("/").map((s) => s.trim()));
    }
    return solutions;
  }

  /**
   * Collect answers from all input fields.
   * Returns the answers array on success, or null when validation fails
   * (wrong answers / blanks not allowed).
   */
  private collectCurrentResponse(config: any): string[] | null {
    if (!this.isClozeMode) return null;

    const caseSensitive = this.resolveParam(config.case_sensitivity, true);
    const checkAnswers = this.resolveParam(config.check_answers, false);
    const allowBlanks = this.resolveParam(config.allow_blanks, true);

    const answers: string[] = [];
    let allCorrect = true;
    let allFilled = true;

    for (let i = 0; i < this.solutions.length; i++) {
      const field = this.inputElements[i];
      if (!field) continue;

      const raw = field.value.trim();
      const answer = caseSensitive ? raw : raw.toLowerCase();
      answers.push(answer);

      if (checkAnswers) {
        if (!this.solutions[i].includes(answer)) {
          field.style.color = "red";
          allCorrect = false;
        } else {
          field.style.color = "";
        }
      }

      if (!allowBlanks && answer === "") {
        allFilled = false;
      }
    }

    if ((checkAnswers && !allCorrect) || (!allowBlanks && !allFilled)) {
      return null;
    }
    return answers;
  }

  /**
   * Record the current cloze response (called externally, e.g. by a button or
   * the DynamicPlugin's `recordAllPendingResponses`).
   * Returns true on success, false if validation failed or already recorded.
   */
  recordResponse(config: any): boolean {
    if (!this.isClozeMode || this.response !== null) return false;

    const answers = this.collectCurrentResponse(config);
    if (answers === null) return false;

    this.rt = getResponseRT(this, config.__timing);
    this.response = answers;
    return true;
  }

  /** Returns the recorded answers, or null when not yet recorded. */
  getResponse(): string[] | null {
    return this.response;
  }

  /** Returns the response time in milliseconds, or null when not yet recorded. */
  getRT(): number | null {
    return this.rt;
  }

  /**
   * Check whether the current input state would pass validation without
   * committing the response.
   */
  isValid(config: any): boolean {
    return this.collectCurrentResponse(config) !== null;
  }

  hide(): void {
    if (this.isClozeMode) {
      if (this.element) this.element.style.visibility = "hidden";
      return;
    }
    this.stage?.setDrawableVisibility(this.drawableId, false);
  }

  show(): void {
    if (this.isClozeMode) {
      if (this.element) this.element.style.visibility = "visible";
      return;
    }
    if (this.drawn) {
      this.stage?.setDrawableVisibility(this.drawableId, true);
    }
  }

  destroy(): void {
    if (this.cancelVisibilitySchedule) this.cancelVisibilitySchedule();
    this.cancelSchedule.forEach((cancel) => cancel());
    this.cancelSchedule = [];
    this.removeDrawable?.();
    this.removeDrawable = null;
    if (this.element && this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
    this.element = null;
    this.stage = null;
    this.layout = null;
    this.prepared = false;
    this.destroyed = true;
  }

  getRenderedSize(): { width: number; height: number } | null {
    if (!this.layout) return null;
    const rect = this.element?.getBoundingClientRect();
    if (rect) {
      return {
        width: rect.width,
        height: rect.height,
      };
    }
    return {
      width: this.layout.width,
      height: this.layout.height,
    };
  }
}

export default TextComponent;
