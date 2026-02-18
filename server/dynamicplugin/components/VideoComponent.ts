import { ParameterType } from "jspsych";

var version = "2.2.0";

const info = {
  name: "VideoComponent",
  version,
  parameters: {
    name: {
      type: ParameterType.STRING,
      default: undefined,
    },
    /**
     * An array of file paths to the video. You can specify multiple formats of the same video (e.g., .mp4, .ogg, .webm)
     * to maximize the [cross-browser compatibility](https://developer.mozilla.org/en-US/docs/Web/HTML/Supported_media_formats).
     * Usually .mp4 is a safe cross-browser option. The plugin does not reliably support .mov files. The player will use the
     * first source file in the array that is compatible with the browser, so specify the files in order of preference.
     */
    stimulus: {
      type: ParameterType.VIDEO,
      default: void 0,
      array: true,
    },

    /** The width of the video display in pixels. If `null`, the video will take the original video's dimensions,
     * or properly scaled with the aspect ratio if the height is also specified.
     */
    width: {
      type: ParameterType.INT,
      default: null,
    },
    /** The height of the video display in pixels. If `null`, the video will take the original video's dimensions,
     * or properly scaled with the aspect ratio if the width is also specified.
     */
    height: {
      type: ParameterType.INT,
      default: null,
    },
    /** If true, the video will begin playing as soon as it has loaded. */
    autoplay: {
      type: ParameterType.BOOL,
      pretty_name: "Autoplay",
      default: true,
    },
    /** If true, controls for the video player will be available to the participant. They will be able to pause
     * the video or move the playback to any point in the video.
     */
    controls: {
      type: ParameterType.BOOL,
      default: false,
    },
    /** Time to start the clip. If `null` (default), video will start at the beginning of the file. */
    start: {
      type: ParameterType.FLOAT,
      default: null,
    },
    /** Time to stop the clip. If `null` (default), video will stop at the end of the file. */
    stop: {
      type: ParameterType.FLOAT,
      default: null,
    },
    /** The playback rate of the video. 1 is normal, <1 is slower, >1 is faster. */
    rate: {
      type: ParameterType.FLOAT,
      default: 1,
    },
    /** Position coordinates for the video. x and y should be between -1 and 1, mapped to -50vw/vh to 50vw/vh. */
    coordinates: {
      type: ParameterType.OBJECT,
      default: { x: 0, y: 0 },
    },
    /** Z-index for layering (higher values appear on top) */
    zIndex: {
      type: ParameterType.INT,
      pretty_name: "Z-Index",
      default: 0,
      description: "Layer order - higher values render on top of lower values",
    },
  },
  // prettier-ignore
  citations: {
    "apa": "de Leeuw, J. R., Gilbert, R. A., & Luchterhandt, B. (2023). jsPsych: Enabling an Open-Source Collaborative Ecosystem of Behavioral Experiments. Journal of Open Source Software, 8(85), 5351. https://doi.org/10.21105/joss.05351 ",
    "bibtex": '@article{Leeuw2023jsPsych, 	author = {de Leeuw, Joshua R. and Gilbert, Rebecca A. and Luchterhandt, Bj{\\" o}rn}, 	journal = {Journal of Open Source Software}, 	doi = {10.21105/joss.05351}, 	issn = {2475-9066}, 	number = {85}, 	year = {2023}, 	month = {may 11}, 	pages = {5351}, 	publisher = {Open Journals}, 	title = {jsPsych: Enabling an {Open}-{Source} {Collaborative} {Ecosystem} of {Behavioral} {Experiments}}, 	url = {https://joss.theoj.org/papers/10.21105/joss.05351}, 	volume = {8}, }  '
  },
};

/**
 * VideoComponent - Renders and plays video stimulus
 * This component only handles video playback, not responses
 */
class VideoComponent {
  private jsPsych: any;
  private videoElement: HTMLVideoElement | null = null;
  private wrapper: HTMLElement | null = null;
  private stopped: boolean = false;

  constructor(jsPsych: any) {
    this.jsPsych = jsPsych;
  }

  static info = info;

