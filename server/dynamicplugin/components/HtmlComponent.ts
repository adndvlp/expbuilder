import { ParameterType } from "jspsych";
import { scheduleStimulusVisibility } from "../utils/PrecisionTiming";

var version = "2.1.0";

const info = {
  name: "HtmlComponent",
  version,
  parameters: {
    name: {
      type: ParameterType.STRING,
      default: undefined,
    },
    /** The HTML content to be displayed. */
    stimulus: {
      type: ParameterType.HTML_STRING,
      default: void 0,
    },
    /** Position coordinates for the HTML content. x and y should be between -1 and 1, mapped to -50vw/vh to 50vw/vh. */
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
    /** Box width as a percentage of the canvas width (vw units). When unset the box hugs its content, capped to the canvas. */
    width: {
      type: ParameterType.FLOAT,
      default: null,
      pretty_name: "Width",
    },
    /** Minimum box height as a percentage of the canvas width. Content can grow past it. */
    height: {
      type: ParameterType.FLOAT,
      default: null,
      pretty_name: "Height",
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
  private cancelVisibilitySchedule: (() => void) | null = null;
  private lastStimulus = "";

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
      if (value < -100) return -50;
      if (value > 100) return 50;
      return value * 0.5;
    };

    // Create stimulus element with coordinates
    const stimulusElement = document.createElement("div");
    stimulusElement.id = config.name
      ? `jspsych-dynamic-${config.name}-stimulus`
      : "jspsych-dynamic-html-stimulus";
    stimulusElement.className = "dynamic-html-component-stimulus";
    stimulusElement.style.position = "absolute";
    stimulusElement.style.zIndex = String(config.zIndex ?? 0);

    // Size: honor an explicit design box (width/height arrive as vw
    // percentages of the canvas width). Without one, hug the content but
    // never exceed the canvas — long unbroken text used to spill out of it.
    const canvasWidth = Number(config.__canvasStyles?.width) || 1024;
    const explicitWidth = Number(config.width);
    const explicitHeight = Number(config.height);
    const hasExplicitWidth =
      Number.isFinite(explicitWidth) && explicitWidth > 0;
    const hasExplicitHeight =
      Number.isFinite(explicitHeight) && explicitHeight > 0;

    if (hasExplicitWidth) {
      stimulusElement.style.width = `${(explicitWidth / 100) * canvasWidth}px`;
    } else {
      stimulusElement.style.width = "max-content";
      stimulusElement.style.maxWidth = `${canvasWidth}px`;
    }
    if (hasExplicitHeight) {
      stimulusElement.style.minHeight = `${(explicitHeight / 100) * canvasWidth}px`;
    }
    // Wrap long words inside the (capped or explicit) box instead of letting
    // them widen it past the canvas.
    stimulusElement.style.overflowWrap = "break-word";

    const xVw = mapValue(config.coordinates.x);
    const yVh = mapValue(config.coordinates.y);
    stimulusElement.style.left = `calc(50% + ${xVw}vw)`;
    stimulusElement.style.top = `calc(50% - ${yVh}vh)`;
    stimulusElement.style.transform = "translate(-50%, -50%)";

    // Isolate the pasted markup inside a shadow root: its <style> rules and
    // classes must not leak into the experiment page. Leaked CSS could
    // disable gestures (e.g. block pinch zoom) or restyle other components.
    const html = String(config.stimulus ?? "");
    this.lastStimulus = html;
    if (typeof stimulusElement.attachShadow === "function") {
      const shadowRoot = stimulusElement.attachShadow({ mode: "open" });
      shadowRoot.innerHTML = html;
    } else {
      // Extremely old engines without shadow DOM: best effort.
      stimulusElement.innerHTML = html;
    }
    container.appendChild(stimulusElement);
    this.stimulusElement = stimulusElement;

    this.cancelVisibilitySchedule = scheduleStimulusVisibility(
      stimulusElement,
      config,
      config.__timing,
    );

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
    if (this.cancelVisibilitySchedule) this.cancelVisibilitySchedule();
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
    return this.lastStimulus;
  }
}

export default HtmlComponent;
