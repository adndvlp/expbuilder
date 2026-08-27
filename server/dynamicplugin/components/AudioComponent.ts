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
   * The no-controls precision path requires the decoded buffer and never
   * constructs an HTMLAudio player.
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
  private config: any = null;
  private prepared = false;
  private armed = false;
  private playbackRequested = false;
  private resourceReadyAt: number | null = null;
  private scheduledPerformanceTarget: number | null = null;
  private audioRearmCount = 0;

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
  prepare(
    container: HTMLElement,
    config: any,
  ): HTMLElement | null | Promise<HTMLElement | null> {
    this.config = config;
    this.prepared = false;
    this.armed = false;
    this.playbackRequested = false;
    this.scheduledPerformanceTarget = null;
    this.audioRearmCount = 0;
    this.audio = null;
    this.timedBuffer =
      this.context && typeof this.context.decodeAudioData === "function"
        ? getPreloadedAudioBuffer(this.context, config.stimulus)
        : null;
    if (this.timedBuffer) this.resourceReadyAt = performance.now();

    if (config.show_controls !== true) {
      this.prepared = true;
      return null;
    }

    return Promise.resolve(
      this.jsPsych.pluginAPI.getAudioPlayer(config.stimulus),
    ).then((audio) => {
      this.audio = audio;
      this.resourceReadyAt ??= performance.now();
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
      this.prepared = true;
      return this.element;
    });
  }

  getPrecisionReadiness() {
    const shouldAutoplay =
      this.config?.autoplay !== undefined ? this.config.autoplay : true;
    const webAudioReady = !!this.context && !!this.timedBuffer;
    const requiresControls = this.config?.show_controls === true;
    const ready =
      this.prepared &&
      (requiresControls
        ? !!this.audio && (!shouldAutoplay || webAudioReady)
        : !shouldAutoplay || webAudioReady);
    return {
      ready,
      reason: ready
        ? shouldAutoplay
          ? "decoded_webaudio_buffer_ready"
          : "audio_autoplay_disabled"
        : "audio_not_ready_for_atomic_onset",
      fallbackReason: ready ? "" : "decoded_webaudio_buffer_unavailable",
      resourceReadyAt: this.resourceReadyAt,
      gpuReadyAt: null,
    };
  }

  getResourceReadinessState(config?: any) {
    if (config?.show_controls === true) {
      return {
        resourceReady: false,
        gpuResourceReady: true,
        runtimeMaterializationCostEstimateMs: null,
      };
    }
    const buffer =
      this.context && typeof this.context.decodeAudioData === "function"
        ? getPreloadedAudioBuffer(this.context, config?.stimulus)
        : null;
    return {
      resourceReady: buffer !== null,
      gpuResourceReady: true,
      runtimeMaterializationCostEstimateMs: buffer ? 0.5 : null,
    };
  }

  /** Standalone lifecycle entry point; timing authority is still mandatory. */
  async render(
    container: HTMLElement,
    config: any,
  ): Promise<HTMLElement | null> {
    const element = await this.prepare(container, config);
    this.arm();
    if (!config.__timing?.isGlobalFrameEngine?.()) {
      throw new Error("AudioComponent requires the global FrameEngine timing authority.");
    }
    config.__timing.onStart((timestamp: number) => {
      this.activate({ timestamp });
    });
    return element;
  }

  arm(
    info: {
      scheduledTimestamp?: number | null;
      predictedSelectedFrameTime?: number | null;
    } = {},
  ) {
    if (!this.prepared) return;
    this.armed = true;

    const idealTarget = info.scheduledTimestamp;
    const predictedTarget = info.predictedSelectedFrameTime;
    const target =
      typeof predictedTarget === "number" && Number.isFinite(predictedTarget)
        ? predictedTarget
        : idealTarget;
    this.config?.__timing?.setNextAudioDeadline?.(
      typeof target === "number" ? target : null,
    );
    const shouldAutoplay =
      this.config?.autoplay !== undefined ? this.config.autoplay : true;
    const armNow = performance.now();
    if (
      !this.playbackRequested &&
      shouldAutoplay &&
      this.timedBuffer &&
      this.context &&
      typeof target === "number" &&
      Number.isFinite(target) &&
      target > armNow
    ) {
      this.playbackRequested = true;
      this.scheduleTimedPlayback(target);
      this.config?.__timing?.setNextAudioDeadline?.(null);
      this.diagnostics.audio_prearmed = true;
      this.diagnostics.audio_arm_lead_ms = round3(target - armNow);
      this.diagnostics.audio_requested_ideal_performance_time =
        typeof idealTarget === "number" ? round3(idealTarget) : null;
      this.diagnostics.audio_predicted_selected_frame_time = round3(target);
      this.diagnostics.audio_rearmed = this.audioRearmCount > 0;
      this.diagnostics.audio_rearm_count = this.audioRearmCount;
      return;
    }

    if (
      this.playbackRequested &&
      this.timedSource &&
      typeof target === "number" &&
      Number.isFinite(target) &&
      this.scheduledPerformanceTarget !== null &&
      Math.abs(target - this.scheduledPerformanceTarget) > 0.001
    ) {
      const previousTarget = this.scheduledPerformanceTarget;
      this.cancelTimedSource();
      this.playbackRequested = false;
      this.audioRearmCount += 1;
      if (target > armNow) {
        this.playbackRequested = true;
        this.scheduleTimedPlayback(target);
        this.config?.__timing?.setNextAudioDeadline?.(null);
        this.diagnostics.audio_prearmed = true;
        this.diagnostics.audio_arm_lead_ms = round3(target - armNow);
        this.diagnostics.audio_requested_ideal_performance_time =
          typeof idealTarget === "number" ? round3(idealTarget) : null;
        this.diagnostics.audio_predicted_selected_frame_time = round3(target);
        this.diagnostics.audio_rearmed = true;
        this.diagnostics.audio_rearm_count = this.audioRearmCount;
        this.diagnostics.audio_previous_requested_performance_time =
          round3(previousTarget);
      }
    }
  }

  activate({ timestamp }: { timestamp: number }) {
    const config = this.config;
    const shouldAutoplay =
      config?.autoplay !== undefined ? config.autoplay : true;
    if (
      !this.prepared ||
      !this.armed ||
      this.playbackRequested ||
      !shouldAutoplay ||
      (!this.timedBuffer && !this.audio)
    ) {
      return;
    }
    this.playbackRequested = true;
    if (this.timedBuffer && this.context) {
      this.scheduleTimedPlayback(timestamp);
      this.config?.__timing?.setNextAudioDeadline?.(null);
      this.diagnostics.audio_prearmed = false;
      this.diagnostics.audio_arm_lead_ms = 0;
    } else {
      void this.playFallback();
    }
  }

  deactivate() {
    this.stop();
  }

  private async playFallback() {
    try {
      await this.audio.play();
      this.diagnostics = {
        audio_clock_bridge_available: false,
        audio_clock_bridge_source: "",
        audio_backend: "htmlaudio_fallback",
        audio_timing_degraded: true,
        audio_timing_degraded_reason: "html_audio_presentation_unobservable",
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
          { once: true },
        );
      }
    }
  }

  private cancelTimedSource() {
    if (!this.timedSource) return;
    this.timedSource.onended = null;
    try {
      this.timedSource.stop();
    } catch {
      // A source whose stop was already committed cannot be rescheduled.
    }
    this.timedSource = null;
    this.timedEnded = false;
    this.scheduledPerformanceTarget = null;
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
    this.scheduledPerformanceTarget = performanceTargetMs;

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
      audio_rearmed: this.audioRearmCount > 0,
      audio_rearm_count: this.audioRearmCount,
    };
  }

  /**
   * Play the audio
   */
  play() {
    if (this.timedSource && this.context) {
      if (
        this.context.state !== "running" &&
        typeof this.context.resume === "function"
      ) {
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
    this.config = null;
    this.prepared = false;
    this.armed = false;
    this.playbackRequested = false;
    this.resourceReadyAt = null;
    this.scheduledPerformanceTarget = null;
    this.audioRearmCount = 0;
  }

  /** Get the optional AudioPlayer used only by the controls-based DOM path. */
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
