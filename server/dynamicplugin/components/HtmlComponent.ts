import { ParameterType } from "jspsych";

var version = "2.1.0";

const info = {
  name: "HtmlComponent",
  version,
  parameters: {
    /** The HTML content to be displayed. */
    stimulus_html: {
      type: ParameterType.HTML_STRING,
      default: void 0,
    },
    /** Position coordinates for the HTML content. x and y should be between -1 and 1, mapped to -50vw/vh to 50vw/vh. */
    coordinates: {
      type: ParameterType.OBJECT,
      default: { x: 0, y: 0 },
    },
  },
  // prettier-ignore
  citations: {
    "apa": "de Leeuw, J. R., Gilbert, R. A., & Luchterhandt, B. (2023). jsPsych: Enabling an Open-Source Collaborative Ecosystem of Behavioral Experiments. Journal of Open Source Software, 8(85), 5351. https://doi.org/10.21105/joss.05351 ",
    "bibtex": '@article{Leeuw2023jsPsych, 	author = {de Leeuw, Joshua R. and Gilbert, Rebecca A. and Luchterhandt, Bj{\\" o}rn}, 	journal = {Journal of Open Source Software}, 	doi = {10.21105/joss.05351}, 	issn = {2475-9066}, 	number = {85}, 	year = {2023}, 	month = {may 11}, 	pages = {5351}, 	publisher = {Open Journals}, 	title = {jsPsych: Enabling an {Open}-{Source} {Collaborative} {Ecosystem} of {Behavioral} {Experiments}}, 	url = {https://joss.theoj.org/papers/10.21105/joss.05351}, 	volume = {8}, }  '
  },
};

/**
 * HtmlComponent - Renders HTML content stimulus
 * This component only handles HTML display, not responses
 */
class HtmlComponent {
  private jsPsych: any;
  private stimulusElement: HTMLElement | null = null;

  constructor(jsPsych: any) {
    this.jsPsych = jsPsych;
  }

  static info = info;

  /**
   * Render the HTML content
   * @param container - The HTML element to render into
   * @param config - Configuration for the HTML content
   * @returns The rendered stimulus element
   */
  render(container: HTMLElement, config: any): HTMLElement {
    // Helper to map coordinate values
    const mapValue = (value: number): number => {
      if (value < -1) return -50;
      if (value > 1) return 50;
      return value * 50;
    };

    // Create main container
    const mainContainer = document.createElement("div");
    mainContainer.id = "jspsych-html-component-main";
    mainContainer.style.position = "relative";
    container.appendChild(mainContainer);

    // Create stimulus container with coordinates
    const stimulusElement = document.createElement("div");
    stimulusElement.id = "jspsych-dynamic-html-component-stimulus";
    stimulusElement.className = "dynamic-html-component-stimulus";
    stimulusElement.style.position = "relative";

    const xVw = mapValue(config.coordinates.x);
    const yVh = mapValue(config.coordinates.y);
    stimulusElement.style.left = `${xVw}vw`;
    stimulusElement.style.top = `${yVh}vh`;

    stimulusElement.innerHTML = config.stimulus_html;
    mainContainer.appendChild(stimulusElement);
    this.stimulusElement = stimulusElement;

    return stimulusElement;
  }

  /**
   * Hide the HTML stimulus
   */
  hide() {
    if (this.stimulusElement) {
      this.stimulusElement.style.visibility = "hidden";
    }
  }

  /**
   * Show the HTML stimulus (if it was hidden)
   */
  show() {
    if (this.stimulusElement) {
      this.stimulusElement.style.visibility = "visible";
    }
  }

  /**
   * Remove the HTML content from DOM and clean up
   */
  destroy() {
    if (this.stimulusElement && this.stimulusElement.parentNode) {
      this.stimulusElement.parentNode.removeChild(this.stimulusElement);
    }
    this.stimulusElement = null;
  }

  /**
   * Get the rendered stimulus element
   */
  getElement(): HTMLElement | null {
    return this.stimulusElement;
  }

  /**
   * Get the HTML content that was displayed
   */
  getStimulus(): string {
    return this.stimulusElement ? this.stimulusElement.innerHTML : "";
  }
}

export default HtmlComponent;
