import { JsPsych, JsPsychPlugin, ParameterType, TrialType } from "jspsych";

const version = "1.0.0";

// Import all component types
import ImageComponent from "./components/ImageComponent";
import VideoComponent from "./components/VideoComponent";
import HtmlComponent from "./components/HtmlComponent";
import AudioComponent from "./components/AudioComponent";

// Import all response components
import ButtonResponseComponent from "./response_components/ButtonResponseComponent";
import SliderResponseComponent from "./response_components/SliderResponseComponent";
import KeyboardResponseComponent from "./response_components/KeyboardResponseComponent";
import InputResponseComponent from "./response_components/InputResponseComponent";
import SurveyComponent from "./components/SurveyComponent";
import SketchpadComponent from "./components/SketchpadComponent";
import AudioResponseComponent from "./response_components/AudioResponseComponent";

const info = <const>{
  name: "DynamicPlugin",
  version: version,
  parameters: {
    /** Array of component configurations for stimulus display */
    components: {
      type: ParameterType.COMPLEX,
      array: true,
      default: [],
    },
    /** Array of response component configurations */
    response_components: {
      type: ParameterType.COMPLEX,
      array: true,
      default: [],
    },
    /** How long to show the stimulus for in milliseconds. If the value is null, then the stimulus will be shown until the participant
     * makes a response. */
    stimuli_duration: {
      type: ParameterType.INT,
      default: null,
    },
    /** How long to wait for the participant to make a response before ending the trial in milliseconds. If the participant
     * fails to make a response before this timer is reached, the participant's response will be recorded as null for the trial
     * and the trial will end. If the value of this parameter is null, then the trial will wait for a response indefinitely. */
    trial_duration: {
      type: ParameterType.INT,
      default: null,
    },
    /** If true, then the trial will end whenever the participant makes a response (assuming they make their response
     * before the cutoff specified by the `trial_duration` parameter). If false, then the trial will continue until the
     * value for `trial_duration` is reached. You can set this parameter to `false` to force the participant to view a
     * stimulus for a fixed amount of time, even if they respond before the time is complete. */
    response_ends_trial: {
      type: ParameterType.BOOL,
      default: true,
    },
  },
  data: {
    /** The response time in milliseconds for the participant to make a response. The time is measured from when the trial
     * starts until the participant's response. */
    rt: {
      type: ParameterType.INT,
    },
  },
};

type Info = typeof info;

// Map component type names to their classes
const COMPONENT_MAP: Record<string, any> = {
  ImageComponent,
  VideoComponent,
  HtmlComponent,
  AudioComponent,
};

const RESPONSE_COMPONENT_MAP: Record<string, any> = {
  ButtonResponseComponent,
  SliderResponseComponent,
  KeyboardResponseComponent,
  InputResponseComponent,
  SurveyComponent,
  SketchpadComponent,
  AudioResponseComponent,
};

/**
 * **DynamicPlugin**
 *
 * Plugin that dynamically renders multiple stimulus components and response components,
 * allowing for complex trial compositions with multiple elements.
 *
 * @author Builder Team
 */
class DynamicPlugin implements JsPsychPlugin<Info> {
  static info = info;

  constructor(private jsPsych: JsPsych) {}

