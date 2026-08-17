import { ParameterType } from "jspsych";
import {
  AudioClockSnapshot,
  getPreloadedAudioBuffer,
  sampleAudioClock,
  toContextTime,
} from "../utils/AudioTiming";

var version = "2.2.0";

const info = {
  name: "AudioComponent",
  version,
  parameters: {
    name: {
      type: ParameterType.STRING,
      default: undefined,
    },
    /** Path to audio file to be played. */
    stimulus: {
      type: ParameterType.AUDIO,
      default: void 0,
    },
    /** If true, show audio controls (play/pause/volume). */
    show_controls: {
      type: ParameterType.BOOL,
      default: false,
    },
    /** If true, audio will start playing as soon as it loads. */
    autoplay: {
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

const round3 = (value: number): number => Math.round(value * 1000) / 1000;

/**
 * AudioComponent - Renders and plays audio stimulus
 * This component only handles audio playback, not responses.
 *
 * When a usable WebAudio AudioContext and a pre-decoded AudioBuffer are
 * available, playback is scheduled on the AudioContext clock with an
 * explicit target time translated from the performance-domain trial origin.
 * Otherwise playback falls back to the jsPsych HTMLAudio player and is
 * labeled timing-degraded.
 */
class AudioComponent {
  private jsPsych: any;
  private audio: any = null;
  private element: HTMLElement | null = null;
  private context: any = null;
  private timedSource: AudioBufferSourceNode | null = null;
  private timedBuffer: AudioBuffer | null = null;
  private timedEnded = false;
  private autoplayAttemptFailed = false;
  private diagnostics: Record<string, any> = {};

  constructor(jsPsych: any) {
    this.jsPsych = jsPsych;
    this.context = this.jsPsych.pluginAPI.audioContext();
  }

  static info = info;

  /**
   * Render and play the audio
   * @param container - The HTML element to render into
   * @param config - Configuration for the audio
   * @returns The rendered audio element (if controls are shown)
   */
  async render(
    container: HTMLElement,
    config: any
  ): Promise<HTMLElement | null> {
    // Get audio player from jsPsych (fallback/legacy path)
    this.audio = await this.jsPsych.pluginAPI.getAudioPlayer(config.stimulus);

    // Only create visible element if controls are requested
    if (config.show_controls) {
      const audioElement = document.createElement("div");
      audioElement.id = config.name
        ? `jspsych-dynamic-${config.name}-stimulus`
        : "jspsych-dynamic-audio-stimulus";
      audioElement.className = "dynamic-audio-component";

      // Add basic audio controls display
      audioElement.innerHTML = `
        <div class="audio-controls">
          <span>🔊 Audio playing</span>
        </div>
      `;

      container.appendChild(audioElement);
      this.element = audioElement;
    }

    // Timed WebAudio path: use a pre-decoded buffer when available
    // (preloadAssets decodes into the AudioTiming cache before
    // presentation). When the cache is cold, playback falls back to the
    // HTMLAudio player instead of decoding in the presentation path.
    if (this.context && typeof this.context.decodeAudioData === "function") {
      this.timedBuffer = getPreloadedAudioBuffer(
        this.context,
        config.stimulus,
      );
    }

    // Start playback if autoplay is enabled - default to true
    const shouldAutoplay =
      config.autoplay !== undefined ? config.autoplay : true;
    if (shouldAutoplay && this.audio) {
      const playAudio = async () => {
        try {
          await this.audio.play();
          this.diagnostics = {
            audio_clock_bridge_available: false,
            audio_clock_bridge_source: "",
            audio_backend: "htmlaudio_fallback",
            audio_timing_degraded: true,
            audio_timing_degraded_reason:
              "html_audio_presentation_unobservable",
            physical_audio_onset_abs: null,
          };
        } catch (error) {
          console.warn("Audio autoplay failed:", error);
          this.autoplayAttemptFailed = true;
          this.diagnostics = {
            audio_clock_bridge_available: false,
            audio_clock_bridge_source: "",
            audio_backend: "htmlaudio_fallback",
            audio_timing_degraded: true,
            audio_timing_degraded_reason: "autoplay_policy_blocked",
            physical_audio_onset_abs: null,
          };
          // If autoplay fails, could show controls or notify user
          if (this.element) {
            this.element.innerHTML = `
              <div class="audio-controls">
                <button onclick="this.parentElement.parentElement.click()">Click to play audio</button>
              </div>
            `;
            this.element.addEventListener(
              "click",
              () => {
                this.play();
              },
              { once: true }
            );
          }
        }
      };

      if (config.__timing) {
        config.__timing.onStart((timestamp: number) => {
          if (this.timedBuffer && this.context) {
            this.scheduleTimedPlayback(timestamp);
          } else {
            void playAudio();
          }
        });
      } else {
        await playAudio();
      }
    }

    return this.element;
  }

  /**
   * Schedule the decoded buffer on the AudioContext clock with an explicit
   * target context time translated from the performance-domain origin.
   * Late targets are clamped to the current context time and the lateness
   * is recorded. This is clock bridging, not physical audio-onset
   * confirmation.
   */
  private scheduleTimedPlayback(performanceTargetMs: number) {
    const context = this.context as AudioContext;
    const buffer = this.timedBuffer as AudioBuffer;
    const snapshot: AudioClockSnapshot = sampleAudioClock(context);
    const targetContextTime = toContextTime(performanceTargetMs, snapshot);

    let scheduledContextTime = targetContextTime;
    let lateByMs = 0;
    if (targetContextTime < context.currentTime) {
      lateByMs = (context.currentTime - targetContextTime) * 1000;
      scheduledContextTime = context.currentTime;
    }

    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(context.destination);
    source.onended = () => {
      this.timedEnded = true;
    };
    source.start(scheduledContextTime);
    this.timedSource = source;

    // Known fixed duration: schedule the stop on the audio clock instead of
    // a JS timer.
    if (
      typeof buffer.duration === "number" &&
      Number.isFinite(buffer.duration) &&
      buffer.duration > 0
    ) {
      source.stop(scheduledContextTime + buffer.duration);
    }

    this.diagnostics = {
      audio_clock_bridge_available: true,
      audio_clock_bridge_source: snapshot.source,
      audio_context_snapshot_time: round3(snapshot.contextTime),
      audio_performance_snapshot_time: round3(snapshot.performanceTime),
      audio_base_latency_ms: round3(snapshot.baseLatency * 1000),
      audio_requested_performance_time: round3(performanceTargetMs),
      audio_target_context_time: round3(targetContextTime),
      audio_scheduled_context_time: round3(scheduledContextTime),
      audio_schedule_late_by_ms: round3(lateByMs),
      audio_backend: "webaudio_scheduled",
      audio_timing_degraded: false,
      audio_timing_degraded_reason: "",
      physical_audio_onset_abs: null,
    };
  }

  /**
   * Play the audio
   */
  play() {
    if (this.timedSource && this.context) {
      if (this.context.state !== "running" && typeof this.context.resume === "function") {
        void this.context.resume();
      }
      return;
    }
    if (this.audio) {
      this.audio.play();
    }
  }

  /**
   * Pause the audio
   */
  pause() {
    if (this.audio) {
      this.audio.pause();
    }
  }

  /**
   * Stop the audio
   */
  stop() {
    if (this.timedSource) {
      try {
        this.timedSource.stop();
      } catch {
        // Source may already be stopped by its scheduled end.
      }
      this.timedSource = null;
      this.timedEnded = true;
    }
    if (this.audio) {
      this.audio.stop();
    }
  }

  /**
   * Add event listener for audio events
   */
  addEventListener(event: string, callback: () => void) {
    if (this.audio) {
      this.audio.addEventListener(event, callback);
    }
  }

  /**
   * Remove event listener
   */
  removeEventListener(event: string, callback: () => void) {
    if (this.audio) {
      this.audio.removeEventListener(event, callback);
    }
  }

  /**
   * Check if audio has ended
   */
  hasEnded(): boolean {
    if (this.timedSource) {
      return this.timedEnded;
    }
    return this.audio ? this.audio.ended : true;
  }

  /**
   * Remove the audio element from DOM and clean up
   */
  destroy() {
    if (this.timedSource) {
      try {
        this.timedSource.stop();
      } catch {
        // already stopped
      }
      this.timedSource = null;
    }
    this.timedBuffer = null;
    if (this.audio) {
      this.audio.stop();
    }
    if (this.element && this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
    this.element = null;
    this.audio = null;
  }

  /**
   * Get the audio player instance (legacy jsPsych AudioPlayer contract).
   */
  getAudio() {
    return this.audio;
  }

  /**
   * Audio timing diagnostics for the trial.
   */
  getDiagnostics(): Record<string, any> {
    if (this.autoplayAttemptFailed) {
      return {
        ...this.diagnostics,
        audio_timing_degraded: true,
        audio_timing_degraded_reason: "autoplay_policy_blocked",
        physical_audio_onset_abs: null,
      };
    }
    return this.diagnostics;
  }
}

export { AudioComponent as default };
