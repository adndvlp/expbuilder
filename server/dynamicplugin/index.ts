import { JsPsych, JsPsychPlugin, ParameterType, TrialType } from "jspsych";

import { version } from "../package.json";

const info = <const>{
  name: "{DynamicPlugin}",
  version: version,
  parameters: {
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

    /////////////////////
  },
  data: {
    /** The path of the image that was displayed. */
    stimulus: {
      type: ParameterType.STRING, // ARRAY of the stimulus displayed
    },
    /**  Indicates which key the participant pressed. */
    response: {
      type: ParameterType.COMPLEX,
    },
    /** The response time in milliseconds for the participant to make a response. The time is measured from when the stimulus
     * first appears on the screen until the participant's response. */
    rt: {
      type: ParameterType.INT,
    },
  },
};

type Info = typeof info;

/**
 * **{name}**
 *
 * {description}
 *
 * @author {author}
 * @see {@link {documentation-url}}}
 */
class PluginNamePlugin implements JsPsychPlugin<Info> {
  static info = info;

  constructor(private jsPsych: JsPsych) {}

  trial(display_element: HTMLElement, trial: TrialType<Info>) {
    // data saving
    var trial_data = {
      data1: 99, // Make sure this type and name matches the information for data1 in the data object contained within the info const.
      data2: "hello world!", // Make sure this type and name matches the information for data2 in the data object contained within the info const.
    };

    // end trial
    this.jsPsych.finishTrial(trial_data);
  }
}

export default PluginNamePlugin;