  /**
   * Render and play the video
   * @param container - The HTML element to render into
   * @param config - Configuration for the video
   * @returns The rendered video element
   */
  render(container: HTMLElement, config: any): HTMLVideoElement {
    // Helper to map coordinate values
    const mapValue = (value: number): number => {
      if (value < -1) return -50;
      if (value > 1) return 50;
      return value * 50;
    };

    // Create wrapper with coordinates
    const stimulusWrapper = document.createElement("div");
    stimulusWrapper.id = "jspsych-dynamic-video-component-wrapper";
    stimulusWrapper.className = "dynamic-video-component-wrapper";
    stimulusWrapper.style.position = "absolute";

    const xVw = mapValue(config.coordinates.x);
    const yVh = mapValue(config.coordinates.y);
    stimulusWrapper.style.left = `calc(50% + ${xVw}vw)`;
    stimulusWrapper.style.top = `calc(50% - ${yVh}vh)`;
    stimulusWrapper.style.transform = "translate(-50%, -50%)";

    container.appendChild(stimulusWrapper);

    const videoElement = document.createElement("video");
    stimulusWrapper.appendChild(videoElement);
    videoElement.id = config.name
      ? `jspsych-dynamic-${config.name}-stimulus`
      : "jspsych-dynamic-video-stimulus";
    videoElement.className = "dynamic-video-component";

    // Required attributes for autoplay to work reliably
    videoElement.setAttribute("playsinline", ""); // Required for iOS

    // Set video dimensions - if not specified, video will use natural dimensions
    if (config.width) {
      videoElement.width = config.width;
    }
    if (config.height) {
      videoElement.height = config.height;
    }

    // Set video controls
    videoElement.controls =
      config.controls !== undefined ? config.controls : false;

    // Set autoplay - default to true if not specified
    const shouldAutoplay =
      config.autoplay !== undefined ? config.autoplay : true;

    // Hide video initially if start time is specified and valid
    if (
      config.start != null &&
      typeof config.start === "number" &&
      !isNaN(config.start)
    ) {
      videoElement.style.visibility = "hidden";
    }

    // Check for preloaded video buffer
    const videoPreloadBlob = this.jsPsych.pluginAPI.getVideoBuffer(
      config.stimulus[0],
    );

    if (!videoPreloadBlob) {
      // Add video sources
      for (let filename of config.stimulus) {
        if (filename.indexOf("?") > -1) {
          filename = filename.substring(0, filename.indexOf("?"));
        }
        const type = filename
          .substring(filename.lastIndexOf(".") + 1)
          .toLowerCase();

        if (type === "mov") {
          console.warn(
            "Warning: VideoComponent does not reliably support .mov files.",
          );
        }

        const sourceElement = document.createElement("source");
        sourceElement.src = filename;
        sourceElement.type = "video/" + type;
        videoElement.appendChild(sourceElement);
      }
    } else {
      videoElement.src = videoPreloadBlob;
    }

    // Set playback rate
    videoElement.playbackRate = config.rate || 1;

    // Attempt to play if autoplay is enabled and no start
    if (shouldAutoplay && config.start == null) {
      // Use loadeddata event to ensure video is ready before playing
      videoElement.addEventListener(
        "loadeddata",
        () => {
          // Try with audio first
          const playPromise = videoElement.play();
          if (playPromise !== undefined) {
            playPromise.catch((error) => {
              console.warn("Autoplay with audio failed, trying muted:", error);
              // If autoplay with audio fails, try muted
              videoElement.muted = true;
              videoElement
                .play()
                .then(() => {
                  console.log("Playing muted - click video to unmute");
                  // Add click listener to unmute
                  videoElement.addEventListener(
                    "click",
                    () => {
                      videoElement.muted = false;
                    },
                    { once: true },
                  );
                })
                .catch((err) => {
                  console.error("Autoplay failed completely:", err);
                  videoElement.controls = true;
                });
            });
          }
        },
        { once: true },
      );
    }

    // Handle start time - only if explicitly set to a valid number
    if (
      config.start != null &&
      typeof config.start === "number" &&
      !isNaN(config.start)
    ) {
      videoElement.pause();
      videoElement.onseeked = () => {
        videoElement.style.visibility = "visible";
        videoElement.muted = false;
        if (config.autoplay) {
          videoElement.play();
        } else {
          videoElement.pause();
        }
        videoElement.onseeked = () => {};
      };
      videoElement.onplaying = () => {
        videoElement.currentTime = config.start;
        videoElement.onplaying = () => {};
      };
      videoElement.muted = true;
      videoElement.play();
    }

    // Handle stop time - only if explicitly set to a valid number
    if (
      config.stop != null &&
      typeof config.stop === "number" &&
      !isNaN(config.stop)
    ) {
      videoElement.addEventListener("timeupdate", () => {
        if (videoElement.currentTime >= config.stop && !this.stopped) {
          this.stopped = true;
          videoElement.pause();
        }
      });
    }

    this.videoElement = videoElement;
    this.wrapper = stimulusWrapper;

    return videoElement;
  }

  /**
   * Play the video
   */
  play() {
    if (this.videoElement) {
      this.videoElement.play();
    }
  }

  /**
   * Pause the video
   */
  pause() {
    if (this.videoElement) {
      this.videoElement.pause();
    }
  }

  /**
   * Stop the video (pause and reset)
   */
  stop() {
    if (this.videoElement) {
      this.videoElement.pause();
      this.videoElement.currentTime = 0;
    }
  }

  /**
   * Add event listener for video events
   */
  addEventListener(event: string, callback: (e?: Event) => void) {
    if (this.videoElement) {
      this.videoElement.addEventListener(event, callback);
    }
  }

  /**
   * Remove event listener
   */
  removeEventListener(event: string, callback: (e?: Event) => void) {
    if (this.videoElement) {
      this.videoElement.removeEventListener(event, callback);
    }
  }

  /**
   * Check if video has ended
   */
  hasEnded(): boolean {
    return this.videoElement ? this.videoElement.ended : true;
  }

  /**
   * Get current time of video
   */
  getCurrentTime(): number {
    return this.videoElement ? this.videoElement.currentTime : 0;
  }

  /**
   * Set current time of video
   */
  setCurrentTime(time: number) {
    if (this.videoElement) {
      this.videoElement.currentTime = time;
    }
  }

  /**
   * Hide the video
   */
  hide() {
    if (this.videoElement) {
      this.videoElement.style.visibility = "hidden";
    }
  }

  /**
   * Show the video
   */
  show() {
    if (this.videoElement) {
      this.videoElement.style.visibility = "visible";
    }
  }

  /**
   * Remove the video from DOM and clean up
   */
  destroy() {
    if (this.videoElement) {
      this.videoElement.pause();
      this.videoElement.onended = () => {};
    }
    if (this.wrapper && this.wrapper.parentNode) {
      this.wrapper.parentNode.removeChild(this.wrapper);
    }
    this.wrapper = null;
    this.videoElement = null;
  }

  /**
   * Get the video element
   */
  getVideoElement(): HTMLVideoElement | null {
    return this.videoElement;
  }
}

export { VideoComponent as default };
