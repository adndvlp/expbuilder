import { JsPsych } from "jspsych";
import { ParameterType } from "jspsych";

const version = "1.0.0";

const info = {
  name: "AudioResponseComponent",
  version,
  parameters: {
    name: {
      type: ParameterType.STRING,
      default: undefined,
    },
    /** The maximum length of the recording, in milliseconds. */
    recording_duration: {
      type: ParameterType.INT,
      default: 2000,
    },
    /** Whether to show a button on the screen that the participant can click to finish the recording. */
    show_done_button: {
      type: ParameterType.BOOL,
      default: true,
    },
    /** The label for the done button. */
    done_button_label: {
      type: ParameterType.STRING,
      default: "Continue",
    },
    /** The label for the record again button enabled when `allow_playback: true`. */
    record_again_button_label: {
      type: ParameterType.STRING,
      default: "Record again",
    },
    /** The label for the accept button enabled when `allow_playback: true`. */
    accept_button_label: {
      type: ParameterType.STRING,
      default: "Continue",
    },
    /** Whether to allow the participant to listen to their recording and decide whether to rerecord or not. */
    allow_playback: {
      type: ParameterType.BOOL,
      default: false,
    },
    /** If `true`, then an Object URL will be generated and stored for the recorded audio. */
    save_audio_url: {
      type: ParameterType.BOOL,
      default: false,
    },
  },
  data: {
    /** The base64-encoded audio data. */
    response: {
      type: ParameterType.STRING,
    },
    /** The response time in milliseconds. */
    rt: {
      type: ParameterType.INT,
    },
    /** Estimate of when the stimulus appeared relative to the start of the audio recording. */
    estimated_stimulus_onset: {
      type: ParameterType.INT,
    },
    /** A URL to a copy of the audio data. */
    audio_url: {
      type: ParameterType.STRING,
    },
  },
};

/**
 * AudioResponseComponent
 *
 * Component for recording audio responses. Follows the "sketchpad pattern":
 * - Does NOT call finishTrial()
 * - Stores response data internally
 * - Exposes data via getters (getResponse(), getRT())
 * - Parent plugin orchestrates trial completion
 */
class AudioResponseComponent {
  private jsPsych: JsPsych;
  private recorder: MediaRecorder | null = null;
  private recorded_data_chunks: Blob[] = [];
  private rt: number | null = null;
  private response: string = "";
  private audio_url: string = "";
  private recorder_start_time: number = 0;
  private stimulus_start_time: number = 0;
  private load_resolver: (() => void) | null = null;
  private data_available_handler: ((e: BlobEvent) => void) | null = null;
  private stop_event_handler: (() => void) | null = null;
  private start_event_handler: ((e: Event) => void) | null = null;
  private buttonContainer: HTMLElement | null = null;

  static info = info;

  constructor(jsPsych: JsPsych) {
    this.jsPsych = jsPsych;
  }

  /**
   * Render the audio recording interface
   */
  async render(
    display_element: HTMLElement,
    trial: any,
    onResponse?: () => void
  ): Promise<void> {
    // Get the existing recorder (should be initialized by initialize-microphone plugin)
    this.recorder = this.jsPsych.pluginAPI.getMicrophoneRecorder();

    if (!this.recorder) {
      console.error(
        "Microphone recorder not initialized. Make sure to use the initialize-microphone plugin first."
      );
      display_element.innerHTML = `<p style="color: red;">Microphone not initialized. Please add the initialize-microphone plugin to your timeline.</p>`;
      return;
    }

    this.setupRecordingEvents(display_element, trial, onResponse);
    this.startRecording();
  }

  private setupRecordingEvents(
    display_element: HTMLElement,
    trial: any,
    onResponse?: () => void
  ): void {
    if (!this.recorder) return;

    this.data_available_handler = (e: BlobEvent) => {
      if (e.data.size > 0) {
        this.recorded_data_chunks.push(e.data);
      }
    };

    this.stop_event_handler = () => {
      const data = new Blob(this.recorded_data_chunks, {
        type: this.recorded_data_chunks[0]?.type || "audio/webm",
      });
      this.audio_url = URL.createObjectURL(data);

      const reader = new FileReader();
      reader.addEventListener("load", () => {
        const base64 = (reader.result as string).split(",")[1];
        this.response = base64;
        if (this.load_resolver) {
          this.load_resolver();
        }
      });
      reader.readAsDataURL(data);
    };

    this.start_event_handler = (e: Event) => {
      this.recorded_data_chunks = [];
      this.recorder_start_time = (e as any).timeStamp || performance.now();
      this.showDisplay(display_element, trial, onResponse);
    };

    this.recorder.addEventListener(
      "dataavailable",
      this.data_available_handler as EventListener
    );
    this.recorder.addEventListener(
      "stop",
      this.stop_event_handler as EventListener
    );
    this.recorder.addEventListener(
      "start",
      this.start_event_handler as EventListener
    );
  }

