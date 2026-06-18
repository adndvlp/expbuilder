import { ParameterType } from "jspsych";
import { getCanvasStage, CanvasStage } from "../renderer/CanvasStage";
import {
  CanvasBitmapSource,
  getResponseRT,
  preloadBitmap,
  resolveTimingMs,
  scheduleFrameEvent,
  setResponseStartTime,
} from "../utils/PrecisionTiming";

var version = "2.2.0";

const info = {
  name: "ButtonResponseComponent",
  version,
  parameters: {
    name: {
      type: ParameterType.STRING,
      default: undefined,
    },
    /**
     * Labels for the buttons. Each different string in the array will generate a different button.
     * If a choice is a URL to an image (detected by common image extensions), it will be rendered as an image button.
     */
    choices: {
      type: ParameterType.STRING,
      default: void 0,
      array: true,
    },
    /**
     *  A function that generates the HTML for each button in the `choices` array. The function gets the string and index
     * of the item in the `choices` array and should return valid HTML. If you want to use different markup for each
     * button, you can do that by using a conditional on either parameter. The default parameter returns a button element
     * with the text label of the choice, or an image if the choice is a URL to an image.
     */
    button_html: {
      type: ParameterType.FUNCTION,
      default: function (choice: string, choice_index: number) {
        return `<button class="jspsych-btn">${choice}</button>`;
      },
    },
    /** Width of image buttons in pixels. Only applies when choices contain image URLs. */
    image_button_width: {
      type: ParameterType.INT,
      default: 150,
    },
    /** Height of image buttons in pixels. Only applies when choices contain image URLs. */
    image_button_height: {
      type: ParameterType.INT,
      default: 150,
    },

    /** Setting to `'grid'` will make the container element have the CSS property `display: grid` and enable the
     * use of `grid_rows` and `grid_columns`. Setting to `'flex'` will make the container element have the CSS
     * property `display: flex`. You can customize how the buttons are laid out by adding inline CSS in the
     * `button_html` parameter.
     */
    button_layout: {
      type: ParameterType.STRING,
      default: "grid",
    },
    /**
     * The number of rows in the button grid. Only applicable when `button_layout` is set to `'grid'`. If null,
     * the number of rows will be determined automatically based on the number of buttons and the number of columns.
     */
    grid_rows: {
      type: ParameterType.INT,
      default: 1,
    },
    /** The number of grid columns when `button_layout` is "grid".
     * Setting to `null` (default value) will infer the number of columns
     * based on the number of rows and buttons. */
    grid_columns: {
      type: ParameterType.INT,
      default: null,
    },
    /** How long the button will delay enabling in milliseconds. */
    enable_button_after: {
      type: ParameterType.INT,
      default: 0,
    },
    /** Position coordinates for the button group. x and y should be between -1 and 1, mapped to -50vw/vh to 50vw/vh. */
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

    // ── Style params ─────────────────────────────────────────────
    /** Background color of the buttons (CSS color string). */
    button_color: {
      type: ParameterType.STRING,
      pretty_name: "Button Color",
      default: "#e7e7e7",
      description: "Background color of the buttons",
    },
    /** Text color inside the buttons (CSS color string). */
    button_text_color: {
      type: ParameterType.STRING,
      pretty_name: "Button Text Color",
      default: "#000000",
      description: "Text color inside the buttons",
    },
    /** Font size of the button text in pixels. */
    button_font_size: {
      type: ParameterType.INT,
      pretty_name: "Button Font Size",
      default: 14,
      description: "Font size of the button label in pixels",
    },
    /** Border radius of the buttons in pixels. */
    button_border_radius: {
      type: ParameterType.INT,
      pretty_name: "Button Border Radius",
      default: 3,
      description: "Corner radius of the buttons",
    },
    /** Border color of the buttons (CSS color string). */
    button_border_color: {
      type: ParameterType.STRING,
      pretty_name: "Button Border Color",
      default: "#999999",
      description: "Border color of the buttons",
    },
    /** Border width of the buttons in pixels. */
    button_border_width: {
      type: ParameterType.INT,
      pretty_name: "Button Border Width",
      default: 1,
      description: "Border width of the buttons",
    },
    /** Padding inside each button (CSS shorthand, e.g. '8px 16px'). */
    button_padding: {
      type: ParameterType.STRING,
      pretty_name: "Button Padding",
      default: "6px 14px",
      description: "CSS padding shorthand for the button interior",
    },
    /** Width of the entire button group container in pixels. null = auto (max-content). */
    width: {
      type: ParameterType.INT,
      pretty_name: "Width",
      default: null,
      description:
        "Width of the button group container in pixels (null = auto)",
    },
    /** Height of the entire button group container in pixels. null = auto. */
    height: {
      type: ParameterType.INT,
      pretty_name: "Height",
      default: null,
      description:
        "Height of the button group container in pixels (null = auto)",
    },
  },
  data: {
    /** Indicates which button the participant pressed. The first button in the `choices` array is 0, the second is 1, and so on.  */
    response: {
      type: ParameterType.STRING,
    },
    /** The response time in milliseconds for the participant to make a response. The time is measured from when the stimulus first appears on the screen until the participant's response. */
    rt: {
      type: ParameterType.FLOAT,
    },
  },
  // prettier-ignore
  citations: {
    "apa": "de Leeuw, J. R., Gilbert, R. A., & Luchterhandt, B. (2023). jsPsych: Enabling an Open-Source Collaborative Ecosystem of Behavioral Experiments. Journal of Open Source Software, 8(85), 5351. https://doi.org/10.21105/joss.05351 ",
    "bibtex": '@article{Leeuw2023jsPsych, 	author = {de Leeuw, Joshua R. and Gilbert, Rebecca A. and Luchterhandt, Bj{\\" o}rn}, 	journal = {Journal of Open Source Software}, 	doi = {10.21105/joss.05351}, 	issn = {2475-9066}, 	number = {85}, 	year = {2023}, 	month = {may 11}, 	pages = {5351}, 	publisher = {Open Journals}, 	title = {jsPsych: Enabling an {Open}-{Source} {Collaborative} {Ecosystem} of {Behavioral} {Experiments}}, 	url = {https://joss.theoj.org/papers/10.21105/joss.05351}, 	volume = {8}, }  '
  },
};

