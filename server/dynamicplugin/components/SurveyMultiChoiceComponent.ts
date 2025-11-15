import { ParameterType } from "jspsych";

var version = "2.1.0";

const info = {
  name: "SurveyMultiChoiceComponent",
  version,
  parameters: {
    /**
     * An array of objects, each object represents a question that appears on the screen. Each object contains a prompt,
     * options, required, and horizontal parameter that will be applied to the question. See examples below for further
     * clarification.`prompt`: Type string, default value is *undefined*. The string is prompt/question that will be
     * associated with a group of options (radio buttons). All questions will get presented on the same page (trial).
     * `options`: Type array, defualt value is *undefined*. An array of strings. The array contains a set of options to
     * display for an individual question.`required`: Type boolean, default value is null. The boolean value indicates
     * if a question is required('true') or not ('false'), using the HTML5 `required` attribute. If this parameter is
     * undefined, the question will be optional. `horizontal`:Type boolean, default value is false. If true, then the
     * question is centered and the options are displayed horizontally. `name`: Name of the question. Used for storing
     * data. If left undefined then default names (`Q0`, `Q1`, `...`) will be used for the questions.
     */
    questions: {
      type: ParameterType.COMPLEX,
      array: true,
      nested: {
        /** Question prompt. */
        prompt: {
          type: ParameterType.HTML_STRING,
          default: void 0,
        },
        /** Array of multiple choice options for this question. */
        options: {
          type: ParameterType.STRING,
          array: true,
          default: void 0,
        },
        /** Whether or not a response to this question must be given in order to continue. */
        required: {
          type: ParameterType.BOOL,
          default: false,
        },
        /** If true, then the question will be centered and options will be displayed horizontally. */
        horizontal: {
          type: ParameterType.BOOL,
          default: false,
        },
        /** Name of the question in the trial data. If no name is given, the questions are named Q0, Q1, etc. */
        name: {
          type: ParameterType.STRING,
          default: "",
        },
      },
    },
    /**
     * If true, the display order of `questions` is randomly determined at the start of the trial. In the data object,
     * `Q0` will still refer to the first question in the array, regardless of where it was presented visually.
     */
    randomize_question_order: {
      type: ParameterType.BOOL,
      default: false,
    },
    /** HTML formatted string to display at the top of the page above all the questions. */
    preamble: {
      type: ParameterType.HTML_STRING,
      default: null,
    },
    /** Label of the button. */
    button_label: {
      type: ParameterType.STRING,
      default: "Continue",
    },
    /**
     * This determines whether or not all of the input elements on the page should allow autocomplete. Setting
     * this to true will enable autocomplete or auto-fill for the form.
     */
    autocomplete: {
      type: ParameterType.BOOL,
      default: false,
    },
    /** Position coordinates for the survey. x and y should be between -1 and 1, mapped to -50vw/vh to 50vw/vh. */
    coordinates: {
      type: ParameterType.OBJECT,
      default: { x: 0, y: 0 },
    },
  },
  data: {
    /** An object containing the response for each question. The object will have a separate key (variable) for each question, with the first question in the trial being recorded in `Q0`, the second in `Q1`, and so on. The responses are recorded as integers, representing the position selected on the likert scale for that question. If the `name` parameter is defined for the question, then the response object will use the value of `name` as the key for each question. This will be encoded as a JSON string when data is saved using the `.json()` or `.csv()` functions. */
    response: {
      type: ParameterType.OBJECT,
    },
    /** The response time in milliseconds for the participant to make a response. The time is measured from when the questions first appear on the screen until the participant's response(s) are submitted. */
    rt: {
      type: ParameterType.INT,
    },
    /** An array with the order of questions. For example `[2,0,1]` would indicate that the first question was `trial.questions[2]` (the third item in the `questions` parameter), the second question was `trial.questions[0]`, and the final question was `trial.questions[1]`. This will be encoded as a JSON string when data is saved using the `.json()` or `.csv()` functions. */
    question_order: {
      type: ParameterType.INT,
      array: true,
    },
  },
  // prettier-ignore
  citations: {
    "apa": "de Leeuw, J. R., Gilbert, R. A., & Luchterhandt, B. (2023). jsPsych: Enabling an Open-Source Collaborative Ecosystem of Behavioral Experiments. Journal of Open Source Software, 8(85), 5351. https://doi.org/10.21105/joss.05351 ",
    "bibtex": '@article{Leeuw2023jsPsych, 	author = {de Leeuw, Joshua R. and Gilbert, Rebecca A. and Luchterhandt, Bj{\\" o}rn}, 	journal = {Journal of Open Source Software}, 	doi = {10.21105/joss.05351}, 	issn = {2475-9066}, 	number = {85}, 	year = {2023}, 	month = {may 11}, 	pages = {5351}, 	publisher = {Open Journals}, 	title = {jsPsych: Enabling an {Open}-{Source} {Collaborative} {Ecosystem} of {Behavioral} {Experiments}}, 	url = {https://joss.theoj.org/papers/10.21105/joss.05351}, 	volume = {8}, }  '
  },
};

const plugin_id_name = "jspsych-survey-multi-choice";

/**
 * SurveyMultiChoiceComponent - handles multiple choice surveys with radio buttons
 * Stores response data internally, exposes via getters
 */
