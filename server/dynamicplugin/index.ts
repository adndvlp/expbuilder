import { JsPsych, JsPsychPlugin, ParameterType, TrialType } from "jspsych";

import { version } from "../package.json";

// Import all component types
import ImageComponent from "./components/ImageComponent";
import VideoComponent from "./components/VideoComponent";
import HtmlComponent from "./components/HtmlComponent";
import AudioComponent from "./components/AudioComponent";
import SketchpadComponent from "./components/SketchpadComponent";

// Import all survey components
import SurveyComponent from "./components/SurveyComponent";
import SurveyHtmlComponent from "./components/SurveyHtmlComponent";
import SurveyLikertComponent from "./components/SurveyLikertComponent";
import SurveyTextComponent from "./components/SurveyTextComponent";
import SurveyMultiChoiceComponent from "./components/SurveyMultiChoiceComponent";
import SurveyMultiSelectComponent from "./components/SurveyMultiSelectComponent";

// Import all response components
import ButtonResponseComponent from "./response_components/ButtonResponseComponent";
import SliderResponseComponent from "./response_components/SliderResponseComponent";
import KeyboardResponseComponent from "./response_components/KeyboardResponseComponent";

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
    /** Array of stimulus information from components */
    stimulus: {
      type: ParameterType.COMPLEX,
      array: true,
    },
    /** Response data from response components */
    response: {
      type: ParameterType.COMPLEX,
    },
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
  SketchpadComponent,
  SurveyComponent,
  SurveyHtmlComponent,
  SurveyLikertComponent,
  SurveyTextComponent,
  SurveyMultiChoiceComponent,
  SurveyMultiSelectComponent,
};

const RESPONSE_COMPONENT_MAP: Record<string, any> = {
  ButtonResponseComponent,
  SliderResponseComponent,
  KeyboardResponseComponent,
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
    if (trial.components && trial.components.length > 0) {
      trial.components.forEach((config: any) => {
        const ComponentClass = COMPONENT_MAP[config.type];
        if (ComponentClass) {
          const instance = new ComponentClass(this.jsPsych);
          stimulusComponents.push({ instance, config });
        } else {
          console.warn(`Unknown component type: ${config.type}`);
        }
      });
    }

    if (trial.response_components && trial.response_components.length > 0) {
      trial.response_components.forEach((config: any) => {
        const ComponentClass = RESPONSE_COMPONENT_MAP[config.type];
        if (ComponentClass) {
          const instance = new ComponentClass(this.jsPsych);
          responseComponents.push({ instance, config });
        } else {
          console.warn(`Unknown response component type: ${config.type}`);
        }
      });
    }

    // Render ALL components in parallel (stimulus and response together)
    stimulusComponents.forEach(({ instance, config }) => {
      instance.render(mainContainer, config);
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

      // Collect response data from response components
      const responseData: any = {};
      responseComponents.forEach(({ instance, config }, index) => {
        const componentResponse: any = {
          type: config.type,
          response: instance.getResponse ? instance.getResponse() : null,
          rt: instance.getRT ? instance.getRT() : null,
        };

        // Add additional data for specific components
        if (
          config.type === "SliderResponseComponent" &&
          instance.getSliderStart
        ) {
          componentResponse.slider_start = instance.getSliderStart();
        }

        responseData[`response_${index}`] = componentResponse;
      });

      // Collect stimulus information
      const stimulusData: any[] = [];
      stimulusComponents.forEach(({ config }) => {
        const stimInfo: any = {
          type: config.type,
        };

        // Add relevant stimulus information
        if (config.stimulus) stimInfo.stimulus = config.stimulus;
        if (config.coordinates) stimInfo.coordinates = config.coordinates;

        stimulusData.push(stimInfo);
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
      const trialData = {
        stimulus: stimulusData,
        response: responseData,
        rt: rt,
      };

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
