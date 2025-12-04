import "survey-js-ui";
import { ParameterType } from "jspsych";
import { Model } from "survey-core";

var version = "4.0.0";

const info = {
  name: "SurveyjsComponent",
  version,
  parameters: {
    name: {
      type: ParameterType.STRING,
      default: undefined,
    },
    /**
     *
     * A SurveyJS-compatible JavaScript object that defines the survey (we refer to this as the survey 'JSON'
     * for consistency with the SurveyJS documentation, but this parameter should be a JSON-compatible
     * JavaScript object rather than a string). If used with the `survey_function` parameter, the survey
     * will initially be constructed with this object and then passed to the `survey_function`. See
     * the [SurveyJS JSON documentation](https://surveyjs.io/form-library/documentation/design-survey/create-a-simple-survey#define-a-static-survey-model-in-json) for more information.
     *
     */
    survey_json: {
      type: ParameterType.OBJECT,
      default: {},
    },
    /**
     *
     * A function that receives a SurveyJS survey object as an argument. If no `survey_json` is specified, then
     * the function receives an empty survey model and must add all pages/elements to it. If a `survey_json`
     * object is provided, then this object forms the basis of the survey model that is passed into the `survey_function`.
     * See the [SurveyJS JavaScript documentation](https://surveyjs.io/form-library/documentation/design-survey/create-a-simple-survey#create-or-change-a-survey-model-dynamically) for more information.
     *
     */
    survey_function: {
      type: ParameterType.FUNCTION,
      default: null,
    },
    /**
     * A function that can be used to validate responses. This function is called whenever the SurveyJS `onValidateQuestion`
     * event occurs. (Note: it is also possible to add this function to the survey using the `survey_function` parameter -
     * we've just added it as a parameter for convenience).
     */
    validation_function: {
      type: ParameterType.FUNCTION,
      default: null,
    },
    /**
     * The minimum width of the survey container. This is applied as a CSS `min-width` property to the survey container element.
     * Note that the width of the survey can also be controlled using SurveyJS parameters within the `survey_json` object (e.g., `widthMode`, `width`, `fitToContainer`).
     */
    min_width: {
      type: ParameterType.STRING,
      default: "min(100vw, 800px)",
    },
    /** Position coordinates for the survey. x and y should be between -1 and 1, mapped to -50vw/vh to 50vw/vh. */
    coordinates: {
      type: ParameterType.OBJECT,
      default: { x: 0, y: 0 },
    },
  },
  data: {
    /** An object containing the response to each question. The object will have a separate key (identifier) for each question. If the `name` parameter is defined for the question (recommended), then the response object will use the value of `name` as the key for each question. If any questions do not have a name parameter, their keys will named automatically, with the first unnamed question recorded as `question1`, the second as `question2`, and so on. The response type will depend on the question type. This will be encoded as a JSON string when data is saved using the `.json()` or `.csv()` functions. */
    response: {
      type: ParameterType.OBJECT,
    },
    /** The response time in milliseconds for the participant to make a response. The time is measured from when the questions first appear on the screen until the participant's response(s) are submitted. */
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
 * SurveyComponent - handles SurveyJS integration
 * Stores response data internally, exposes via getters
 */
class SurveyjsComponent {
  private jsPsych: any;
  private survey: any = null;
  private response: any = {};
  private rt: number = 0;
  private startTime: number = 0;

  constructor(jsPsych: any) {
    this.jsPsych = jsPsych;
  }

  static info = info;

  private createSurveyContainer(parent: HTMLElement, minWidth: string) {
    const container = document.createElement("div");
    container.classList.add("jspsych-survey-container");
    container.style.textAlign = "initial";
    container.style.minWidth = minWidth;
    container.style.overflowY = "auto";
    container.style.overflowX = "auto";
    parent.appendChild(container);
    return container;
  }

  render(display_element: HTMLElement, trial: any, onResponse?: () => void) {
    // Helper to map coordinate values
    const mapValue = (value: number): number => {
      if (value < -1) return -50;
      if (value > 1) return 50;
      return value * 50;
    };

    // Create survey container with coordinates
    const surveyContainer = document.createElement("div");
    surveyContainer.id = "jspsych-survey-surveyjs-container";
    surveyContainer.style.position = "absolute";
    surveyContainer.style.maxHeight = "90vh";
    surveyContainer.style.overflowY = "auto";
    surveyContainer.style.overflowX = "hidden";

    const xVw = mapValue(trial.coordinates.x);
    const yVh = mapValue(trial.coordinates.y);
    surveyContainer.style.left = `calc(50% + ${xVw}vw)`;
    surveyContainer.style.top = `calc(50% + ${yVh}vh)`;
    surveyContainer.style.transform = "translate(-50%, -50%)";

    display_element.appendChild(surveyContainer);

    if (
      JSON.stringify(trial.survey_json) === "{}" &&
      trial.survey_function === null
    ) {
      console.error(
        "Survey plugin warning: you must define the survey using a non-empty JSON object and/or a survey function."
      );
    }

    // Save themeVariables BEFORE creating the model (Model doesn't preserve custom properties)
    const themeVariables = trial.survey_json.themeVariables || {};

    this.survey = new Model(trial.survey_json);
    if (
      trial.survey_function !== null &&
      typeof trial.survey_function === "function"
    ) {
      trial.survey_function(this.survey);
    }

    // Apply theme using the saved themeVariables
    if (Object.keys(themeVariables).length > 0) {
      console.log("Applying theme with variables:", themeVariables);
      this.survey.applyTheme({
        cssVariables: themeVariables,
        themeName: "plain",
        colorPalette: "light",
        isPanelless: false,
      });
    }
    if (
      trial.validation_function &&
      typeof trial.validation_function === "function"
    ) {
      this.survey.onValidateQuestion.add(trial.validation_function);
    }
    this.survey.onComplete.add((sender: any, options: any) => {
      const all_questions = sender.getAllQuestions();
      const data_names = Object.keys(sender.data);
      for (const question of all_questions) {
        if (!data_names.includes(question.name)) {
          sender.mergeData({ [question.name]: question.defaultValue ?? null });
        }
      }
      this.rt = Math.round(performance.now() - this.startTime);
      this.response = sender.data;

      // Call onResponse callback to finish the trial
      if (onResponse && typeof onResponse === "function") {
        onResponse();
      }
    });
    const survey_container = this.createSurveyContainer(
      surveyContainer,
      trial.min_width || "min(100vw, 800px)"
    );
    this.survey.render(survey_container);
    this.startTime = performance.now();
  }

  getResponse() {
    return this.response;
  }

  getRT() {
    return this.rt;
  }

  getSurvey() {
    return this.survey;
  }

  destroy() {
    // Cleanup if needed
  }
}

export { SurveyjsComponent as default };