class SurveyMultiChoiceComponent {
  private jsPsych: any;
  private response: any = {};
  private rt: number = 0;
  private startTime: number = 0;
  private question_order: number[] = [];

  constructor(jsPsych: any) {
    this.jsPsych = jsPsych;
  }

  static info = info;

  render(display_element: HTMLElement, trial: any) {
    // Helper to map coordinate values
    const mapValue = (value: number): number => {
      if (value < -1) return -50;
      if (value > 1) return 50;
      return value * 50;
    };

    // Create main container
    const mainContainer = document.createElement("div");
    mainContainer.id = "jspsych-survey-multi-choice-main";
    mainContainer.style.position = "relative";
    display_element.appendChild(mainContainer);

    // Create survey container with coordinates
    const surveyContainer = document.createElement("div");
    surveyContainer.id = "jspsych-survey-multi-choice-container";
    surveyContainer.style.position = "relative";

    const xVw = mapValue(trial.coordinates.x);
    const yVh = mapValue(trial.coordinates.y);
    surveyContainer.style.left = `${xVw}vw`;
    surveyContainer.style.top = `${yVh}vh`;

    mainContainer.appendChild(surveyContainer);

    const trial_form_id = `${plugin_id_name}_form`;
    var html = "";
    html += `
    <style id="${plugin_id_name}-css">
      .${plugin_id_name}-question { margin-top: 2em; margin-bottom: 2em; text-align: left; }
      .${plugin_id_name}-text span.required {color: darkred;}
      .${plugin_id_name}-horizontal .${plugin_id_name}-text {  text-align: center;}
      .${plugin_id_name}-option { line-height: 2; }
      .${plugin_id_name}-horizontal .${plugin_id_name}-option {  display: inline-block;  margin-left: 1em;  margin-right: 1em;  vertical-align: top;}
      label.${plugin_id_name}-text input[type='radio'] {margin-right: 1em;}
      </style>`;
    if (trial.preamble !== null) {
      html += `<div id="${plugin_id_name}-preamble" class="${plugin_id_name}-preamble">${trial.preamble}</div>`;
    }
    if (trial.autocomplete) {
      html += `<form id="${trial_form_id}">`;
    } else {
      html += `<form id="${trial_form_id}" autocomplete="off">`;
    }

    this.question_order = [];
    for (var i = 0; i < trial.questions.length; i++) {
      this.question_order.push(i);
    }
    if (trial.randomize_question_order) {
      this.question_order = this.jsPsych.randomization.shuffle(
        this.question_order
      );
    }

    for (var i = 0; i < trial.questions.length; i++) {
      var question = trial.questions[this.question_order[i]];
      var question_id = this.question_order[i];
      var question_classes = [`${plugin_id_name}-question`];
      if (question.horizontal) {
        question_classes.push(`${plugin_id_name}-horizontal`);
      }
      html += `<div id="${plugin_id_name}-${question_id}" class="${question_classes.join(
        " "
      )}" data-name="${question.name}">`;
      html += `<p class="${plugin_id_name}-text survey-multi-choice">${question.prompt}`;
      if (question.required) {
        html += "<span class='required'>*</span>";
      }
      html += "</p>";
      for (var j = 0; j < question.options.length; j++) {
        var option_id_name = `${plugin_id_name}-option-${question_id}-${j}`;
        var input_name = `${plugin_id_name}-response-${question_id}`;
        var input_id = `${plugin_id_name}-response-${question_id}-${j}`;
        var required_attr = question.required ? "required" : "";
        html += `
        <div id="${option_id_name}" class="${plugin_id_name}-option">
          <label class="${plugin_id_name}-text" for="${input_id}">
            <input type="radio" name="${input_name}" id="${input_id}" value="${question.options[j]}" ${required_attr} />
            ${question.options[j]}
            </label>
        </div>`;
      }
      html += "</div>";
    }
    html += `<input type="submit" id="${plugin_id_name}-next" class="${plugin_id_name} jspsych-btn"${
      trial.button_label ? ' value="' + trial.button_label + '"' : ""
    } />`;
    html += "</form>";
    surveyContainer.innerHTML = html;

    const trial_form = surveyContainer.querySelector(
      `#${trial_form_id}`
    ) as HTMLFormElement;
    trial_form.addEventListener("submit", (event) => {
      event.preventDefault();
      var endTime = performance.now();
      this.rt = Math.round(endTime - this.startTime);
      var question_data: any = {};
      for (var i2 = 0; i2 < trial.questions.length; i2++) {
        var match = surveyContainer.querySelector(
          `#${plugin_id_name}-${i2}`
        ) as HTMLElement;
        var id = "Q" + i2;
        var val;
        if (match.querySelector("input[type=radio]:checked") !== null) {
          val = (
            match.querySelector("input[type=radio]:checked") as HTMLInputElement
          ).value;
        } else {
          val = "";
        }
        var obje: any = {};
        var name: any = id;
        if (match.attributes["data-name" as any].value !== "") {
          name = match.attributes["data-name" as any].value;
        }
        obje[name] = val;
        Object.assign(question_data, obje);
      }
      this.response = question_data;
    });
    this.startTime = performance.now();
  }

  getResponse() {
    return this.response;
  }

  getRT() {
    return this.rt;
  }

  getQuestionOrder() {
    return this.question_order;
  }

  destroy() {
    // Cleanup if needed
  }
}

export { SurveyMultiChoiceComponent as default };
