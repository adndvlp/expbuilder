import { ParameterType } from "jspsych";

var version = "2.1.0";

const info = {
  name: "SurveyLikertComponent",
  version,
  parameters: {
    /** Array containing one or more objects with parameters for the question(s) that should be shown on the page. */
    questions: {
      type: ParameterType.COMPLEX,
      array: true,
      nested: {
        /** Question prompt. */
        prompt: {
          type: ParameterType.HTML_STRING,
          default: void 0,
        },
        /** Array of likert labels to display for this question. */
        labels: {
          type: ParameterType.STRING,
          array: true,
          default: void 0,
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
    /** If true, the order of the questions in the 'questions' array will be randomized. */
    randomize_question_order: {
      type: ParameterType.BOOL,
      default: false,
    },
    /** HTML-formatted string to display at top of the page above all of the questions. */
    preamble: {
      type: ParameterType.HTML_STRING,
      default: null,
    },
    /** Width of the likert scales in pixels. */
    scale_width: {
      type: ParameterType.INT,
      default: null,
    },
    /** Label of the button to submit responses. */
    button_label: {
      type: ParameterType.STRING,
      default: "Continue",
    },
    /** Setting this to true will enable browser auto-complete or auto-fill for the form. */
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
 * SurveyLikertComponent - handles Likert scale surveys
 * Stores response data internally, exposes via getters
 */
class SurveyLikertComponent {
  private jsPsych: any;
  private response: any = {};
  private rt: number = 0;
  private startTime: number = 0;
  private question_order: number[] = [];

  constructor(jsPsych: any) {
    this.jsPsych = jsPsych;
  }

  static info = info;

  render(display_element: HTMLElement, trial: any, onResponse?: () => void) {
    // Helper to map coordinate values
    const mapValue = (value: number): number => {
      if (value < -1) return -50;
      if (value > 1) return 50;
      return value * 50;
    };

    // Create survey container with coordinates
    const surveyContainer = document.createElement("div");
    surveyContainer.id = "jspsych-survey-likert-container";
    surveyContainer.style.position = "absolute";

    const xVw = mapValue(trial.coordinates.x);
    const yVh = mapValue(trial.coordinates.y);
    surveyContainer.style.left = `calc(50% + ${xVw}vw)`;
    surveyContainer.style.top = `calc(50% + ${yVh}vh)`;
    surveyContainer.style.transform = "translate(-50%, -50%)";

    display_element.appendChild(surveyContainer);

    if (trial.scale_width !== null) {
      var w = trial.scale_width + "px";
    } else {
      var w = "100%";
    }
    var html = "";
    html += '<style id="jspsych-survey-likert-css">';
    html +=
      ".jspsych-survey-likert-statement { display:block; font-size: 16px; padding-top: 40px; margin-bottom:10px; }.jspsych-survey-likert-opts { list-style:none; width:" +
      w +
      "; margin:auto; padding:0 0 35px; display:block; font-size: 14px; line-height:1.1em; }.jspsych-survey-likert-opt-label { line-height: 1.1em; color: #444; }.jspsych-survey-likert-opts:before { content: ''; position:relative; top:11px; /*left:9.5%;*/ display:block; background-color:#efefef; height:4px; width:100%; }.jspsych-survey-likert-opts:last-of-type { border-bottom: 0; }.jspsych-survey-likert-opts li { display:inline-block; /*width:19%;*/ text-align:center; vertical-align: top; }.jspsych-survey-likert-opts li input[type=radio] { display:block; position:relative; top:0; left:50%; margin-left:-6px; }";
    html += "</style>";
    if (trial.preamble !== null) {
      html +=
        '<div id="jspsych-survey-likert-preamble" class="jspsych-survey-likert-preamble">' +
        trial.preamble +
        "</div>";
    }
    if (trial.autocomplete) {
      html += '<form id="jspsych-survey-likert-form">';
    } else {
      html += '<form id="jspsych-survey-likert-form" autocomplete="off">';
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
      html +=
        '<label class="jspsych-survey-likert-statement">' +
        question.prompt +
        "</label>";
      var width = 100 / question.labels.length;
      var options_string =
        '<ul class="jspsych-survey-likert-opts" data-name="' +
        question.name +
        '" data-radio-group="Q' +
        this.question_order[i] +
        '">';
      for (var j = 0; j < question.labels.length; j++) {
        options_string +=
          '<li style="width:' +
          width +
          '%"><label class="jspsych-survey-likert-opt-label"><input type="radio" name="Q' +
          this.question_order[i] +
          '" value="' +
          j +
          '"';
        if (question.required) {
          options_string += " required";
        }
        options_string += ">" + question.labels[j] + "</label></li>";
      }
      options_string += "</ul>";
      html += options_string;
    }
    html +=
      '<input type="submit" id="jspsych-survey-likert-next" class="jspsych-survey-likert jspsych-btn" value="' +
      trial.button_label +
      '"></input>';
    html += "</form>";
    surveyContainer.innerHTML = html;

    surveyContainer
      .querySelector("#jspsych-survey-likert-form")!
      .addEventListener("submit", (e) => {
        e.preventDefault();
        var endTime = performance.now();
        this.rt = Math.round(endTime - this.startTime);
        var question_data: any = {};
        var matches = surveyContainer.querySelectorAll(
          "#jspsych-survey-likert-form .jspsych-survey-likert-opts"
        );
        for (var index = 0; index < matches.length; index++) {
          var id = (matches[index] as HTMLElement).dataset["radioGroup"];
          var el = surveyContainer.querySelector(
            'input[name="' + id + '"]:checked'
          ) as HTMLInputElement;
          if (el === null) {
            var response: any = "";
          } else {
            var response: any = parseInt(el.value);
          }
          var obje: any = {};
          var name: any;
          if (
            (matches[index] as HTMLElement).attributes["data-name" as any]
              .value !== ""
          ) {
            name = (matches[index] as HTMLElement).attributes[
              "data-name" as any
            ].value;
          } else {
            name = id;
          }
          obje[name] = response;
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

export { SurveyLikertComponent as default };
