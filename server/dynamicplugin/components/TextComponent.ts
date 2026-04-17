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
      type: ParameterType.INT,
    },
  },
  citations: {
    apa: "de Leeuw, J. R., Gilbert, R. A., & Luchterhandt, B. (2023). jsPsych: Enabling an Open-Source Collaborative Ecosystem of Behavioral Experiments. Journal of Open Source Software, 8(85), 5351. https://doi.org/10.21105/joss.05351 ",
    bibtex:
      "@article{Leeuw2023jsPsych, author = {de Leeuw, Joshua R. and Gilbert, Rebecca A. and Luchterhandt, Björn}, journal = {Journal of Open Source Software}, doi = {10.21105/joss.05351}, issn = {2475-9066}, number = {85}, year = {2023}, month = {may 11}, pages = {5351}, publisher = {Open Journals}, title = {jsPsych: Enabling an {Open}-{Source} {Collaborative} {Ecosystem} of {Behavioral} {Experiments}}, url = {https://joss.theoj.org/papers/10.21105/joss.05351}, volume = {8}, }  ",
  },
};

/**
 * TextComponent - Renders a styled text block at a given position.
 * Supports coordinates, rotation, and full style customisation.
 *
 * Cloze mode: when the `text` parameter contains %% markers the component
 * automatically embeds inline `<input>` fields and records participant answers,
 * following the same "sketchpad pattern" used by response components
 * (no finishTrial – data exposed via getResponse() / getRT()).
 */
class TextComponent {
  private jsPsych: any;
  private element: HTMLElement | null = null;
  private onsetTimeout: number | null = null;
  private hideTimeout: number | null = null;

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

  render(container: HTMLElement, config: any): HTMLElement {
    const mapValue = (value: number): number => {
      if (value < -100) return -50;
      if (value > 100) return 50;
      return value * 0.5;
    };

    // Resolve all params
    const text = this.resolveParam(config.text, "Text");
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

    // Detect cloze mode: text must have at least one %...% pair
    const parts = text.split("%");
    this.isClozeMode = parts.length >= 3 && parts.length % 2 === 1;

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
    this.element.style.boxSizing = "border-box";

    if (this.isClozeMode) {
      // nowrap keeps text and inline inputs on the same line
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

      // Start timing
      this.start_time = performance.now();
    } else {
      // ── Plain text mode (original behaviour) ─────────────────────────────
      this.element.style.whiteSpace = width != null ? "pre-wrap" : "pre";
      this.element.textContent = text;
      container.appendChild(this.element);
    }

    const stimulusOnset = this.resolveParam(config.stimulus_onset, null);
    const stimulusDuration = this.resolveParam(config.stimulus_duration, null);

    if (stimulusOnset !== null) {
      this.element.style.visibility = "hidden";
      this.onsetTimeout = this.jsPsych.pluginAPI.setTimeout(() => {
        if (this.element) this.element.style.visibility = "visible";
      }, stimulusOnset);
    }
    if (stimulusDuration !== null) {
      const hideAt = (stimulusOnset ?? 0) + stimulusDuration;
      this.hideTimeout = this.jsPsych.pluginAPI.setTimeout(() => {
        this.hide();
      }, hideAt);
    }

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

    this.rt = Math.round(performance.now() - this.start_time!);
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
    if (this.element) this.element.style.visibility = "hidden";
  }

  show(): void {
    if (this.element) this.element.style.visibility = "visible";
  }

  destroy(): void {
    if (this.onsetTimeout !== null) {
      clearTimeout(this.onsetTimeout);
    }
    if (this.hideTimeout !== null) {
      clearTimeout(this.hideTimeout);
    }
    if (this.element && this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
    this.element = null;
  }
}

export default TextComponent;
