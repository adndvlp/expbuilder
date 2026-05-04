import { ParameterType } from "jspsych";

var version = "2.2.0";

const info = {
  name: "ImageComponent",
  version,
  parameters: {
    name: {
      type: ParameterType.STRING,
      default: undefined,
    },
    /** The path of the image file to be displayed. */
    stimulus: {
      type: ParameterType.IMAGE,
      default: void 0,
    },
    /** Set the height of the image in pixels. If left null (no value specified), then the image will display at its natural height. */
    height: {
      type: ParameterType.INT,
      default: null,
    },
    /** Set the width of the image in pixels. If left null (no value specified), then the image will display at its natural width. */
    width: {
      type: ParameterType.INT,
      default: null,
    },
    /** If setting *only* the width or *only* the height and this parameter is true, then the other dimension will be
     * scaled to maintain the image's aspect ratio.  */
    maintain_aspect_ratio: {
      type: ParameterType.BOOL,
      default: true,
    },

    /** Delay in milliseconds before showing the stimulus. If null, the stimulus appears immediately. */
    stimulus_onset: {
      type: ParameterType.INT,
      default: null,
    },
    /** How long to show the stimulus for in milliseconds. If null, the stimulus stays visible for the whole trial. */
    stimulus_duration: {
      type: ParameterType.INT,
      default: null,
    },
    /** Position coordinates for the image */
    coordinates: {
      type: ParameterType.OBJECT,
      pretty_name: "Coordinates",
      default: { x: 0, y: 0 },
      description: "Object with x and y properties for absolute positioning",
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
 * ImageComponent - Renders an image stimulus
 * This component only handles image display, not responses
 */
class ImageComponent {
  private jsPsych: any;
  private element: HTMLElement | null = null;
  private onsetTimeout: number | null = null;
  private hideTimeout: number | null = null;

  constructor(jsPsych: any) {
    this.jsPsych = jsPsych;
  }

  static info = info;

  /**
   * Render the image to the display element
   * @param container - The HTML element to render into
   * @param config - Configuration for the image
   * @returns The rendered stimulus element
   */
  render(container: HTMLElement, config: any): HTMLElement {
    // Design canvas dimensions (same as Konva CANVAS_WIDTH/HEIGHT)
    const canvasWidth = config.__canvasStyles?.width ?? 1024;
    const canvasHeight = config.__canvasStyles?.height ?? 768;

    // Always use absolute positioning for proper overlapping
    const usePositioning = config.coordinates !== undefined;

    // Create positioning container
    let imageContainer: HTMLElement;
    if (usePositioning) {
      imageContainer = document.createElement("div");
      imageContainer.style.position = "absolute";

      // Convert jsPsych coords [-100..100] to design-canvas pixels
      // (same formula as fromJsPsychCoords in Konva)
      const centerX = canvasWidth / 2;
      const centerY = canvasHeight / 2;

      if (config.coordinates.x !== undefined) {
        const xPixel = centerX + (config.coordinates.x / 100) * (canvasWidth / 2);
        imageContainer.style.left = xPixel + "px";
      } else {
        imageContainer.style.left = centerX + "px";
      }
      if (config.coordinates.y !== undefined) {
        const yPixel = centerY - (config.coordinates.y / 100) * (canvasHeight / 2);
        imageContainer.style.top = yPixel + "px";
      } else {
        imageContainer.style.top = centerY + "px";
      }
      imageContainer.style.transform = "translate(-50%, -50%)";

      container.appendChild(imageContainer);
    } else {
      imageContainer = container;
    }

    const calculateImageDimensions = (
      image: HTMLImageElement,
    ): [number, number] => {
      let width: number;
      let height: number;

      if (config.height !== null) {
        height = config.height;
        if (config.width == null && config.maintain_aspect_ratio) {
          width = image.naturalWidth * (config.height / image.naturalHeight);
        } else {
          width = image.naturalWidth;
        }
      } else {
        height = image.naturalHeight;
        width = image.naturalWidth;
      }

      if (config.width !== null) {
        width = config.width;
        if (config.height == null && config.maintain_aspect_ratio) {
          height = image.naturalHeight * (config.width / image.naturalWidth);
        }
      }

      return [width, height];
    };

    let stimulusElement: HTMLElement;
    let canvas: HTMLCanvasElement | null = null;
    const image = config.render_on_canvas
      ? new Image()
      : document.createElement("img");

    // Add ID to image element for WebGazer tracking
    if (!config.render_on_canvas) {
      (image as HTMLImageElement).id = config.name
        ? `jspsych-dynamic-${config.name}-stimulus`
        : "jspsych-dynamic-image-stimulus";
      (image as HTMLImageElement).className = "dynamic-image-component";
    }

    if (config.render_on_canvas) {
      canvas = document.createElement("canvas");
      canvas.id = config.name
        ? `jspsych-dynamic-${config.name}-stimulus`
        : "jspsych-dynamic-image-stimulus";
      canvas.className = "dynamic-image-component";
      canvas.style.margin = "0";
      canvas.style.padding = "0";
      stimulusElement = canvas;
    } else {
      stimulusElement = image as HTMLImageElement;
    }

    const drawImage = () => {
      const img = image as HTMLImageElement;
      if (config.render_on_canvas && canvas) {
        // Canvas path: dimensions in design-canvas pixels
        const pxW =
          config.width !== null
            ? (config.width / 100) * canvasWidth
            : img.naturalWidth;
        const pxH = img.naturalHeight * (pxW / img.naturalWidth);
        canvas.width = pxW;
        canvas.height = pxH;
        const ctx = canvas.getContext("2d");
        if (ctx) ctx.drawImage(img, 0, 0, pxW, pxH);
      } else {
        // img path: dimensions in design-canvas pixels
        if (config.width !== null) {
          const pxW = (config.width / 100) * canvasWidth;
          (stimulusElement as HTMLImageElement).style.width = pxW + "px";
        }
        if (config.height !== null) {
          const pxH = (config.height / 100) * canvasWidth;
          (stimulusElement as HTMLImageElement).style.height = pxH + "px";
        }
        if (config.width !== null && config.height === null) {
          (stimulusElement as HTMLImageElement).style.height = "auto";
        } else if (config.height !== null && config.width === null) {
          (stimulusElement as HTMLImageElement).style.width = "auto";
        }
      }
    };

    let hasImageBeenDrawn = false;
    (image as HTMLImageElement).onload = () => {
      if (!hasImageBeenDrawn) {
        drawImage();
        hasImageBeenDrawn = true;
      }
    };

    (image as HTMLImageElement).src = config.stimulus;

    if (
      (image as HTMLImageElement).complete &&
      (image as HTMLImageElement).naturalWidth !== 0
    ) {
      drawImage();
      hasImageBeenDrawn = true;
    }

    imageContainer.appendChild(stimulusElement);

    // Resolve onset and duration
    const resolveMs = (raw: any): number | null => {
      if (raw === null || raw === undefined) return null;
      if (typeof raw === "object" && "value" in raw) return raw.value ?? null;
      return raw;
    };
    const stimulusOnset = resolveMs(config.stimulus_onset);
    const stimulusDuration = resolveMs(config.stimulus_duration);

    if (stimulusOnset !== null) {
      stimulusElement.style.visibility = "hidden";
      this.onsetTimeout = this.jsPsych.pluginAPI.setTimeout(() => {
        if (this.element) this.element.style.visibility = "visible";
      }, stimulusOnset);
    }
    if (stimulusDuration !== null) {
      const hideAt = (stimulusOnset ?? 0) + stimulusDuration;
      this.hideTimeout = this.jsPsych.pluginAPI.setTimeout(() => {
        this.hide();
      }, hideAt);
    }

    this.element = stimulusElement;
    return stimulusElement;
  }

  /**
   * Hide the image stimulus
   */
  hide() {
    if (this.element) {
      this.element.style.visibility = "hidden";
    }
  }

  /**
   * Show the image stimulus (if it was hidden)
   */
  show() {
    if (this.element) {
      this.element.style.visibility = "visible";
    }
  }

  /**
   * Remove the image from DOM and clean up
   */
  destroy() {
    if (this.onsetTimeout !== null) {
      clearTimeout(this.onsetTimeout);
    }
    if (this.hideTimeout !== null) {
      clearTimeout(this.hideTimeout);
    }
    if (this.element && this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
    this.element = null;
  }

  /**
   * Get the rendered element
   */
  getElement(): HTMLElement | null {
    return this.element;
  }
}

export { ImageComponent as default };
