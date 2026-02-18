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
    /** Position coordinates for the cloze input. x and y should be between -1 and 1, mapped to -50vw/vh to 50vw/vh. */
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
   * Render the cloze inputs into the display element
   */
  render(
    display_element: HTMLElement,
    trial: any,
    onResponse?: () => void,
  ): void {
    // Helper to map coordinate values
    const mapValue = (value: number): number => {
      if (value < -1) return -50;
      if (value > 1) return 50;
      return value * 50;
    };

    // Parse solutions from text
    this.solutions = this.getSolutions(trial.text, trial.case_sensitivity);

    // Create cloze container with coordinates
    this.clozeContainer = document.createElement("div");
    this.clozeContainer.classList.add("cloze");
    this.clozeContainer.style.position = "absolute";
    this.clozeContainer.style.width = "max-content";

    // Use default coordinates if not provided
    const coordinates = trial.coordinates || { x: 0, y: 0 };
    const xVw = mapValue(coordinates.x);
    const yVh = mapValue(coordinates.y);
    this.clozeContainer.style.left = `calc(50% + ${xVw}vw)`;
    this.clozeContainer.style.top = `calc(50% - ${yVh}vh)`;
    this.clozeContainer.style.transform = "translate(-50%, -50%)";

    // Build cloze HTML with input fields
    let html = "";
    const elements = trial.text.split("%");
    let solution_counter = 0;

    for (let i = 0; i < elements.length; i++) {
      if (i % 2 === 0) {
        html += elements[i];
      } else {
        html += `<input type="text" class="jspsych-input-response" id="input${solution_counter}" value="">`;
        solution_counter++;
      }
    }

    this.inputCount = solution_counter;
    this.clozeContainer.innerHTML = html;
    display_element.appendChild(this.clozeContainer);

    // Store input elements references
    this.inputElements = [];
    for (let i = 0; i < this.inputCount; i++) {
      const input = document.getElementById(`input${i}`) as HTMLInputElement;
      if (input) {
        this.inputElements.push(input);
      }
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
