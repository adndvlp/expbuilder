import { ParameterType } from "jspsych";

var version = "2.2.0";

const info = {
  name: "InputResponseComponent",
  version,
  parameters: {
    name: {
      type: ParameterType.STRING,
      default: undefined,
    },
    /**
     * The cloze text to be displayed. Blanks are indicated by %% signs and automatically replaced by
     * input fields. If there is a correct answer you want the system to check against, it must be typed
     * between the two percentage signs (i.e. % correct solution %). If you would like to input multiple
     * solutions, type a slash between each responses (i.e. %1/2/3%).
     */
    text: {
      type: ParameterType.HTML_STRING,
      default: undefined,
    },
    /**
     * Boolean value indicating if the answers given by participants should be compared
     * against a correct solution given in `text`.
     */
    check_answers: {
      type: ParameterType.BOOL,
      default: false,
    },
    /**
     * Boolean value indicating if blank answers are allowed.
     */
    allow_blanks: {
      type: ParameterType.BOOL,
      default: true,
    },
    /** Boolean value indicating if the solutions checker must be case sensitive. */
    case_sensitivity: {
      type: ParameterType.BOOL,
      default: true,
    },
    /**
    /** Boolean value indicating if the first input field should be focused when the trial starts.
     * Enabled by default, but may be disabled especially if participants are using screen readers.
     */
    autofocus: {
      type: ParameterType.BOOL,
      default: true,
    },
    /** Position coordinates for the input. x and y should be between -1 and 1, mapped to -50vw/vh to 50vw/vh. */
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
    /** Font size of the input text in pixels. */
    input_font_size: {
      type: ParameterType.INT,
      pretty_name: "Font Size",
      default: 14,
      description: "Font size of the input text in pixels",
    },
    /** Text color inside the input (CSS color string). */
    input_font_color: {
      type: ParameterType.STRING,
      pretty_name: "Font Color",
      default: "#000000",
      description: "Text color inside the input field",
    },
    /** CSS font-family for the input. */
    input_font_family: {
      type: ParameterType.STRING,
      pretty_name: "Font Family",
      default: "sans-serif",
      description: "CSS font-family for the input text",
    },
    /** Background color of the input field (CSS color string). */
    input_background_color: {
      type: ParameterType.STRING,
      pretty_name: "Background Color",
      default: "#ffffff",
      description: "Background color of the input field",
    },
    /** Border color of the input field (CSS color string). */
    input_border_color: {
      type: ParameterType.STRING,
      pretty_name: "Border Color",
      default: "#888888",
      description: "Border color of the input field",
    },
    /** Border width of the input field in pixels. */
    input_border_width: {
      type: ParameterType.INT,
      pretty_name: "Border Width",
      default: 1,
      description: "Border width of the input field in pixels",
    },
    /** Border radius of the input field in pixels. */
    input_border_radius: {
      type: ParameterType.INT,
      pretty_name: "Border Radius",
      default: 2,
      description: "Corner radius of the input field in pixels",
    },
    /** Padding inside the input field (CSS shorthand). */
    input_padding: {
      type: ParameterType.STRING,
      pretty_name: "Padding",
      default: "4px 6px",
      description: "CSS padding shorthand for the input field interior",
    },
    /** Placeholder text shown inside the input when empty. */
    placeholder: {
      type: ParameterType.STRING,
      pretty_name: "Placeholder",
      default: "",
      description: "Placeholder text shown inside the input field when empty",
    },
  },
  data: {
    /** Answers the participant gave. */
    response: {
      type: ParameterType.STRING,
      array: true,
    },
    /** The response time in milliseconds for the participant to make a response. The time is measured from when the component is rendered. */
    rt: {
      type: ParameterType.INT,
    },
  },
  // prettier-ignore
  citations: {
    "apa": "de Leeuw, J. R., Gilbert, R. A., & Luchterhandt, B. (2023). jsPsych: Enabling an Open-Source Collaborative Ecosystem of Behavioral Experiments. Journal of Open Source Software, 8(85), 5351. https://doi.org/10.21105/joss.05351 ",
    "bibtex": '@article{Leeuw2023jsPsych, 	author = {de Leeuw, Joshua R. and Gilbert, Rebecca A. and Luchterhandt, Bj{\\" o}rn}, 	journal = {Journal of Open Source Software}, 	doi = {10.21105/joss.05351}, 	issn = {2475-9066}, 	number = {85}, 	year = {2023}, 	month = {may 11}, 	pages = {5351}, 	publisher = {Open Journals}, 	title = {jsPsych: Enabling an {Open}-{Source} {Collaborative} {Ecosystem} of {Behavioral} {Experiments}}, 	url = {https://joss.theoj.org/papers/10.21105/joss.05351}, 	volume = {8}, }  '
  },
};

