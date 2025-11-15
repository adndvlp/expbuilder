import autoBind from "auto-bind";
import { ParameterType } from "jspsych";

var version = "2.1.0";

const info = {
  name: "audio-button-response",
  version,
  parameters: {
    /** Path to audio file to be played. */
    stimulus_audio: {
      type: ParameterType.AUDIO,
      default: void 0,
    },

    /** If true, then the trial will end as soon as the audio file finishes playing.  */
    trial_ends_after_audio: {
      type: ParameterType.BOOL,
      default: false,
    },
    /**
     * If true, then responses are allowed while the audio is playing. If false, then the audio must finish
     * playing before the button choices are enabled and a response is accepted. Once the audio has played
     * all the way through, the buttons are enabled and a response is allowed (including while the audio is
     * being re-played via on-screen playback controls).
     */
    response_allowed_while_playing_audio: {
      type: ParameterType.BOOL,
      default: true,
    },
  },

  // prettier-ignore
  citations: {
    "apa": "de Leeuw, J. R., Gilbert, R. A., & Luchterhandt, B. (2023). jsPsych: Enabling an Open-Source Collaborative Ecosystem of Behavioral Experiments. Journal of Open Source Software, 8(85), 5351. https://doi.org/10.21105/joss.05351 ",
    "bibtex": '@article{Leeuw2023jsPsych, 	author = {de Leeuw, Joshua R. and Gilbert, Rebecca A. and Luchterhandt, Bj{\\" o}rn}, 	journal = {Journal of Open Source Software}, 	doi = {10.21105/joss.05351}, 	issn = {2475-9066}, 	number = {85}, 	year = {2023}, 	month = {may 11}, 	pages = {5351}, 	publisher = {Open Journals}, 	title = {jsPsych: Enabling an {Open}-{Source} {Collaborative} {Ecosystem} of {Behavioral} {Experiments}}, 	url = {https://joss.theoj.org/papers/10.21105/joss.05351}, 	volume = {8}, }  '
  },
};
