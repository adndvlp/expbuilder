import { ParameterType } from "jspsych";

var version = "2.2.0";

const info = {
  name: "ImageComponent",
  version,
  parameters: {
    /** The path of the image file to be displayed. */
    stimulus_image: {
      type: ParameterType.IMAGE,
      default: void 0,
    },
    /** Set the height of the image in pixels. If left null (no value specified), then the image will display at its natural height. */
    height_image: {
      type: ParameterType.INT,
      default: null,
    },
    /** Set the width of the image in pixels. If left null (no value specified), then the image will display at its natural width. */
    width_image: {
      type: ParameterType.INT,
      default: null,
    },
    /** If setting *only* the width or *only* the height and this parameter is true, then the other dimension will be
     * scaled to maintain the image's aspect ratio.  */
    maintain_aspect_ratio_image: {
      type: ParameterType.BOOL,
      default: true,
    },

    /** How long to show the stimulus for in milliseconds. If the value is null, then the stimulus will be shown until
     * the participant makes a response. */
    stimulus_duration_image: {
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
    // Helper function to map coordinate values
    const mapValue = (value: number): number => {
      if (value > 1) return 50;
      if (value < -1) return -50;
      return value * 50;
    };

    // Check if positioning is needed
    const usePositioning =
      config.coordinates &&
      (config.coordinates.x !== 0 || config.coordinates.y !== 0);

    // Create positioning container if needed
    let imageContainer: HTMLElement;
    if (usePositioning) {
      const mainContainer = document.createElement("div");
      mainContainer.style.position = "relative";
      mainContainer.style.margin = "0 auto";

      imageContainer = document.createElement("div");
      imageContainer.style.position = "relative";

      if (config.coordinates.x !== undefined) {
        const xValue = mapValue(config.coordinates.x);
        imageContainer.style.left = `${xValue}vw`;
      }
      if (config.coordinates.y !== undefined) {
        const yValue = mapValue(config.coordinates.y);
        imageContainer.style.top = `${yValue}vh`;
      }

      mainContainer.appendChild(imageContainer);
      container.appendChild(mainContainer);
    } else {
      imageContainer = container;
    }

    const calculateImageDimensions = (
      image: HTMLImageElement
    ): [number, number] => {
      let width: number;
      let height: number;

      if (config.height_image !== null) {
        height = config.height_image;
        if (config.width_image == null && config.maintain_aspect_ratio_image) {
          width =
            image.naturalWidth * (config.height_image / image.naturalHeight);
        } else {
          width = image.naturalWidth;
        }
      } else {
        height = image.naturalHeight;
        width = image.naturalWidth;
      }

      if (config.width_image !== null) {
        width = config.width_image;
        if (config.height_image == null && config.maintain_aspect_ratio_image) {
          height =
            image.naturalHeight * (config.width_image / image.naturalWidth);
        }
      }

      return [width, height];
    };

    let stimulusElement: HTMLElement;
    let canvas: HTMLCanvasElement | null = null;
    const image = config.render_on_canvas_image
      ? new Image()
      : document.createElement("img");

    if (config.render_on_canvas_image) {
      canvas = document.createElement("canvas");
      canvas.style.margin = "0";
      canvas.style.padding = "0";
      stimulusElement = canvas;
    } else {
      stimulusElement = image as HTMLImageElement;
    }

    const drawImage = () => {
      const [width, height] = calculateImageDimensions(
        image as HTMLImageElement
      );

      if (config.render_on_canvas_image && canvas) {
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(image as HTMLImageElement, 0, 0, width, height);
        }
      } else {
        (stimulusElement as HTMLImageElement).style.width = `${width}px`;
        (stimulusElement as HTMLImageElement).style.height = `${height}px`;
      }
    };

    let hasImageBeenDrawn = false;
    (image as HTMLImageElement).onload = () => {
      if (!hasImageBeenDrawn) {
        drawImage();
        hasImageBeenDrawn = true;
      }
    };

    (image as HTMLImageElement).src = config.stimulus_image;

    if (
      (image as HTMLImageElement).complete &&
      (image as HTMLImageElement).naturalWidth !== 0
    ) {
      drawImage();
      hasImageBeenDrawn = true;
    }

    stimulusElement.id = "jspsych-dynamic-image-component";
    stimulusElement.className = "dynamic-image-component";
    imageContainer.appendChild(stimulusElement);

    // Handle stimulus duration
    if (config.stimulus_duration_image !== null) {
      this.hideTimeout = this.jsPsych.pluginAPI.setTimeout(() => {
        this.hide();
      }, config.stimulus_duration_image);
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