  trial(display_element: HTMLElement, trial: TrialType<Info>) {
    // Inject plugin styles if not already present
    if (!document.getElementById("jspsych-dynamic-plugin-styles")) {
      const styleElement = document.createElement("style");
      styleElement.id = "jspsych-dynamic-plugin-styles";
      styleElement.textContent = `
        #jspsych-dynamic-plugin-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          position: relative;
          width: 100%;
        }
        .dynamic-image-component,
        #jspsych-html-component-main,
        #jspsych-button-response-main {
          visibility: visible !important;
        }
        #jspsych-dynamic-plugin-container img,
        #jspsych-dynamic-plugin-container canvas {
          display: block;
        }
      `;
      document.head.appendChild(styleElement);
    }

    // Create main container for all components
    const mainContainer = document.createElement("div");
    mainContainer.id = "jspsych-dynamic-plugin-container";
    display_element.appendChild(mainContainer);

    // Track start time
    const startTime = performance.now();

    // Store component instances and rendered elements
    const stimulusComponents: any[] = [];
    const responseComponents: any[] = [];
    let hasResponded = false;

    // Instantiate all components first
    const stimulusTypeCounts: Record<string, number> = {};

    if (trial.components && trial.components.length > 0) {
      trial.components.forEach((config: any, idx: number) => {
        const ComponentClass = COMPONENT_MAP[config.type];
        if (ComponentClass) {
          stimulusTypeCounts[config.type] =
            (stimulusTypeCounts[config.type] || 0) + 1;
          if (!config.name) {
            config.name = `${config.type}_${stimulusTypeCounts[config.type]}`;
          }
          const instance = new ComponentClass(this.jsPsych);
          stimulusComponents.push({ instance, config });
        } else {
          console.warn(`Unknown component type: ${config.type}`);
        }
      });
    }

    const responseTypeCounts: Record<string, number> = {};

    if (trial.response_components && trial.response_components.length > 0) {
      trial.response_components.forEach((config: any, idx: number) => {
        const ComponentClass = RESPONSE_COMPONENT_MAP[config.type];
        if (ComponentClass) {
          responseTypeCounts[config.type] =
            (responseTypeCounts[config.type] || 0) + 1;
          if (!config.name) {
            config.name = `${config.type}_${responseTypeCounts[config.type]}`;
          }
          const instance = new ComponentClass(this.jsPsych);
          responseComponents.push({ instance, config });
        } else {
          console.warn(`Unknown response component type: ${config.type}`);
        }
      });
    }

    // Render ALL components in parallel (stimulus and response together)
    // Pass onResponse callback to ALL components so they can end the trial if needed
    stimulusComponents.forEach(({ instance, config }) => {
      instance.render(mainContainer, config, () => {
        if (!hasResponded && trial.response_ends_trial) {
          hasResponded = true;
          endTrial();
        }
      });
    });

    responseComponents.forEach(({ instance, config }) => {
      instance.render(mainContainer, config, () => {
        if (!hasResponded && trial.response_ends_trial) {
          hasResponded = true;
          endTrial();
        }
      });
    });

    // Function to end the trial and collect data
    const endTrial = () => {
      // Calculate response time
      const rt = Math.round(performance.now() - startTime);

      // Create flat data structure (like PsychoPy) instead of nested arrays
      const trialData: any = {
        rt: rt,
      };

      // Add stimulus components data as individual columns
      stimulusComponents.forEach(({ instance, config }) => {
        const prefix = config.name; // Component name (e.g., "ImageComponent_1")

        // Add type
        trialData[`${prefix}_type`] = config.type;

        // Add stimulus if exists
        if (config.stimulus !== undefined) {
          trialData[`${prefix}_stimulus`] = config.stimulus;
        }

        // Add coordinates if exists (stringify for CSV compatibility)
        if (config.coordinates !== undefined) {
          trialData[`${prefix}_coordinates`] = JSON.stringify(
            config.coordinates
          );
        }

        // If component has response (like SurveyComponent)
        if (
          instance.getResponse &&
          typeof instance.getResponse === "function"
        ) {
          const response = instance.getResponse();

          // For SurveyComponent, flatten the response object
          if (
            config.type === "SurveyComponent" &&
            typeof response === "object" &&
            response !== null
          ) {
            // Each question becomes its own column: {componentName}_{questionName}
            Object.keys(response).forEach((questionName) => {
              trialData[`${prefix}_${questionName}`] = response[questionName];
            });
          } else {
            trialData[`${prefix}_response`] = response;
          }

          if (instance.getRT && typeof instance.getRT === "function") {
            trialData[`${prefix}_rt`] = instance.getRT();
          }
        }
      });

      // Add response components data as individual columns
      responseComponents.forEach(({ instance, config }) => {
        const prefix = config.name; // Component name (e.g., "ButtonResponseComponent_1")

        // Add type
        trialData[`${prefix}_type`] = config.type;

        // Add response
        if (
          instance.getResponse &&
          typeof instance.getResponse === "function"
        ) {
          const response = instance.getResponse();
          trialData[`${prefix}_response`] = response;
        }

        // Add RT
        if (instance.getRT && typeof instance.getRT === "function") {
          trialData[`${prefix}_rt`] = instance.getRT();
        }

        // SliderResponseComponent - slider_start
        if (
          config.type === "SliderResponseComponent" &&
          instance.getSliderStart
        ) {
          trialData[`${prefix}_slider_start`] = instance.getSliderStart();
        }

        // SketchpadComponent - strokes and png
        if (config.type === "SketchpadComponent") {
          if (
            instance.getStrokes &&
            typeof instance.getStrokes === "function"
          ) {
            trialData[`${prefix}_strokes`] = JSON.stringify(
              instance.getStrokes()
            );
          }
          if (
            instance.getImageData &&
            typeof instance.getImageData === "function"
          ) {
            trialData[`${prefix}_png`] = instance.getImageData();
          }
        }

        // AudioResponseComponent - special fields
        if (config.type === "AudioResponseComponent") {
          const audioResponse = instance.getResponse
            ? instance.getResponse()
            : null;
          if (audioResponse && typeof audioResponse === "object") {
            trialData[`${prefix}_response`] = audioResponse.response;
            trialData[`${prefix}_audio_url`] = audioResponse.audio_url;
            trialData[`${prefix}_estimated_stimulus_onset`] =
              audioResponse.estimated_stimulus_onset;
          }
        }
      });

      // Clean up components
      stimulusComponents.forEach(({ instance }) => {
        if (instance.destroy) instance.destroy();
      });

      responseComponents.forEach(({ instance }) => {
        if (instance.destroy) instance.destroy();
      });

      // Clear display
      display_element.innerHTML = "";

      // Save trial data
      this.jsPsych.finishTrial(trialData);
    };

    // Handle stimuli duration (hide stimuli after duration)
    if (
      trial.stimuli_duration !== null &&
      trial.stimuli_duration !== undefined
    ) {
      this.jsPsych.pluginAPI.setTimeout(() => {
        stimulusComponents.forEach(({ instance }) => {
          if (instance.hide) {
            instance.hide();
          }
        });
      }, trial.stimuli_duration);
    }

    // Handle trial duration (end trial after duration)
    if (trial.trial_duration !== null && trial.trial_duration !== undefined) {
      this.jsPsych.pluginAPI.setTimeout(() => {
        endTrial();
      }, trial.trial_duration);
    }
  }
}

export default DynamicPlugin;