type Padding = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

type ButtonCell = {
  choice: string;
  index: number;
  x: number;
  y: number;
  width: number;
  height: number;
  isImage: boolean;
};

type ButtonLayout = {
  centerX: number;
  centerY: number;
  width: number;
  height: number;
  rotation: number;
  zIndex: number;
  rows: number;
  columns: number;
  cells: ButtonCell[];
  font: string;
  fontSize: number;
  backgroundColor: string;
  textColor: string;
  borderRadius: number;
  borderColor: string;
  borderWidth: number;
  padding: Padding;
  imageButtonWidth: number;
  imageButtonHeight: number;
};

type ButtonVisualState = "normal" | "disabled" | "validation";

let buttonComponentCounter = 0;

/**
 * ButtonResponseComponent
 *
 * Standard text buttons use retained WebGL textures plus canvas-coordinate
 * hitboxes. Custom HTML and image buttons use the interactive DOM layer.
 */
class ButtonResponseComponent {
  private jsPsych: any;
  private response: string | null;
  private rt: number | null;
  private start_time: number | null;
  private buttonGroupElement: HTMLElement | null;
  private enableTimeout: any;
  private timing: any = null;
  private stage: CanvasStage | null = null;
  private removeDrawable: (() => void) | null = null;
  private drawableId = "";
  private layout: ButtonLayout | null = null;
  private imageSources = new Map<string, CanvasBitmapSource>();
  private buttonsEnabled = true;
  private validationError = false;
  private useDomLayer = false;
  private responseTiming: any = null;
  private responseTimingUnregisters: Array<() => void> = [];
  private componentId: string | null = null;
  private componentName: string | null = null;
  private buttonSpriteIds: Record<ButtonVisualState, string> | null = null;

  static info = info;

  constructor(jsPsych: any) {
    this.jsPsych = jsPsych;
    this.response = null;
    this.rt = null;
    this.start_time = null;
    this.buttonGroupElement = null;
    this.enableTimeout = null;
  }

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

  private getChoices(trial: any): string[] {
    const rawChoices = this.resolveParam(trial.choices, ["Button"]);
    if (Array.isArray(rawChoices)) return rawChoices.map((choice) => String(choice));
    return [String(rawChoices)];
  }

  private getCanvasSize(trial: any) {
    const canvasStyles = this.resolveParam(trial.__canvasStyles, {});
    return {
      width: this.resolveParam(canvasStyles?.width, 1024),
      height: this.resolveParam(canvasStyles?.height, 768),
    };
  }

