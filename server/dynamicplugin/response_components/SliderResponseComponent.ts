import { ParameterType } from "jspsych";

var version = "2.1.1";

const info = {
  name: "SliderResponseComponent",
  version,
  parameters: {
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
    /** Label of the button to advance/submit. */
    button_label: {
      type: ParameterType.STRING,
      default: "Continue",
      array: false,
    },
    /** If true, the participant must move the slider before clicking the continue button. */
    require_movement: {
      type: ParameterType.BOOL,
      default: false,
    },
    /** Position coordinates for the slider. x and y should be between -1 and 1, mapped to -50vw/vh to 50vw/vh. */
    coordinates: {
      type: ParameterType.OBJECT,
      default: { x: 0, y: 0 },
    },
  },
  data: {
    /** The numeric value of the slider. */
    response: {
      type: ParameterType.INT,
    },
    /** The response time in milliseconds for the participant to make a response. The time is measured from when the component is rendered. */
    rt: {
      type: ParameterType.INT,
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

/**
 * SliderResponseComponent
 *
 * Component for collecting slider responses. Follows the "sketchpad pattern":
 * - Does NOT call finishTrial()
 * - Stores response data internally (this.response, this.rt, this.slider_start)
 * - Exposes data via getters (getResponse(), getRT(), getSliderStart())
 * - Parent plugin orchestrates trial completion
 */
class SliderResponseComponent {
  private jsPsych: any;
  private response: number | null;
  private rt: number | null;
  private slider_start: number;
  private start_time: number | null;
  private sliderContainer: HTMLElement | null;
  private sliderElement: HTMLInputElement | null;
  private submitButton: HTMLButtonElement | null;

  static info = info;

  constructor(jsPsych: any) {
    this.jsPsych = jsPsych;
    this.response = null;
    this.rt = null;
    this.slider_start = 50; // Will be set in render()
    this.start_time = null;
    this.sliderContainer = null;
    this.sliderElement = null;
    this.submitButton = null;
  }

  /**
   * Render the slider and submit button into the display element
   */
  render(display_element: HTMLElement, trial: any): void {
    // Helper to map coordinate values
    const mapValue = (value: number): number => {
      if (value < -1) return -50;
      if (value > 1) return 50;
      return value * 50;
    };

    const half_thumb_width = 7.5;

    // Store slider_start for data collection
    this.slider_start = trial.slider_start;

    // Create main container
    const mainContainer = document.createElement("div");
    mainContainer.id = "jspsych-slider-response-main";
    mainContainer.style.position = "relative";
    display_element.appendChild(mainContainer);

    // Create slider container with coordinates
    this.sliderContainer = document.createElement("div");
    this.sliderContainer.classList.add("jspsych-slider-response-container");
    this.sliderContainer.style.position = "relative";
    this.sliderContainer.style.margin = "0 auto 3em auto";

    const xVw = mapValue(trial.coordinates.x);
    const yVh = mapValue(trial.coordinates.y);
    this.sliderContainer.style.left = `${xVw}vw`;
    this.sliderContainer.style.top = `${yVh}vh`;

    if (trial.slider_width !== null) {
      this.sliderContainer.style.width = trial.slider_width.toString() + "px";
    }

    // Build slider HTML
    let html = `<input type="range" class="jspsych-slider" value="${trial.slider_start}" min="${trial.min}" max="${trial.max}" step="${trial.step}" id="jspsych-slider-response-component"></input>`;

    // Add labels if provided
    html += "<div>";
    for (let j = 0; j < trial.labels.length; j++) {
      const label_width_perc = 100 / (trial.labels.length - 1);
      const percent_of_range = j * (100 / (trial.labels.length - 1));
      const percent_dist_from_center = ((percent_of_range - 50) / 50) * 100;
      const offset = (percent_dist_from_center * half_thumb_width) / 100;

      html += `<div style="border: 1px solid transparent; display: inline-block; position: absolute; left:calc(${percent_of_range}% - (${label_width_perc}% / 2) - ${offset}px); text-align: center; width: ${label_width_perc}%;">`;
      html += `<span style="text-align: center; font-size: 80%;">${trial.labels[j]}</span>`;
      html += "</div>";
    }
    html += "</div>";

    this.sliderContainer.innerHTML = html;
    mainContainer.appendChild(this.sliderContainer);

    // Get slider element reference
    this.sliderElement = mainContainer.querySelector(
      "#jspsych-slider-response-component"
    ) as HTMLInputElement;

    // Create submit button
    this.submitButton = document.createElement("button");
    this.submitButton.id = "jspsych-slider-response-component-next";
    this.submitButton.classList.add("jspsych-btn");
    this.submitButton.innerHTML = trial.button_label;
    this.submitButton.disabled = trial.require_movement ? true : false;

    mainContainer.appendChild(this.submitButton);

    // Setup require_movement behavior
    if (trial.require_movement) {
      const enableButton = () => {
        if (this.submitButton) {
          this.submitButton.disabled = false;
        }
      };

      this.sliderElement.addEventListener("mousedown", enableButton);
      this.sliderElement.addEventListener("touchstart", enableButton);
      this.sliderElement.addEventListener("change", enableButton);
    }

    // Setup submit button click handler
    this.submitButton.addEventListener("click", () => {
      this.recordResponse();
    });

    // Start timing
    this.start_time = performance.now();
  }

  /**
   * Record the slider response and RT
   */
  private recordResponse(): void {
    if (this.response !== null) {
      return; // Already responded
    }

    const end_time = performance.now();
    this.rt = Math.round(end_time - this.start_time!);
    this.response = this.sliderElement!.valueAsNumber;

    // Disable button after response
    if (this.submitButton) {
      this.submitButton.disabled = true;
    }
  }

  /**
   * Get the response (slider value)
   */
  getResponse(): number | null {
    return this.response;
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

  /**
   * Cleanup: remove elements from DOM
   */
  destroy(): void {
    if (this.sliderContainer) {
      this.sliderContainer.remove();
    }

    if (this.submitButton) {
      this.submitButton.remove();
    }
  }
}

export default SliderResponseComponent;
