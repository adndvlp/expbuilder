import { ParameterType } from "jspsych";

var version = "1.0.0";

const info = {
  name: "TextComponent",
  version,
  parameters: {
    name: {
      type: ParameterType.STRING,
      default: undefined,
    },
    /** The text content to display. Supports basic HTML entities but renders as plain text by default. */
    text: {
      type: ParameterType.STRING,
      pretty_name: "Text",
      default: "Text",
      description: "The text content to display",
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
  },
  data: {},
  citations: {
    apa: "de Leeuw, J. R., Gilbert, R. A., & Luchterhandt, B. (2023). jsPsych: Enabling an Open-Source Collaborative Ecosystem of Behavioral Experiments. Journal of Open Source Software, 8(85), 5351. https://doi.org/10.21105/joss.05351 ",
    bibtex:
      "@article{Leeuw2023jsPsych, author = {de Leeuw, Joshua R. and Gilbert, Rebecca A. and Luchterhandt, Björn}, journal = {Journal of Open Source Software}, doi = {10.21105/joss.05351}, issn = {2475-9066}, number = {85}, year = {2023}, month = {may 11}, pages = {5351}, publisher = {Open Journals}, title = {jsPsych: Enabling an {Open}-{Source} {Collaborative} {Ecosystem} of {Behavioral} {Experiments}}, url = {https://joss.theoj.org/papers/10.21105/joss.05351}, volume = {8}, }  ",
  },
};

/**
 * TextComponent - Renders a styled text block at a given position.
 * Supports coordinates, rotation, and full style customisation.
 */
class TextComponent {
  private jsPsych: any;
  private element: HTMLElement | null = null;

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

  render(container: HTMLElement, config: any): HTMLElement {
    const mapValue = (value: number): number => {
      if (value < -100) return -50;
      if (value > 100) return 50;
      return value * 0.5;
    };

    // Resolve all params
    const text = this.resolveParam(config.text, "Text");
    const fontColor = this.resolveParam(config.font_color, "#000000");
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
    this.element.style.fontSize = `${fontSize}px`;
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
    this.element.style.whiteSpace = width != null ? "pre-wrap" : "pre";
    this.element.style.boxSizing = "border-box";

    this.element.textContent = text;
    container.appendChild(this.element);
    return this.element;
  }

  hide(): void {
    if (this.element) this.element.style.visibility = "hidden";
  }

  show(): void {
    if (this.element) this.element.style.visibility = "visible";
  }

  destroy(): void {
    if (this.element && this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
    this.element = null;
  }
}

export default TextComponent;
