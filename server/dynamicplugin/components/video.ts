import { ParameterType } from "jspsych";

var version = "2.2.0";

const info = {
  name: "VideoComponent",
  version,
  parameters: {
    /**
     * An array of file paths to the video. You can specify multiple formats of the same video (e.g., .mp4, .ogg, .webm)
     * to maximize the [cross-browser compatibility](https://developer.mozilla.org/en-US/docs/Web/HTML/Supported_media_formats).
     * Usually .mp4 is a safe cross-browser option. The plugin does not reliably support .mov files. The player will use the
     * first source file in the array that is compatible with the browser, so specify the files in order of preference.
     */
    stimulus_video: {
      type: ParameterType.VIDEO,
      default: void 0,
      array: true,
    },

    /** The width of the video display in pixels. If `null`, the video will take the original video's dimensions,
     * or properly scaled with the aspect ratio if the height is also specified.
     */
    width_video: {
      type: ParameterType.INT,
      default: null,
    },
    /** The height of the video display in pixels. If `null`, the video will take the original video's dimensions,
     * or properly scaled with the aspect ratio if the width is also specified.
     */
    height_video: {
      type: ParameterType.INT,
      default: null,
    },
    /** If true, the video will begin playing as soon as it has loaded. */
    autoplay_video: {
      type: ParameterType.BOOL,
      pretty_name: "Autoplay",
      default: true,
    },
    /** If true, controls for the video player will be available to the participant. They will be able to pause
     * the video or move the playback to any point in the video.
     */
    controls_video: {
      type: ParameterType.BOOL,
      default: false,
    },
    /** Time to start the clip. If `null` (default), video will start at the beginning of the file. */
    start_video: {
      type: ParameterType.FLOAT,
      default: null,
    },
    /** Time to stop the clip. If `null` (default), video will stop at the end of the file. */
    stop_video: {
      type: ParameterType.FLOAT,
      default: null,
    },
    /** The playback rate of the video. 1 is normal, <1 is slower, >1 is faster. */
    rate_video: {
      type: ParameterType.FLOAT,
      default: 1,
    },

    /** If true, the trial will end immediately after the video finishes playing. */
    trial_ends_after_video: {
      type: ParameterType.BOOL,
      default: false,
    },
    /** If true, then responses are allowed while the video is playing. If false, then the video must finish
     * playing before the button choices are enabled and a response is accepted. Once the video has played
     * all the way through, the buttons are enabled and a response is allowed (including while the video is
     * being re-played via on-screen playback controls).
     */
    response_allowed_while_playing_video: {
      type: ParameterType.BOOL,
      default: true,
    },
  },
  // prettier-ignore
  citations: '__CITATIONS__',
};
