import { ParameterType } from "jspsych";

var version = "2.1.0";

const info = {
  name: "AudioComponent",
  version,
  parameters: {
    /** Path to audio file to be played. */
    stimulus_audio: {
      type: ParameterType.AUDIO,
      default: void 0,
    },
    /** If true, show audio controls (play/pause/volume). */
    show_controls_audio: {
      type: ParameterType.BOOL,
      default: false,
    },
    /** If true, audio will start playing as soon as it loads. */
    autoplay_audio: {
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

/**
 * AudioComponent - Renders and plays audio stimulus
 * This component only handles audio playback, not responses
 */
class AudioComponent {
  private jsPsych: any;
  private audio: any = null;
  private element: HTMLElement | null = null;
  private context: any = null;

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
    // Get audio player from jsPsych
    this.audio = await this.jsPsych.pluginAPI.getAudioPlayer(
      config.stimulus_audio
    );

    // Only create visible element if controls are requested
    if (config.show_controls_audio) {
      const audioElement = document.createElement("div");
      audioElement.id = "jspsych-dynamic-audio-component";
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

    // Start playback if autoplay is enabled
    if (config.autoplay_audio) {
      this.play();
    }

    return this.element;
  }

  /**
   * Play the audio
   */
  play() {
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
    return this.audio ? this.audio.ended : true;
  }

  /**
   * Remove the audio element from DOM and clean up
   */
  destroy() {
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
   * Get the audio player instance
   */
  getAudio() {
    return this.audio;
  }
}

export { AudioComponent as default };
