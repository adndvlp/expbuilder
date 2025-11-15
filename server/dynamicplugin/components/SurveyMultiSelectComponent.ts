import { ParameterType } from "jspsych";

var version = "2.1.0";

const info = {
  name: "SurveyMultiSelectComponent",
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
        /** Array of multiple select options for this question. */
        options: {
          type: ParameterType.STRING,
          array: true,
          default: void 0,
        },
        /** If true, then the question will be centered and options will be displayed horizontally. */
        horizontal: {
          type: ParameterType.BOOL,
          default: false,
        },
        /** Whether or not a response to this question must be given in order to continue. */
        required: {
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
     * If true, the display order of `questions` is randomly determined at the start of the trial. In the data
     * object, `Q0` will still refer to the first question in the array, regardless of where it was presented
     * visually.
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
    /** Label of the button to submit responses. */
    button_label: {
      type: ParameterType.STRING,
      default: "Continue",
    },
    /** 'You must choose at least one response for this question' | Message to display if required response is not given. */
    required_message: {
      type: ParameterType.STRING,
      default: "You must choose at least one response for this question",
    },
    /** This determines whether or not all of the input elements on the page should allow autocomplete.
     * Setting this to true will enable autocomplete or auto-fill for the form. */
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

/**
 * SurveyMultiSelectComponent - handles multiple select surveys with checkboxes
 * Stores response data internally, exposes via getters
 */
class SurveyMultiSelectComponent {
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
    mainContainer.id = "jspsych-survey-multi-select-main";
    mainContainer.style.position = "relative";
    display_element.appendChild(mainContainer);

    // Create survey container with coordinates
    const surveyContainer = document.createElement("div");
    surveyContainer.id = "jspsych-survey-multi-select-container";
    surveyContainer.style.position = "relative";

    const xVw = mapValue(trial.coordinates.x);
    const yVh = mapValue(trial.coordinates.y);
    surveyContainer.style.left = `${xVw}vw`;
    surveyContainer.style.top = `${yVh}vh`;

    mainContainer.appendChild(surveyContainer);

    var plugin_id_name = "jspsych-survey-multi-select";
    var plugin_id_selector = "#" + plugin_id_name;
    const _join = (...args: any[]) => args.join("-");
    var cssstr =
      ".jspsych-survey-multi-select-question { margin-top: 2em; margin-bottom: 2em; text-align: left; }.jspsych-survey-multi-select-text span.required {color: darkred;}.jspsych-survey-multi-select-horizontal .jspsych-survey-multi-select-text {  text-align: center;}.jspsych-survey-multi-select-option { line-height: 2; }.jspsych-survey-multi-select-horizontal .jspsych-survey-multi-select-option {  display: inline-block;  margin-left: 1em;  margin-right: 1em;  vertical-align: top;}label.jspsych-survey-multi-select-text input[type='checkbox'] {margin-right: 1em;}";
    surveyContainer.innerHTML =
      '<style id="jspsych-survey-multi-select-css">' + cssstr + "</style>";
    var trial_form_id = _join(plugin_id_name, "form");
    surveyContainer.innerHTML += '<form id="' + trial_form_id + '"></form>';
    var trial_form = surveyContainer.querySelector(
      "#" + trial_form_id
    ) as HTMLFormElement;
    if (!trial.autocomplete) {
      trial_form.setAttribute("autocomplete", "off");
    }
    var preamble_id_name = _join(plugin_id_name, "preamble");
    if (trial.preamble !== null) {
      trial_form.innerHTML +=
        '<div id="' +
        preamble_id_name +
        '" class="' +
        preamble_id_name +
        '">' +
        trial.preamble +
        "</div>";
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
      var question_classes = [_join(plugin_id_name, "question")];
      if (question.horizontal) {
        question_classes.push(_join(plugin_id_name, "horizontal"));
      }
      trial_form.innerHTML +=
        '<div id="' +
        _join(plugin_id_name, question_id) +
        '" data-name="' +
        question.name +
        '" class="' +
        question_classes.join(" ") +
        '"></div>';
      var question_selector = _join(plugin_id_selector, question_id);
      surveyContainer.querySelector(question_selector)!.innerHTML +=
        '<p id="survey-question" class="' +
        plugin_id_name +
        '-text survey-multi-select">' +
        question.prompt +
        "</p>";
      for (var j = 0; j < question.options.length; j++) {
        var option_id_name = _join(plugin_id_name, "option", question_id, j);
        surveyContainer.querySelector(question_selector)!.innerHTML +=
          '<div id="' +
          option_id_name +
          '" class="' +
          _join(plugin_id_name, "option") +
          '"></div>';
        var form = document.getElementById(option_id_name);
        var input_name = _join(plugin_id_name, "response", question_id);
        var input_id = _join(plugin_id_name, "response", question_id, j);
        var label = document.createElement("label");
        label.setAttribute("class", plugin_id_name + "-text");
        label.innerHTML = question.options[j];
        label.setAttribute("for", input_id);
        var input = document.createElement("input");
        input.setAttribute("type", "checkbox");
        input.setAttribute("name", input_name);
        input.setAttribute("id", input_id);
        input.setAttribute("value", question.options[j]);
        form!.appendChild(label);
        label.insertBefore(input, label.firstChild);
      }
    }
    trial_form.innerHTML += '<div class="fail-message"></div>';
    trial_form.innerHTML +=
      '<button id="' +
      plugin_id_name +
      '-next" class="' +
      plugin_id_name +
      ' jspsych-btn">' +
      trial.button_label +
      "</button>";
    display_element
      .querySelector("#jspsych-survey-multi-select-next")!
      .addEventListener("click", () => {
        for (var i2 = 0; i2 < trial.questions.length; i2++) {
          if (trial.questions[i2].required) {
            if (
              surveyContainer.querySelector(
                "#jspsych-survey-multi-select-" + i2 + " input:checked"
              ) == null
            ) {
              (
                surveyContainer.querySelector(
                  "#jspsych-survey-multi-select-" + i2 + " input"
                ) as HTMLInputElement
              ).setCustomValidity(trial.required_message);
            } else {
              (
                surveyContainer.querySelector(
                  "#jspsych-survey-multi-select-" + i2 + " input"
                ) as HTMLInputElement
              ).setCustomValidity("");
            }
          }
        }
        trial_form.reportValidity();
      });
    trial_form.addEventListener("submit", (event) => {
      event.preventDefault();
      var endTime = performance.now();
      this.rt = Math.round(endTime - this.startTime);
      var question_data: any = {};
      for (var index = 0; index < trial.questions.length; index++) {
        var match = surveyContainer.querySelector(
          "#jspsych-survey-multi-select-" + index
        ) as HTMLElement;
        var val: any[] = [];
        var inputboxes = match.querySelectorAll("input[type=checkbox]:checked");
        for (var j2 = 0; j2 < inputboxes.length; j2++) {
          var currentChecked = inputboxes[j2] as HTMLInputElement;
          val.push(currentChecked.value);
        }
        var id = "Q" + index;
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

export { SurveyMultiSelectComponent as default };