  private parseCssPx(raw: string | number | null | undefined): number {
    if (raw === null || raw === undefined) return 0;
    if (typeof raw === "number") return Number.isFinite(raw) ? raw : 0;
    const match = String(raw).trim().match(/^(-?\d+(?:\.\d+)?)/);
    return match ? Number(match[1]) : 0;
  }

  private parsePadding(raw: any): Padding {
    const value = String(this.resolveParam(raw, "6px 14px")).trim();
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

  /**
   * Check if a string is an image URL
   */
  private isImageUrl(str: string): boolean {
    if (!str) return false;

    // Check if it's a URL
    try {
      const url = new URL(str);
      const path = url.pathname.toLowerCase();
      // Check for common image extensions
      return /\.(jpg|jpeg|png|gif|bmp|svg|webp)(\?.*)?$/i.test(path);
    } catch {
      // If not a valid URL, check if it's a relative path with image extension
      return /\.(jpg|jpeg|png|gif|bmp|svg|webp)$/i.test(str.toLowerCase());
    }
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

  private createLayout(trial: any): ButtonLayout | null {
    if (!this.stage) return null;

    const measurementCanvas = document.createElement("canvas");
    const measurementCtx = measurementCanvas.getContext("2d");
    if (!measurementCtx) return null;

    const choices = this.getChoices(trial);
    const { width: canvasWidth, height: canvasHeight } = this.getCanvasSize(trial);
    const layoutMode = this.resolveParam(trial.button_layout, "grid");
    const gridRows = this.resolveParam(trial.grid_rows, 1);
    const gridColumns = this.resolveParam(trial.grid_columns, null);
    const numButtons = Math.max(1, choices.length);

    let rows: number;
    let columns: number;
    if (layoutMode === "grid") {
      if (gridRows === null && gridColumns === null) {
        throw new Error(
          "You cannot set `grid_rows` to `null` without providing a value for `grid_columns`.",
        );
      }
      columns =
        gridColumns === null ? Math.ceil(numButtons / gridRows) : Number(gridColumns);
      rows = gridRows === null ? Math.ceil(numButtons / gridColumns) : Number(gridRows);
    } else {
      rows = 1;
      columns = numButtons;
    }

    rows = Math.max(1, rows || 1);
    columns = Math.max(1, columns || 1);

    const padding = this.parsePadding(trial.button_padding);
    const fontSizeVw = this.resolveParam(trial._button_font_size_runtime_vw, null);
    const configuredFontSize = this.resolveParam(trial.button_font_size, null);
    const fontSize =
      configuredFontSize != null
        ? Number(configuredFontSize)
        : fontSizeVw != null
          ? (Number(fontSizeVw) / 100) * canvasWidth
          : 14;
    const font = `${fontSize}px sans-serif`;
    const imageButtonWidth = Number(
      this.resolveParam(trial.image_button_width, 150),
    );
    const imageButtonHeight = Number(
      this.resolveParam(trial.image_button_height, 150),
    );

    measurementCtx.save();
    measurementCtx.font = font;
    const naturalButtonWidth = Math.max(
      80,
      ...choices.map((choice) =>
        this.isImageUrl(choice)
          ? imageButtonWidth + padding.left + padding.right + 10
          : measurementCtx.measureText(choice).width +
            padding.left +
            padding.right +
            2,
      ),
    );
    measurementCtx.restore();

    const naturalButtonHeight = Math.max(
      34,
      fontSize * 1.4 + padding.top + padding.bottom,
      ...choices
        .filter((choice) => this.isImageUrl(choice))
        .map(() => imageButtonHeight + padding.top + padding.bottom + 10),
    );

    const configuredWidth = this.resolveParam(trial.width, null);
    const configuredHeight = this.resolveParam(trial.height, null);
    const groupWidth =
      configuredWidth != null
        ? (Number(configuredWidth) / 100) * canvasWidth
        : naturalButtonWidth * columns;
    const groupHeight =
      configuredHeight != null
        ? (Number(configuredHeight) / 100) * canvasWidth
        : naturalButtonHeight * rows;
    const cellWidth = groupWidth / columns;
    const cellHeight = groupHeight / rows;
    const coordinates = this.resolveParam(trial.coordinates, { x: 0, y: 0 });
    const centerX =
      canvasWidth / 2 + ((coordinates?.x ?? 0) / 100) * (canvasWidth / 2);
    const centerY =
      canvasHeight / 2 - ((coordinates?.y ?? 0) / 100) * (canvasHeight / 2);
    const cells = choices.map((choice, index) => {
      const row = Math.floor(index / columns);
      const col = index % columns;
      return {
        choice,
        index,
        x: -groupWidth / 2 + col * cellWidth,
        y: -groupHeight / 2 + row * cellHeight,
        width: cellWidth,
        height: cellHeight,
        isImage: this.isImageUrl(choice),
      };
    });

    return {
      centerX,
      centerY,
      width: groupWidth,
      height: groupHeight,
      rotation: Number(this.resolveParam(trial.rotation, 0)),
      zIndex: resolveTimingMs(trial.zIndex, 0) ?? 0,
      rows,
      columns,
      cells,
      font,
      fontSize,
      backgroundColor: this.resolveParam(trial.button_color, "#e7e7e7"),
      textColor: this.resolveParam(trial.button_text_color, "#000000"),
      borderRadius: Number(this.resolveParam(trial.button_border_radius, 3)),
      borderColor: this.resolveParam(trial.button_border_color, "#999999"),
      borderWidth: Number(this.resolveParam(trial.button_border_width, 1)),
      padding,
      imageButtonWidth,
      imageButtonHeight,
    };
  }

  private createTransparentButton(cell: ButtonCell): HTMLButtonElement {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.choice = cell.choice;
    button.setAttribute("aria-label", cell.choice || `Choice ${cell.index + 1}`);
    button.style.position = "absolute";
    button.style.left = `${cell.x + this.layout!.width / 2}px`;
    button.style.top = `${cell.y + this.layout!.height / 2}px`;
    button.style.width = `${cell.width}px`;
    button.style.height = `${cell.height}px`;
    button.style.margin = "0";
    button.style.padding = "0";
    button.style.border = "0";
    button.style.background = "transparent";
    button.style.color = "transparent";
    button.style.opacity = "0";
    button.style.cursor = "pointer";
    button.style.pointerEvents = "auto";
    button.addEventListener("click", (event) => {
      this.storeButtonResponse(cell.choice, event);
      if ((this as any).onResponseCallback) {
        (this as any).onResponseCallback();
      }
    });
    this.registerButtonPointerTarget(button, cell.choice);
    return button;
  }

  private registerButtonPointerTarget(button: HTMLElement, choice: string) {
    if (!this.responseTiming?.enabled) return;
    const unregister = this.responseTiming.registerPointerTarget({
      componentId: this.componentId,
      componentName: this.componentName,
      label: choice,
      element: button,
      onResponse: (response: any) => {
        if (!this.buttonsEnabled || response.response_valid !== true) {
          return false;
        }
        this.storeButtonResponse(choice, response.event, response);
      },
    });
    this.responseTimingUnregisters.push(unregister);
  }

  private updateOverlay(layout: ButtonLayout) {
    if (!this.buttonGroupElement) return;

    this.buttonGroupElement.style.left = `${layout.centerX}px`;
    this.buttonGroupElement.style.top = `${layout.centerY}px`;
    this.buttonGroupElement.style.width = `${layout.width}px`;
    this.buttonGroupElement.style.height = `${layout.height}px`;
    this.buttonGroupElement.style.transform = `translate(-50%, -50%) rotate(${layout.rotation}deg)`;
    this.buttonGroupElement.style.zIndex = String(layout.zIndex);
    this.buttonGroupElement.innerHTML = "";

    for (const cell of layout.cells) {
      this.buttonGroupElement.appendChild(this.createTransparentButton(cell));
    }
  }

  private getFittedFont(
    ctx: CanvasRenderingContext2D,
    text: string,
    layout: ButtonLayout,
    width: number,
    height: number,
  ) {
    const maxWidth = Math.max(1, width - layout.padding.left - layout.padding.right);
    const maxHeight = Math.max(1, height - layout.padding.top - layout.padding.bottom);
    let fontSize = Math.max(1, Math.min(layout.fontSize, maxHeight * 0.82));

    for (let attempt = 0; attempt < 8; attempt += 1) {
      ctx.font = `${fontSize}px sans-serif`;
      if (ctx.measureText(text).width <= maxWidth || fontSize <= 4) break;
      fontSize *= Math.max(0.5, maxWidth / Math.max(1, ctx.measureText(text).width));
    }

    return `${Math.max(1, fontSize)}px sans-serif`;
  }

  private drawLayout(
    ctx: CanvasRenderingContext2D,
    layout: ButtonLayout,
    state: {
      buttonsEnabled?: boolean;
      validationError?: boolean;
    } = {},
  ) {
    const buttonsEnabled = state.buttonsEnabled ?? this.buttonsEnabled;
    const validationError = state.validationError ?? this.validationError;

    ctx.save();
    ctx.translate(layout.centerX, layout.centerY);
    ctx.rotate((layout.rotation * Math.PI) / 180);

    for (const cell of layout.cells) {
      const inset = 2;
      const x = cell.x + inset;
      const y = cell.y + inset;
      const width = Math.max(1, cell.width - inset * 2);
      const height = Math.max(1, cell.height - inset * 2);
      const oldAlpha = ctx.globalAlpha;
      ctx.globalAlpha = buttonsEnabled ? 1 : 0.55;

      ctx.fillStyle = layout.backgroundColor;
      this.roundedRectPath(ctx, x, y, width, height, layout.borderRadius);
      ctx.fill();

      if (layout.borderWidth > 0 && !this.isTransparent(layout.borderColor)) {
        ctx.strokeStyle = layout.borderColor;
        ctx.lineWidth = layout.borderWidth;
        this.roundedRectPath(
          ctx,
          x + layout.borderWidth / 2,
          y + layout.borderWidth / 2,
          width - layout.borderWidth,
          height - layout.borderWidth,
          layout.borderRadius,
        );
        ctx.stroke();
      }

      if (cell.isImage) {
        const source = this.imageSources.get(cell.choice);
        if (source) {
          const sourceSize = this.getSourceSize(source);
          if (sourceSize.width <= 0 || sourceSize.height <= 0) {
            ctx.globalAlpha = oldAlpha;
            continue;
          }
          const maxWidth = Math.min(
            layout.imageButtonWidth,
            width - layout.padding.left - layout.padding.right,
          );
          const maxHeight = Math.min(
            layout.imageButtonHeight,
            height - layout.padding.top - layout.padding.bottom,
          );
          const scale = Math.min(
            maxWidth / sourceSize.width,
            maxHeight / sourceSize.height,
            1,
          );
          const imageWidth = sourceSize.width * scale;
          const imageHeight = sourceSize.height * scale;
          ctx.drawImage(
            source,
            x + width / 2 - imageWidth / 2,
            y + height / 2 - imageHeight / 2,
            imageWidth,
            imageHeight,
          );
        }
      } else {
        ctx.font = this.getFittedFont(ctx, cell.choice, layout, width, height);
        ctx.fillStyle = layout.textColor;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(
          cell.choice,
          x + width / 2,
          y + height / 2,
          Math.max(1, width - layout.padding.left - layout.padding.right),
        );
      }

      ctx.globalAlpha = oldAlpha;
    }

    if (validationError) {
      ctx.strokeStyle = "#e74c3c";
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 4]);
      ctx.strokeRect(-layout.width / 2, -layout.height / 2, layout.width, layout.height);
      ctx.setLineDash([]);
    }

    ctx.restore();
  }

