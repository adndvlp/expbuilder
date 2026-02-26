import { ParameterType } from "jspsych";

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
      description: "Corner radius of the buttons in pixels",
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
      description: "Border width of the buttons in pixels",
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
 * ButtonResponseComponent
 *
 * Component for collecting button responses. Follows the "sketchpad pattern":
 * - Does NOT call finishTrial()
 * - Stores response data internally (this.response, this.rt)
 * - Exposes data via getters (getResponse(), getRT())
 * - Parent plugin orchestrates trial completion
 */
class ButtonResponseComponent {
  private jsPsych: any;
  private response: string | null;
  private rt: number | null;
  private start_time: number | null;
  private buttonGroupElement: HTMLElement | null;
  private enableTimeout: any;

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

  /**
   * Render the button group into the display element
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

    // Create button group container with coordinates
    this.buttonGroupElement = document.createElement("div");
    this.buttonGroupElement.id = "jspsych-button-response-component-btngroup";
    this.buttonGroupElement.style.position = "absolute";
    // Container auto-sizes to fit buttons; per-button width/height is applied in generateButtonHtml
    this.buttonGroupElement.style.width = "max-content";

    // Use default coordinates if not provided
    const coordinates = trial.coordinates || { x: 0, y: 0 };
    const xVw = mapValue(coordinates.x);
    const yVh = mapValue(coordinates.y);
    this.buttonGroupElement.style.left = `calc(50% + ${xVw}vw)`;
    this.buttonGroupElement.style.top = `calc(50% - ${yVh}vh)`;

    // Apply rotation if provided
    const rotation = trial.rotation ?? 0;
    this.buttonGroupElement.style.transform = `translate(-50%, -50%) rotate(${rotation}deg)`;

    display_element.appendChild(this.buttonGroupElement);

    // Configure layout (grid vs flex)
    if (trial.button_layout === "grid") {
      this.buttonGroupElement.classList.add("jspsych-btn-group-grid");

      if (trial.grid_rows === null && trial.grid_columns === null) {
        throw new Error(
          "You cannot set `grid_rows` to `null` without providing a value for `grid_columns`.",
        );
      }

      const n_cols =
        trial.grid_columns === null
          ? Math.ceil(trial.choices.length / trial.grid_rows)
          : trial.grid_columns;
      const n_rows =
        trial.grid_rows === null
          ? Math.ceil(trial.choices.length / trial.grid_columns)
          : trial.grid_rows;

      this.buttonGroupElement.style.gridTemplateColumns = `repeat(${n_cols}, 1fr)`;
      this.buttonGroupElement.style.gridTemplateRows = `repeat(${n_rows}, 1fr)`;
    } else if (trial.button_layout === "flex") {
      this.buttonGroupElement.classList.add("jspsych-btn-group-flex");
    }

    // Create buttons
    // Unwrap button_html in case it arrived as a {source,value} envelope
    const rawButtonHtml = this.resolveParam(trial.button_html, null);
    const buttonHtml =
      typeof rawButtonHtml === "function"
        ? rawButtonHtml
        : (choice: string, choice_index: number) =>
            this.generateButtonHtml(choice, choice_index, trial);

    for (let i = 0; i < trial.choices.length; i++) {
      const choice = trial.choices[i];
      const html = buttonHtml(choice, i);

      this.buttonGroupElement.insertAdjacentHTML("beforeend", html);
      const buttonElement = this.buttonGroupElement.lastChild as HTMLElement;
      buttonElement.dataset.choice = choice;
      buttonElement.addEventListener("click", () => {
        this.recordResponse(choice);
        if (onResponse) {
          onResponse();
        }
      });
    }

    // Start timing
    this.start_time = performance.now();

    // Handle enable_button_after delay
    if (trial.enable_button_after > 0) {
      this.disableButtons();
      this.enableTimeout = this.jsPsych.pluginAPI.setTimeout(() => {
        this.enableButtons();
      }, trial.enable_button_after);
    }
  }

  /**
   * Record the button response and RT
   */
  private recordResponse(choice: string): void {
    if (this.response !== null) {
      return; // Already responded
    }

    const end_time = performance.now();
    this.rt = Math.round(end_time - this.start_time!);
    this.response = choice;

    // Disable all buttons after response
    this.disableButtons();
  }

  /**
   * Disable all buttons
   */
  private disableButtons(): void {
    if (!this.buttonGroupElement) return;

    const buttons = this.buttonGroupElement.querySelectorAll("button");
    buttons.forEach((button) => {
      button.setAttribute("disabled", "disabled");
    });
  }

  /**
   * Enable all buttons
   */
  private enableButtons(): void {
    if (!this.buttonGroupElement) return;

    const buttons = this.buttonGroupElement.querySelectorAll("button");
    buttons.forEach((button) => {
      button.removeAttribute("disabled");
    });
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

  /**
   * Cleanup: remove event listeners and timeouts
   */
  destroy(): void {
    if (this.enableTimeout) {
      this.jsPsych.pluginAPI.clearTimeout(this.enableTimeout);
    }

    if (this.buttonGroupElement) {
      this.buttonGroupElement.remove();
    }
  }
}

export default ButtonResponseComponent;
