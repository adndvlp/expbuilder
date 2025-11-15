import { ParameterType } from "jspsych";

var version = "2.2.0";

const info = {
  name: "ImageComponent",
  version,
  parameters: {
    /** The path of the image file to be displayed. */
    stimulus_image: {
      type: ParameterType.IMAGE,
      default: void 0,
    },
    /** Set the height of the image in pixels. If left null (no value specified), then the image will display at its natural height. */
    height_image: {
      type: ParameterType.INT,
      default: null,
    },
    /** Set the width of the image in pixels. If left null (no value specified), then the image will display at its natural width. */
    width_image: {
      type: ParameterType.INT,
      default: null,
    },
    /** If setting *only* the width or *only* the height and this parameter is true, then the other dimension will be
     * scaled to maintain the image's aspect ratio.  */
    maintain_aspect_ratio_image: {
      type: ParameterType.BOOL,
      default: true,
    },

    /** How long to show the stimulus for in milliseconds. If the value is null, then the stimulus will be shown until
     * the participant makes a response. */
    stimulus_duration_image: {
      type: ParameterType.INT,
      default: null,
    },
  },

  // prettier-ignore
  citations: {
    "apa": "de Leeuw, J. R., Gilbert, R. A., & Luchterhandt, B. (2023). jsPsych: Enabling an Open-Source Collaborative Ecosystem of Behavioral Experiments. Journal of Open Source Software, 8(85), 5351. https://doi.org/10.21105/joss.05351 ",
    "bibtex": '@article{Leeuw2023jsPsych, 	author = {de Leeuw, Joshua R. and Gilbert, Rebecca A. and Luchterhandt, Bj{\\" o}rn}, 	journal = {Journal of Open Source Software}, 	doi = {10.21105/joss.05351}, 	issn = {2475-9066}, 	number = {85}, 	year = {2023}, 	month = {may 11}, 	pages = {5351}, 	publisher = {Open Journals}, 	title = {jsPsych: Enabling an {Open}-{Source} {Collaborative} {Ecosystem} of {Behavioral} {Experiments}}, 	url = {https://joss.theoj.org/papers/10.21105/joss.05351}, 	volume = {8}, }  '
  },
};