  private getRotatedGroupBounds(layout: ButtonLayout) {
    const margin = Math.max(4, layout.borderWidth + 3);
    const halfWidth = layout.width / 2 + margin;
    const halfHeight = layout.height / 2 + margin;
    const radians = (layout.rotation * Math.PI) / 180;
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);
    const corners = [
      { x: -halfWidth, y: -halfHeight },
      { x: halfWidth, y: -halfHeight },
      { x: -halfWidth, y: halfHeight },
      { x: halfWidth, y: halfHeight },
    ].map((point) => ({
      x: layout.centerX + point.x * cos - point.y * sin,
      y: layout.centerY + point.x * sin + point.y * cos,
    }));
    const xs = corners.map((point) => point.x);
    const ys = corners.map((point) => point.y);
    const left = Math.floor(Math.min(...xs));
    const top = Math.floor(Math.min(...ys));
    const right = Math.ceil(Math.max(...xs));
    const bottom = Math.ceil(Math.max(...ys));
    return {
      left,
      top,
      width: Math.max(1, right - left),
      height: Math.max(1, bottom - top),
    };
  }

  private renderLayoutTexture(layout: ButtonLayout, state: ButtonVisualState) {
    const bounds = this.getRotatedGroupBounds(layout);
    const dpr = window.devicePixelRatio || 1;
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.ceil(bounds.width * dpr));
    canvas.height = Math.max(1, Math.ceil(bounds.height * dpr));
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return null;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, bounds.width, bounds.height);
    ctx.translate(-bounds.left, -bounds.top);
    this.drawLayout(ctx, layout, {
      buttonsEnabled: state !== "disabled",
      validationError: state === "validation",
    });
    return { canvas, bounds };
  }

  private updateButtonVisualState() {
    if (!this.stage || !this.buttonSpriteIds) return;
    const visibleState: ButtonVisualState = this.validationError
      ? "validation"
      : this.buttonsEnabled
        ? "normal"
        : "disabled";
    for (const state of Object.keys(this.buttonSpriteIds) as ButtonVisualState[]) {
      this.stage.setDrawableVisibility(
        this.buttonSpriteIds[state],
        state === visibleState,
      );
    }
  }

  private registerButtonCanvasTarget(cell: ButtonCell) {
    if (!this.responseTiming?.enabled || !this.layout) return;
    const layout = this.layout;
    const unregister = this.responseTiming.registerPointerTarget({
      componentId: this.componentId,
      componentName: this.componentName,
      label: cell.choice,
      hitTest: ({ canvasX, canvasY }: { canvasX: number | null; canvasY: number | null }) => {
        if (typeof canvasX !== "number" || typeof canvasY !== "number") {
          return false;
        }
        const radians = (-layout.rotation * Math.PI) / 180;
        const dx = canvasX - layout.centerX;
        const dy = canvasY - layout.centerY;
        const localX = dx * Math.cos(radians) - dy * Math.sin(radians);
        const localY = dx * Math.sin(radians) + dy * Math.cos(radians);
        return (
          localX >= cell.x &&
          localX <= cell.x + cell.width &&
          localY >= cell.y &&
          localY <= cell.y + cell.height
        );
      },
      onResponse: (response: any) => {
        if (!this.buttonsEnabled || response.response_valid !== true) {
          return false;
        }
        this.storeButtonResponse(cell.choice, response.event, response);
      },
    });
    this.responseTimingUnregisters.push(unregister);
  }

  private prepareCanvasButtons(displayElement: HTMLElement, trial: any) {
    const { width: canvasWidth, height: canvasHeight } = this.getCanvasSize(trial);
    const zIndex = resolveTimingMs(trial.zIndex, 0) ?? 0;
    this.stage = getCanvasStage(displayElement, {
      width: canvasWidth,
      height: canvasHeight,
      backgroundColor: "transparent",
      zIndex,
      backend: this.resolveParam(trial.__renderBackend, "webgl-strict"),
      recordGpuTiming: this.resolveParam(trial.__recordGpuTiming, true),
    });

    this.layout = this.createLayout(trial);
    if (!this.layout) return;

    this.removeDrawable?.();
    const removers: Array<() => void> = [];
    const spriteIds = {} as Record<ButtonVisualState, string>;
    const states: ButtonVisualState[] = ["normal", "disabled", "validation"];

    for (const state of states) {
      const texture = this.renderLayoutTexture(this.layout, state);
      if (!texture) continue;
      const textureKey = `${this.drawableId}-${state}-texture`;
      const spriteId = `${this.drawableId}-${state}`;
      this.stage.preloadTexture(textureKey, texture.canvas);
      removers.push(
        this.stage.registerSprite({
          id: spriteId,
          textureKey,
          source: texture.canvas,
          x: texture.bounds.left,
          y: texture.bounds.top,
          width: texture.bounds.width,
          height: texture.bounds.height,
          zIndex,
          visible: state === "normal",
        }),
      );
      spriteIds[state] = spriteId;
    }

    this.buttonSpriteIds = spriteIds;
    this.removeDrawable = () => {
      for (const remove of removers) remove();
    };

    for (const cell of this.layout.cells) {
      this.registerButtonCanvasTarget(cell);
    }
  }

  /**
   * Generate HTML for a button, handling both text and image choices.
   * Style params (button_color, button_text_color, etc.) from `trial` are applied inline.
   */
  private generateButtonHtml(
    choice: string,
    index: number,
    trial: any,
  ): string {
    const bgColor = this.resolveParam(trial.button_color, "#e7e7e7");
    const textColor = this.resolveParam(trial.button_text_color, "#000000");
    const fontSizeVw = this.resolveParam(
      trial._button_font_size_runtime_vw,
      null,
    );
    const fontSize = this.resolveParam(trial.button_font_size, 14);
    const borderRadius = this.resolveParam(trial.button_border_radius, 3);
    const borderColor = this.resolveParam(trial.button_border_color, "#999999");
    const borderWidth = this.resolveParam(trial.button_border_width, 1);
    const padding = this.resolveParam(trial.button_padding, "6px 14px");
    const btnWidth = this.resolveParam(trial.width, null);
    const btnHeight = this.resolveParam(trial.height, null);

    const baseStyleParts = [
      `background-color: ${bgColor}`,
      `color: ${textColor}`,
      `font-size: ${fontSizeVw != null ? `${fontSizeVw}vw` : `${fontSize}px`}`,
      `border-radius: ${borderRadius}px`,
      `border: ${borderWidth}px solid ${borderColor}`,
      `padding: ${padding}`,
      `cursor: pointer`,
    ];
    if (btnWidth != null) baseStyleParts.push(`width: ${btnWidth}vw`);
    if (btnHeight != null) baseStyleParts.push(`min-height: ${btnHeight}vw`);
    baseStyleParts.push(`box-sizing: border-box`, `overflow: hidden`);
    const baseStyle = baseStyleParts.join("; ");

    if (this.isImageUrl(choice)) {
      const width = trial.image_button_width || 150;
      const height = trial.image_button_height || 150;
      return `<button class="jspsych-btn jspsych-btn-image" style="${baseStyle}; padding: 5px;">
        <img src="${choice}" style="width: ${width}px; height: ${height}px; object-fit: cover; display: block; pointer-events: none;" />
      </button>`;
    } else {
      return `<button class="jspsych-btn" style="${baseStyle}">${choice}</button>`;
    }
  }

  private renderDomLayer(
    display_element: HTMLElement,
    trial: any,
    onResponse?: () => void,
  ): void {
    // Helper to map coordinate values
    const mapValue = (value: number): number => {
      if (value < -100) return -50;
      if (value > 100) return 50;
      return value * 0.5;
    };

    // Create button group container with coordinates
    this.buttonGroupElement = document.createElement("div");
    this.buttonGroupElement.id = "jspsych-button-response-component-btngroup";
    this.buttonGroupElement.style.position = "absolute";
    this.buttonGroupElement.style.width = "max-content";

    const coordinates = this.resolveParam(trial.coordinates, { x: 0, y: 0 });
    const xVw = mapValue(coordinates.x);
    const yVh = mapValue(coordinates.y);
    this.buttonGroupElement.style.left = `calc(50% + ${xVw}vw)`;
    this.buttonGroupElement.style.top = `calc(50% - ${yVh}vh)`;

    const rotation = this.resolveParam(trial.rotation, 0);
    this.buttonGroupElement.style.transform = `translate(-50%, -50%) rotate(${rotation}deg)`;

    display_element.appendChild(this.buttonGroupElement);

    const choices = this.getChoices(trial);
    const layoutMode = this.resolveParam(trial.button_layout, "grid");
    if (layoutMode === "grid") {
      this.buttonGroupElement.classList.add("jspsych-btn-group-grid");

      const gridRows = this.resolveParam(trial.grid_rows, 1);
      const gridColumns = this.resolveParam(trial.grid_columns, null);
      if (gridRows === null && gridColumns === null) {
        throw new Error(
          "You cannot set `grid_rows` to `null` without providing a value for `grid_columns`.",
        );
      }

      const n_cols =
        gridColumns === null ? Math.ceil(choices.length / gridRows) : gridColumns;
      const n_rows =
        gridRows === null ? Math.ceil(choices.length / gridColumns) : gridRows;

      this.buttonGroupElement.style.gridTemplateColumns = `repeat(${n_cols}, 1fr)`;
      this.buttonGroupElement.style.gridTemplateRows = `repeat(${n_rows}, 1fr)`;
    } else if (layoutMode === "flex") {
      this.buttonGroupElement.classList.add("jspsych-btn-group-flex");
    }

    const rawButtonHtml = this.resolveParam(trial.button_html, null);
    const buttonHtml =
      typeof rawButtonHtml === "function"
        ? rawButtonHtml
        : (choice: string, choice_index: number) =>
            this.generateButtonHtml(choice, choice_index, trial);

    for (let i = 0; i < choices.length; i++) {
      const choice = choices[i];
      const html = buttonHtml(choice, i);

      this.buttonGroupElement.insertAdjacentHTML("beforeend", html);
      const buttonElement = this.buttonGroupElement.lastChild as HTMLElement;
      buttonElement.dataset.choice = choice;
      buttonElement.addEventListener("click", (event) => {
        this.storeButtonResponse(choice, event);
        if (onResponse) {
          onResponse();
        }
      });
      this.registerButtonPointerTarget(buttonElement, choice);
    }
  }

  /**
   * Render the button group into the display element
   */
  render(
    display_element: HTMLElement,
    trial: any,
    onResponse?: () => void,
  ): HTMLElement | void {
    this.timing = trial.__timing || null;
    this.responseTiming = trial.__responseTiming || null;
    this.componentId = trial.__componentId ?? null;
    this.componentName = trial.name ?? null;
    (this as any).onResponseCallback = onResponse;
    this.drawableId = trial.name
      ? `button-${trial.name}`
      : `button-${++buttonComponentCounter}`;
    this.buttonsEnabled = true;
    this.validationError = false;
    const choices = this.getChoices(trial);
    this.useDomLayer =
      !this.responseTiming?.enabled ||
      typeof this.resolveParam(trial.button_html, null) === "function" ||
      choices.some((choice) => this.isImageUrl(choice));

    if (this.useDomLayer) {
      this.renderDomLayer(display_element, trial, onResponse);
    } else {
      this.prepareCanvasButtons(display_element, trial);
    }

    setResponseStartTime(this, this.timing);

    // Handle enable_button_after delay
    const enableButtonAfter = resolveTimingMs(trial.enable_button_after, 0) ?? 0;
    if (enableButtonAfter > 0) {
      this.disableButtons();
      this.enableTimeout = this.timing
        ? this.timing.scheduleAt(enableButtonAfter, () => this.enableButtons())
        : scheduleFrameEvent(enableButtonAfter, () => this.enableButtons());
    }

    return this.buttonGroupElement ?? undefined;
  }

  /**
   * Record the button response and RT
   */
  private storeButtonResponse(choice: string, event?: Event, timingResponse?: any): void {
    if (this.response !== null) {
      return; // Already responded
    }

    this.rt =
      typeof timingResponse?.rt_raw === "number"
        ? timingResponse.rt_raw
        : getResponseRT(this, this.timing, event);
    this.response = choice;

    // Disable all buttons after response
    this.disableButtons();
  }

  /**
   * Disable all buttons
   */
  private disableButtons(): void {
    this.buttonsEnabled = false;
    this.updateButtonVisualState();

    if (!this.buttonGroupElement) return;
    const buttons = this.buttonGroupElement.querySelectorAll("button");
    buttons.forEach((button) => {
      button.setAttribute("disabled", "disabled");
    });
    this.stage?.render();
  }

  /**
   * Enable all buttons
   */
  private enableButtons(): void {
    this.buttonsEnabled = true;
    this.updateButtonVisualState();

    if (!this.buttonGroupElement) return;
    const buttons = this.buttonGroupElement.querySelectorAll("button");
    buttons.forEach((button) => {
      button.removeAttribute("disabled");
    });
    this.stage?.render();
  }

  /**
   * Get the response (button index)
   */
  getResponse(): string | null {
    return this.response;
  }

  /**
   * Get the response time
   */
  getRT(): number | null {
    return this.rt;
  }

  /** True once a button has been clicked */
  isValid(_trial: any): boolean {
    return this.response !== null;
  }

  /** Highlight the button group to indicate a response is required */
  showValidationError(): void {
    this.validationError = true;
    this.updateButtonVisualState();
    if (this.buttonGroupElement) {
      this.buttonGroupElement.classList.add("jspsych-require-response-error");
    }
    this.stage?.render();
  }

  /** Remove validation error highlight */
  clearValidationError(): void {
    this.validationError = false;
    this.updateButtonVisualState();
    if (this.buttonGroupElement) {
      this.buttonGroupElement.classList.remove(
        "jspsych-require-response-error",
      );
    }
    this.stage?.render();
  }

  /** Reset state so the user can click again after a failed require_response validation */
  reset(): void {
    this.response = null;
    this.rt = null;
    this.enableButtons();
  }

  getRenderedSize(): { width: number; height: number } | null {
    if (this.buttonGroupElement) {
      const rect = this.buttonGroupElement.getBoundingClientRect();
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
   * Cleanup: remove event listeners and timeouts
   */
  destroy(): void {
    for (const unregister of this.responseTimingUnregisters) {
      unregister();
    }
    this.responseTimingUnregisters = [];
    if (this.enableTimeout) {
      if (typeof this.enableTimeout === "function") {
        this.enableTimeout();
      } else {
        window.clearTimeout(this.enableTimeout);
      }
    }

    this.removeDrawable?.();
    this.removeDrawable = null;
    this.buttonSpriteIds = null;
    if (this.buttonGroupElement) {
      this.buttonGroupElement.remove();
    }
    this.stage = null;
    this.layout = null;
    this.imageSources.clear();
  }
}

export default ButtonResponseComponent;