  private startRecording(): void {
    if (this.recorder) {
      this.recorder.start();
    }
  }

  private showDisplay(
    display_element: HTMLElement,
    trial: any,
    onResponse?: () => void
  ): void {
    // Mark when stimulus is shown (recording already started)
    this.stimulus_start_time = performance.now();

    // Create button container
    this.buttonContainer = document.createElement("div");
    this.buttonContainer.id = "jspsych-audio-response-buttons";
    this.buttonContainer.style.marginTop = "20px";

    if (trial.show_done_button !== false) {
      const doneButton = document.createElement("button");
      doneButton.className = "jspsych-btn";
      doneButton.id = "finish-trial";
      doneButton.textContent = trial.done_button_label || "Continue";

      doneButton.addEventListener("click", () => {
        const end_time = performance.now();
        this.rt = Math.round(end_time - this.stimulus_start_time);
        this.stopRecording().then(() => {
          if (trial.allow_playback) {
            this.showPlaybackControls(display_element, trial, onResponse);
          } else {
            if (onResponse) {
              onResponse();
            }
          }
        });
      });

      this.buttonContainer.appendChild(doneButton);
    }

    display_element.appendChild(this.buttonContainer);

    // Handle recording_duration timeout
    if (
      trial.recording_duration !== null &&
      trial.recording_duration !== undefined
    ) {
      this.jsPsych.pluginAPI.setTimeout(() => {
        if (this.recorder && this.recorder.state !== "inactive") {
          this.stopRecording().then(() => {
            if (trial.allow_playback) {
              this.showPlaybackControls(display_element, trial, onResponse);
            } else {
              if (onResponse) {
                onResponse();
              }
            }
          });
        }
      }, trial.recording_duration);
    }
  }

  private stopRecording(): Promise<void> {
    if (!this.recorder) {
      return Promise.resolve();
    }

    this.recorder.stop();
    return new Promise((resolve) => {
      this.load_resolver = resolve;
    });
  }

  private showPlaybackControls(
    display_element: HTMLElement,
    trial: any,
    onResponse?: () => void
  ): void {
    // Clear the button container
    if (this.buttonContainer) {
      this.buttonContainer.innerHTML = "";
    } else {
      this.buttonContainer = document.createElement("div");
      this.buttonContainer.id = "jspsych-audio-response-playback";
      display_element.appendChild(this.buttonContainer);
    }

    // Create playback interface
    const audioElement = document.createElement("audio");
    audioElement.id = "playback";
    audioElement.src = this.audio_url;
    audioElement.controls = true;
    audioElement.style.display = "block";
    audioElement.style.margin = "20px auto";

    const recordAgainButton = document.createElement("button");
    recordAgainButton.id = "record-again";
    recordAgainButton.className = "jspsych-btn";
    recordAgainButton.textContent =
      trial.record_again_button_label || "Record again";
    recordAgainButton.style.marginRight = "10px";

    const continueButton = document.createElement("button");
    continueButton.id = "continue";
    continueButton.className = "jspsych-btn";
    continueButton.textContent = trial.accept_button_label || "Continue";

    recordAgainButton.addEventListener("click", () => {
      URL.revokeObjectURL(this.audio_url);
      this.rt = null;
      this.response = "";

      // Clear and restart
      if (this.buttonContainer) {
        this.buttonContainer.innerHTML = "";
      }

      // Restart recording
      if (this.recorder) {
        this.recorder.start();
      }
    });

    continueButton.addEventListener("click", () => {
      if (onResponse) {
        onResponse();
      }
    });

    this.buttonContainer.appendChild(audioElement);
    this.buttonContainer.appendChild(recordAgainButton);
    this.buttonContainer.appendChild(continueButton);
  }

  getResponse(): any {
    return {
      response: this.response,
      audio_url: this.audio_url,
      estimated_stimulus_onset: Math.round(
        this.stimulus_start_time - this.recorder_start_time
      ),
    };
  }

  getRT(): number | null {
    return this.rt;
  }

  destroy(): void {
    if (this.recorder) {
      if (this.data_available_handler) {
        this.recorder.removeEventListener(
          "dataavailable",
          this.data_available_handler as EventListener
        );
      }
      if (this.stop_event_handler) {
        this.recorder.removeEventListener(
          "stop",
          this.stop_event_handler as EventListener
        );
      }
      if (this.start_event_handler) {
        this.recorder.removeEventListener(
          "start",
          this.start_event_handler as EventListener
        );
      }
    }

    // Clean up audio URL
    if (this.audio_url) {
      URL.revokeObjectURL(this.audio_url);
    }

    this.recorder = null;
  }
}

export default AudioResponseComponent;