/**
 * InputResponseComponent
 *
 * Component for collecting cloze/fill-in-the-blank responses. Follows the "sketchpad pattern":
 * - Does NOT call finishTrial()
 * - Stores response data internally (this.response, this.rt)
 * - Exposes data via getters (getResponse(), getRT())
 * - Parent plugin orchestrates trial completion
 */
class InputResponseComponent {
  private jsPsych: any;
  private response: string[] | null;
  private rt: number | null;
  private start_time: number | null;
  private clozeContainer: HTMLElement | null;
  private solutions: string[][];
  private inputCount: number;
  private inputElements: HTMLInputElement[];

  static info = info;

  constructor(jsPsych: any) {
    this.jsPsych = jsPsych;
    this.response = null;
    this.rt = null;
    this.start_time = null;
    this.clozeContainer = null;
    this.solutions = [];
    this.inputCount = 0;
    this.inputElements = [];
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

  /**
   * Render standalone input field(s) into the display element.
   * Only input elements are rendered – no surrounding text.
   */
  render(
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

    // Parse solutions from text (used for answer validation only – not rendered)
    this.solutions = this.getSolutions(trial.text, trial.case_sensitivity);

    // Resolve style params
    const fontSizeVw = this.resolveParam(
      trial._input_font_size_runtime_vw,
      null,
    );
    const fontSize = this.resolveParam(trial.input_font_size, 14);
    const fontColor = this.resolveParam(trial.input_font_color, "#000000");
    const fontFamily = this.resolveParam(trial.input_font_family, "sans-serif");
    const bgColor = this.resolveParam(trial.input_background_color, "#ffffff");
    const borderColor = this.resolveParam(trial.input_border_color, "#888888");
    const borderWidth = this.resolveParam(trial.input_border_width, 1);
    const borderRadius = this.resolveParam(trial.input_border_radius, 2);
    const padding = this.resolveParam(trial.input_padding, "4px 6px");
    const placeholder = this.resolveParam(trial.placeholder, "");

    // Create container anchored at the given coordinates
    this.clozeContainer = document.createElement("div");
    this.clozeContainer.style.position = "absolute";
    this.clozeContainer.style.width = "max-content";

    const coordinates = trial.coordinates || { x: 0, y: 0 };
    const xVw = mapValue(coordinates.x);
    const yVh = mapValue(coordinates.y);
    this.clozeContainer.style.left = `calc(50% + ${xVw}vw)`;
    this.clozeContainer.style.top = `calc(50% - ${yVh}vh)`;
    this.clozeContainer.style.transform = "translate(-50%, -50%)";

    if (trial.zIndex !== undefined) {
      this.clozeContainer.style.zIndex = String(trial.zIndex);
    }

    display_element.appendChild(this.clozeContainer);

    // Create one <input> per solution slot
    this.inputElements = [];
    this.inputCount = this.solutions.length;

    for (let i = 0; i < this.inputCount; i++) {
      const input = document.createElement("input");
      input.type = "text";
      input.id = `input${i}`;
      input.classList.add("jspsych-input-response");
      input.value = "";
      if (placeholder) input.placeholder = placeholder;

      // Apply style params
      input.style.fontSize =
        fontSizeVw != null ? `${fontSizeVw}vw` : `${fontSize}px`;
      input.style.color = fontColor;
      input.style.fontFamily = fontFamily;
      input.style.backgroundColor = bgColor;
      input.style.border = `${borderWidth}px solid ${borderColor}`;
      input.style.borderRadius = `${borderRadius}px`;
      input.style.padding = padding;
      // Width/height driven by the canvas-exported vw values when available
      if (trial.width != null && trial.width > 0) {
        input.style.width = `${trial.width}vw`;
      }
      if (trial.height != null && trial.height > 0) {
        input.style.height = `${trial.height}vw`;
      }
      input.style.boxSizing = "border-box";
      input.style.display = "block";

      this.clozeContainer.appendChild(input);
      this.inputElements.push(input);
    }

    // Autofocus first input if enabled
    if (trial.autofocus && this.inputElements.length > 0) {
      this.inputElements[0].focus();
    }

    // Start timing
    this.start_time = performance.now();
  }

  /**
   * Collect current responses from all input fields
   * Returns null if validation fails, otherwise returns the answers
   */
  private collectCurrentResponse(trial: any): string[] | null {
    const answers: string[] = [];
    let answers_correct = true;
    let answers_filled = true;

    // Collect all answers
    for (let i = 0; i < this.solutions.length; i++) {
      const field = this.inputElements[i];
      if (field) {
        const answer = trial.case_sensitivity
          ? field.value.trim()
          : field.value.toLowerCase().trim();

        answers.push(answer);

        // Check correctness if required
        if (trial.check_answers) {
          if (!this.solutions[i].includes(answer)) {
            field.style.color = "red";
            answers_correct = false;
          } else {
            field.style.color = "black";
          }
        }

        // Check if filled if required
        if (!trial.allow_blanks) {
          if (answer === "") {
            answers_filled = false;
          }
        }
      }
    }

    // Validate responses
    if (
      (trial.check_answers && !answers_correct) ||
      (!trial.allow_blanks && !answers_filled)
    ) {
      return null; // Validation failed
    }

    return answers; // Validation passed
  }

  /**
   * Manually trigger response recording (called externally, e.g., by a button)
   */
  recordResponse(trial: any): boolean {
    if (this.response !== null) {
      return false; // Already responded
    }

    const answers = this.collectCurrentResponse(trial);

    if (answers === null) {
      return false; // Validation failed
    }

    // Record valid response
    const end_time = performance.now();
    this.rt = Math.round(end_time - this.start_time!);
    this.response = answers;

    return true; // Successfully recorded
  }

  /**
   * Parse solutions from cloze text
   */
  private getSolutions(text: string, case_sensitive: boolean): string[][] {
    const solutions: string[][] = [];
    const elements = text.split("%");

    for (let i = 1; i < elements.length; i += 2) {
      solutions.push(
        case_sensitive
          ? elements[i].trim().split("/")
          : elements[i].toLowerCase().trim().split("/"),
      );
    }

    return solutions;
  }

  /**
   * Get the response (array of answers)
   * Returns recorded response, or null if not yet recorded
   */
  getResponse(): string[] | null {
    return this.response;
  }

  /**
   * Get the response time
   */
  getRT(): number | null {
    return this.rt;
  }

  /**
   * Check if response is currently valid (without recording it)
   */
  isValid(trial: any): boolean {
    return this.collectCurrentResponse(trial) !== null;
  }

  /**
   * Cleanup: remove elements from DOM
   */
  destroy(): void {
    if (this.clozeContainer) {
      this.clozeContainer.remove();
    }
    this.inputElements = [];
  }
}

export default InputResponseComponent;
