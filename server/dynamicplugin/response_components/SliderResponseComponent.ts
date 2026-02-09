import { ParameterType } from "jspsych";

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
  private hasMoved: boolean;

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

  /**
   * Render the slider and submit button into the display element
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

    const half_thumb_width = 7.5;

    // Store slider_start for data collection
    this.slider_start = trial.slider_start;

    // Create slider container with coordinates
    this.sliderContainer = document.createElement("div");
    this.sliderContainer.classList.add("jspsych-slider-response-container");
    this.sliderContainer.style.position = "absolute";
    this.sliderContainer.style.margin = "0 auto 0 auto";

    // Use default coordinates if not provided
    const coordinates = trial.coordinates || { x: 0, y: 0 };
    const xVw = mapValue(coordinates.x);
    const yVh = mapValue(coordinates.y);
    this.sliderContainer.style.left = `calc(50% + ${xVw}vw)`;
    this.sliderContainer.style.top = `calc(50% + ${yVh}vh)`;
    this.sliderContainer.style.transform = "translate(-50%, -50%)";

    display_element.appendChild(this.sliderContainer);

    if (trial.slider_width !== null && trial.slider_width !== undefined) {
      this.sliderContainer.style.width = trial.slider_width + "px";
    }

    // Build slider HTML
    let html = `<input type="range" class="jspsych-slider" value="${trial.slider_start}" min="${trial.min}" max="${trial.max}" step="${trial.step}" id="jspsych-slider-response-component"></input>`;

    // Add labels if provided
    html += `<div style="margin-bottom: 2em">`;
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

    // Get slider element reference
    this.sliderElement = this.sliderContainer.querySelector(
      "#jspsych-slider-response-component",
    ) as HTMLInputElement;

    // Track movement if required
    if (trial.require_movement) {
      const trackMovement = () => {
        this.hasMoved = true;
      };

      this.sliderElement.addEventListener("mousedown", trackMovement);
      this.sliderElement.addEventListener("touchstart", trackMovement);
      this.sliderElement.addEventListener("change", trackMovement);
      this.sliderElement.addEventListener("input", trackMovement);
    } else {
      this.hasMoved = true; // Not required, so always valid
    }

    // Start timing
    this.start_time = performance.now();
  }

  /**
   * Record the slider response and RT (called externally, e.g., by a button)
   */
  recordResponse(trial: any): boolean {
    if (this.response !== null) {
      return false; // Already responded
    }

    // Check if movement is required but hasn't happened
    if (trial.require_movement && !this.hasMoved) {
      return false; // Can't record yet
    }

    const end_time = performance.now();
    this.rt = Math.round(end_time - this.start_time!);
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
    if (trial.require_movement && !this.hasMoved) {
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

  /**
   * Cleanup: remove elements from DOM
   */
  destroy(): void {
    if (this.sliderContainer) {
      this.sliderContainer.remove();
    }
  }
}

export default SliderResponseComponent;
