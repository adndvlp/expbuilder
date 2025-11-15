import { ParameterType } from "jspsych";

var version = "2.1.1";

const info = {
  name: "SliderComponent",
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
    /** abels displayed at equidistant locations on the slider. For example, two labels will be placed at the ends of the slider.
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
  },
  data: {
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
