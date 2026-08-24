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
  private listenerController: AbortController | null = null;
  private videoFrameRequest: number | null = null;
  private observingVideoFrames = false;
  private stimulusTiming: any = null;
  private diagnostics: Record<string, any> = {};

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
    this.listenerController?.abort();
    this.listenerController = new AbortController();
    const listenerOptions: AddEventListenerOptions = {
      signal: this.listenerController.signal,
    };
    this.stopped = false;
    this.observingVideoFrames = false;
    this.videoFrameRequest = null;
    // Helper to map coordinate values
    // Coordinate range is [-100, 100], mapped to [-50vw/vh, 50vw/vh]
    const mapValue = (value: number): number => {
      if (value < -100) return -50;
      if (value > 100) return 50;
      return value * 0.5;
    };

    // Create wrapper with coordinates
    const stimulusWrapper = document.createElement("div");
    stimulusWrapper.id = "jspsych-dynamic-video-component-wrapper";
    stimulusWrapper.className = "dynamic-video-component-wrapper";
    stimulusWrapper.style.position = "absolute";
    stimulusWrapper.style.zIndex = String(config.zIndex ?? 0);

    const xVw = mapValue(config.coordinates.x);
    const yVh = mapValue(config.coordinates.y);
    stimulusWrapper.style.left = `calc(50% + ${xVw}vw)`;
    stimulusWrapper.style.top = `calc(50% - ${yVh}vh)`;
    stimulusWrapper.style.transform = "translate(-50%, -50%)";

    container.appendChild(stimulusWrapper);

    const videoElement = document.createElement("video");
    stimulusWrapper.appendChild(videoElement);
    this.videoElement = videoElement;
    this.wrapper = stimulusWrapper;
    videoElement.id = config.name
      ? `jspsych-dynamic-${config.name}-stimulus`
      : "jspsych-dynamic-video-stimulus";
    videoElement.className = "dynamic-video-component";

    // Required attributes for autoplay to work reliably
    videoElement.setAttribute("playsinline", ""); // Required for iOS

    // Set video dimensions via CSS: both in vw (same unit) → ratio is preserved exactly
    if (config.width) {
      videoElement.style.width = `${config.width}vw`;
    }
    if (config.height) {
      videoElement.style.height = `${config.height}vw`;
    }
    if (config.width && !config.height) {
      videoElement.style.height = "auto";
    } else if (config.height && !config.width) {
      videoElement.style.width = "auto";
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

    // Timing record: HTML media presentation is unobservable from the page.
    const timing = config.__timing as any;
    const hasVideoFrameCallback =
      typeof (videoElement as any).requestVideoFrameCallback === "function";
    this.stimulusTiming = timing?.registerStimulus?.(
      config.name || config.type || "video",
      0,
      null,
      config.__componentId ?? config.builder_id ?? config.id ?? null,
      {
        renderBackend: "html_media",
        timestampSemantics: hasVideoFrameCallback
          ? "video_frame_callback"
          : "html_media_playing_event",
        timingDegraded: true,
        timingDegradedReason: hasVideoFrameCallback
          ? "expected_display_time_is_not_physical_onset"
          : "request_video_frame_callback_unavailable",
      },
    );
    this.diagnostics = {
      video_frame_callback_available: hasVideoFrameCallback,
      video_play_request_abs: null,
      video_play_request_frame_timestamp: null,
      video_first_frame_callback_abs: null,
      video_first_frame_media_time: null,
      video_first_frame_expected_display_time: null,
      video_first_frame_presented_frames: null,
      video_last_frame_callback_abs: null,
      video_last_frame_media_time: null,
      video_last_frame_expected_display_time: null,
      video_last_frame_presented_frames: null,
      video_stop_request_abs: null,
      video_onset_observation_source: hasVideoFrameCallback
        ? "requestVideoFrameCallback"
        : "playing_event",
      physical_video_onset_abs: null,
    };

    if (!hasVideoFrameCallback) {
      videoElement.addEventListener(
        "playing",
        () => {
          const observedAt = performance.now();
          if (this.diagnostics.video_first_frame_callback_abs === null) {
            this.diagnostics.video_first_frame_callback_abs = observedAt;
            this.stimulusTiming?.markOnset(observedAt, {
              frameTimestamp: observedAt,
              renderBackend: "html_media",
            });
          }
        },
        { ...listenerOptions, once: true },
      );
    }

    // Attempt to play if autoplay is enabled and no start
    if (shouldAutoplay && config.start == null) {
      // Use loadeddata event to ensure video is ready before playing
      videoElement.addEventListener(
        "loadeddata",
        () => {
          const startPlayback = (frameTimestamp?: number) => {
            this.recordPlayRequest(frameTimestamp ?? null);
            this.beginVideoFrameObservation();
            // Try with audio first
            const playPromise = videoElement.play();
            if (playPromise !== undefined) {
              playPromise.catch((error) => {
                console.warn(
                  "Autoplay with audio failed, trying muted:",
                  error,
                );
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
                      { ...listenerOptions, once: true },
                    );
                  })
                  .catch((err) => {
                    console.error("Autoplay failed completely:", err);
                    videoElement.controls = true;
                  });
              });
            }
          };

          if (timing) {
            timing.onStart((timestamp: number) => {
              startPlayback(timestamp);
            });
          } else {
            startPlayback();
          }
        },
        { ...listenerOptions, once: true },
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
      this.recordPlayRequest(null);
      this.beginVideoFrameObservation();
      videoElement.play();
    }

    // Handle stop time - only if explicitly set to a valid number
    if (
      config.stop != null &&
      typeof config.stop === "number" &&
      !isNaN(config.stop)
    ) {
      videoElement.addEventListener(
        "timeupdate",
        () => {
          if (videoElement.currentTime >= config.stop && !this.stopped) {
            this.stopped = true;
            this.recordStopRequest();
            videoElement.pause();
          }
        },
        listenerOptions,
      );
    }

    return videoElement;
  }

  private recordPlayRequest(frameTimestamp: number | null) {
    this.stopped = false;
    if (this.diagnostics.video_play_request_abs === null) {
      this.diagnostics.video_play_request_abs = performance.now();
      this.diagnostics.video_play_request_frame_timestamp = frameTimestamp;
    }
  }

  private beginVideoFrameObservation() {
    const video = this.videoElement as any;
    if (
      !video ||
      this.observingVideoFrames ||
      typeof video.requestVideoFrameCallback !== "function"
    ) {
      return;
    }
    this.observingVideoFrames = true;

    const observe = (callbackTimestamp: number, metadata: any) => {
      const expectedDisplayTime =
        typeof metadata?.expectedDisplayTime === "number"
          ? metadata.expectedDisplayTime
          : null;
      const mediaTime =
        typeof metadata?.mediaTime === "number" ? metadata.mediaTime : null;
      const presentedFrames =
        typeof metadata?.presentedFrames === "number"
          ? metadata.presentedFrames
          : null;

      if (this.diagnostics.video_first_frame_callback_abs === null) {
        this.diagnostics.video_first_frame_callback_abs = callbackTimestamp;
        this.diagnostics.video_first_frame_media_time = mediaTime;
        this.diagnostics.video_first_frame_expected_display_time =
          expectedDisplayTime;
        this.diagnostics.video_first_frame_presented_frames = presentedFrames;
        // The callback timestamp remains a software observation. The browser's
        // expectedDisplayTime is exported separately and is never labelled a
        // physical onset.
        this.stimulusTiming?.markOnset(callbackTimestamp, {
          frameTimestamp: callbackTimestamp,
          renderBackend: "html_media",
        });
      }

      this.diagnostics.video_last_frame_callback_abs = callbackTimestamp;
      this.diagnostics.video_last_frame_media_time = mediaTime;
      this.diagnostics.video_last_frame_expected_display_time =
        expectedDisplayTime;
      this.diagnostics.video_last_frame_presented_frames = presentedFrames;

      if (!this.stopped && this.videoElement === video) {
        this.videoFrameRequest = video.requestVideoFrameCallback(observe);
      } else {
        this.observingVideoFrames = false;
        this.videoFrameRequest = null;
      }
    };

    this.videoFrameRequest = video.requestVideoFrameCallback(observe);
  }

  private recordStopRequest() {
    if (Object.keys(this.diagnostics).length === 0) return;
    this.stopped = true;
    if (
      this.videoFrameRequest !== null &&
      typeof (this.videoElement as any)?.cancelVideoFrameCallback === "function"
    ) {
      (this.videoElement as any).cancelVideoFrameCallback(
        this.videoFrameRequest,
      );
    }
    this.videoFrameRequest = null;
    this.observingVideoFrames = false;
    if (this.diagnostics.video_stop_request_abs === null) {
      this.diagnostics.video_stop_request_abs = performance.now();
      const lastObserved = this.diagnostics.video_last_frame_callback_abs;
      if (typeof lastObserved === "number") {
        this.stimulusTiming?.markOffset(lastObserved, {
          frameTimestamp: lastObserved,
          renderBackend: "html_media",
        });
      }
    }
  }

  /**
   * Play the video
   */
  play() {
    if (this.videoElement) {
      this.recordPlayRequest(null);
      this.beginVideoFrameObservation();
      this.videoElement.play();
    }
  }

  /**
   * Pause the video
   */
  pause() {
    if (this.videoElement) {
      this.recordStopRequest();
      this.videoElement.pause();
    }
  }

  /**
   * Stop the video (pause and reset)
   */
  stop() {
    if (this.videoElement) {
      this.recordStopRequest();
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
    this.recordStopRequest();
    this.listenerController?.abort();
    this.listenerController = null;
    if (this.videoElement) {
      if (
        this.videoFrameRequest !== null &&
        typeof (this.videoElement as any).cancelVideoFrameCallback ===
          "function"
      ) {
        (this.videoElement as any).cancelVideoFrameCallback(
          this.videoFrameRequest,
        );
      }
      this.videoElement.pause();
      this.videoElement.onended = () => {};
      this.videoElement.onseeked = null;
      this.videoElement.onplaying = null;
    }
    if (this.wrapper && this.wrapper.parentNode) {
      this.wrapper.parentNode.removeChild(this.wrapper);
    }
    this.wrapper = null;
    this.videoElement = null;
    this.videoFrameRequest = null;
    this.observingVideoFrames = false;
    this.stimulusTiming = null;
  }

  getDiagnostics(): Record<string, any> {
    return { ...this.diagnostics };
  }

  /**
   * Get the video element
   */
  getVideoElement(): HTMLVideoElement | null {
    return this.videoElement;
  }
}

export { VideoComponent as default };
