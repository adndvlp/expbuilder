import { ParameterType } from "jspsych";

var version = "0.4.0";

const info = {
  name: "multi-image-keyboard-response",
  version,
  parameters: {
    stimulus: {
      type: ParameterType.COMPLEX,
      array: true,
      pretty_name: "Stimulus",
      default: undefined,
      description: "Array of image objects with parameters",
    },
    /** Set the height of the images in pixels. If left null (no value specified), then the images will display at their natural height. */
    stimulus_height: {
      type: ParameterType.INT,
      default: null,
    },
    /** Set the width of the images in pixels. If left null (no value specified), then the images will display at their natural width. */
    stimulus_width: {
      type: ParameterType.INT,
      default: null,
    },
    /** If setting *only* the width or *only* the height and this parameter is true, then the other dimension will be scaled
     * to maintain the image's aspect ratio. */
    maintain_aspect_ratio: {
      type: ParameterType.BOOL,
      default: true,
    },
    /** Position coordinates for the images */
    coordinates: {
      type: ParameterType.OBJECT,
      pretty_name: "Coordinates",
      default: { x: 0, y: 0 },
      description: "Object with x and y properties for absolute positioning",
    },
    /** How long to show the stimulus for in milliseconds. If the value is `null`, then the stimulus will be shown until the
     * participant makes a response. */
    stimulus_duration: {
      type: ParameterType.INT,
      pretty_name: "Stimulus duration",
      default: null,
      description:
        "How long to show the stimulus for in milliseconds. If null, stimulus are shown until response.",
    },
    /** How long to wait for the participant to make a response before ending the trial in milliseconds. If the participant
     * fails to make a response before this timer is reached, the participant's response will be recorded as null for the
     * trial and the trial will end. If the value of this parameter is `null`, then the trial will wait for a response indefinitely. */
    trial_duration: {
      type: ParameterType.INT,
      default: null,
    },
    /** If true, then the trial will end whenever the participant makes a response (assuming they make their response before
     * the cutoff specified by the `trial_duration` parameter). If false, then the trial will continue until the value for
     * `trial_duration` is reached. */
    response_ends_trial: {
      type: ParameterType.BOOL,
      pretty_name: "Response ends trial",
      default: true,
      description: "If true, trial will end when user makes a response.",
    },
    /** This string can contain HTML markup. Any content here will be displayed below the stimulus. */
    prompt: {
      type: ParameterType.HTML_STRING,
      pretty_name: "Prompt",
      default: null,
      description: "Any content here will be displayed below the stimulus.",
    },
    /** This array contains the key(s) that the participant is allowed to press in order to respond to the stimulus. */
    choices: {
      type: ParameterType.KEYS,
      pretty_name: "Key choices",
      default: "ALL_KEYS",
      description: "Keys that can be pressed to end the trial.",
    },
    /**
     * If `true`, the images will be drawn onto canvas elements. This prevents a blank screen (white flash) between consecutive image trials in some browsers.
     * If `false`, the images will be shown via img elements. If any stimulus is an **animated gif**, you must set this parameter to false.
     */
    render_on_canvas: {
      type: ParameterType.BOOL,
      default: true,
    },
  },
  data: {
    /** The stimulus that were displayed. */
    stimulus: {
      type: ParameterType.COMPLEX,
    },
    /** Indicates which key the participant pressed. */
    response: {
      type: ParameterType.STRING,
    },
    /** The response time in milliseconds for the participant to make a response. */
    rt: {
      type: ParameterType.INT,
    },
    /** Position coordinates used for the trial */
    coordinates: {
      type: ParameterType.OBJECT,
    },
    /** Total number of stimulus displayed */
    total_stimulus: {
      type: ParameterType.INT,
    },
  },
};

/**
 * **multi-image-stimulus**
 *
 * jsPsych plugin for displaying multiple images simultaneously with coordinate positioning
 */
class MultiImageKeyboardResponsePlugin {
  constructor(jsPsych) {
    this.jsPsych = jsPsych;
  }

  static {
    this.info = info;
  }

  trial(display_element, trial) {
    // Clear display
    if (display_element.hasChildNodes()) {
      while (display_element.firstChild) {
        display_element.removeChild(display_element.firstChild);
      }
    }

    // Create main container for all content
    const main_container = document.createElement("div");
    main_container.classList.add("jspsych-multi-image-stimulus-main");
    main_container.style.position = "relative";
    main_container.style.margin = "0 auto";

    // Process all stimulus
    trial.stimulus.forEach((stim, index) => {
      // Create container for each stimulus
      const stim_container = document.createElement("div");
      stim_container.classList.add("jspsych-multi-image-stimulus-item");
      stim_container.dataset.index = index;
      stim_container.style.position = "relative";

      // Use individual stimulus coordinates if available, otherwise use trial coordinates
      const stimCoordinates =
        stim.coordinates !== undefined ? stim.coordinates : trial.coordinates;

      // Apply coordinates using the same mapping as image-keyboard-response
      if (
        stimCoordinates &&
        (stimCoordinates.x !== 0 || stimCoordinates.y !== 0)
      ) {
        const mapValue = (value) => {
          if (value > 1) return 50;
          if (value < -1) return -50;
          return value * 50;
        };

        if (stimCoordinates.x !== undefined) {
          const mappedX = mapValue(stimCoordinates.x);
          stim_container.style.left = `${mappedX}vw`;
        }
        if (stimCoordinates.y !== undefined) {
          const mappedY = mapValue(stimCoordinates.y);
          stim_container.style.top = `${mappedY}vh`;
        }
      }

      // Apply z-index if provided
      if (stim.zIndex !== undefined) {
        stim_container.style.zIndex = stim.zIndex;
      }

      // Create image element based on render_on_canvas setting
      if (trial.render_on_canvas) {
        this.createCanvasImage(stim, stim_container, trial, index);
      } else {
        this.createImgElement(stim, stim_container, trial, index);
      }

      // Add additional HTML if specified
      if (stim.additional_html) {
        const additionalElement = document.createElement("div");
        additionalElement.innerHTML = stim.additional_html;
        additionalElement.style.textAlign = "center";
        additionalElement.style.marginTop = "10px";
        stim_container.appendChild(additionalElement);
      }

      main_container.appendChild(stim_container);
    });

    // Add prompt if provided
    if (trial.prompt !== null) {
      const promptElement = document.createElement("div");
      promptElement.innerHTML = trial.prompt;
      promptElement.classList.add("jspsych-multi-image-stimulus-prompt");
      promptElement.style.textAlign = "center";
      promptElement.style.marginTop = "20px";
      promptElement.style.fontSize = "18px";
      main_container.appendChild(promptElement);
    }

    // Add container to display
    display_element.appendChild(main_container);

    // Response handling
    var response = {
      rt: null,
      key: null,
    };

    const end_trial = () => {
      if (typeof keyboardListener !== "undefined") {
        this.jsPsych.pluginAPI.cancelKeyboardResponse(keyboardListener);
      }
      this.jsPsych.pluginAPI.clearAllTimeouts();

      // Clear display
      display_element.innerHTML = "";

      // Gather trial data
      const trial_data = {
        stimulus: trial.stimulus,
        response: response.key,
        rt: response.rt,
        coordinates: trial.coordinates
          ? `x: ${trial.coordinates.x}vw, y: ${trial.coordinates.y}vh`
          : "x: 0vw, y: 0vh",
        total_stimulus: trial.stimulus.length,
      };

      // Move on to the next trial
      this.jsPsych.finishTrial(trial_data);
    };

    const after_response = (info) => {
      // Add responded class to all stimulus
      const stimulusElements = display_element.querySelectorAll(
        ".jspsych-multi-image-stimulus"
      );
      stimulusElements.forEach((el) => {
        el.className += " responded";
      });

      if (response.key == null) {
        response = info;
      }

      if (trial.response_ends_trial) {
        end_trial();
      }
    };

    // Start keyboard listener
    if (trial.choices != "NO_KEYS") {
      var keyboardListener = this.jsPsych.pluginAPI.getKeyboardResponse({
        callback_function: after_response,
        valid_responses: trial.choices,
        rt_method: "performance",
        persist: false,
        allow_held_key: false,
      });
    }

    // Set timeout if stimulus duration is specified
    if (trial.stimulus_duration !== null) {
      this.jsPsych.pluginAPI.setTimeout(() => {
        const stimulusElements = display_element.querySelectorAll(
          ".jspsych-multi-image-stimulus"
        );
        stimulusElements.forEach((el) => {
          el.style.visibility = "hidden";
        });
      }, trial.stimulus_duration);
    }

    // Set trial duration timeout
    if (trial.trial_duration !== null) {
      this.jsPsych.pluginAPI.setTimeout(() => {
        end_trial();
      }, trial.trial_duration);
    } else if (trial.response_ends_trial === false) {
      console.warn(
        "The experiment may be deadlocked. Try setting a trial duration or set response_ends_trial to true."
      );
    }
  }

  createCanvasImage(stim, container, trial, index) {
    var image_drawn = false;
    var canvas = document.createElement("canvas");
    canvas.classList.add("jspsych-multi-image-stimulus");
    canvas.dataset.index = index;
    canvas.style.margin = "0";
    canvas.style.padding = "0";

    var ctx = canvas.getContext("2d");
    var img = new Image();

    img.onload = () => {
      if (!image_drawn) {
        const dimensions = this.getImageDimensions(img, trial, stim);
        canvas.width = dimensions.width;
        canvas.height = dimensions.height;
        ctx.drawImage(img, 0, 0, dimensions.width, dimensions.height);
        image_drawn = true;
      }
    };

    img.onerror = function () {
      console.error(`Failed to load image: ${stim.image}`);
    };

    img.src = stim.image;

    // Set initial dimensions
    const dimensions = this.getImageDimensions(img, trial, stim);
    canvas.width = dimensions.width;
    canvas.height = dimensions.height;

    // Apply custom styles if provided
    if (stim.style) {
      Object.keys(stim.style).forEach((property) => {
        canvas.style[property] = stim.style[property];
      });
    }

    container.appendChild(canvas);

    // Draw image if already loaded
    if (
      img.complete &&
      Number.isFinite(dimensions.width) &&
      Number.isFinite(dimensions.height)
    ) {
      ctx.drawImage(img, 0, 0, dimensions.width, dimensions.height);
      image_drawn = true;
    }
  }

  createImgElement(stim, container, trial, index) {
    const img = document.createElement("img");
    img.src = stim.image;
    img.classList.add("jspsych-multi-image-stimulus");
    img.dataset.index = index;

    img.onerror = function () {
      console.error(`Failed to load image: ${stim.image}`);
    };

    // Set dimensions after loading
    img.onload = () => {
      const dimensions = this.getImageDimensions(img, trial, stim);
      img.style.height = dimensions.height + "px";
      img.style.width = dimensions.width + "px";
    };

    // Apply custom styles if provided
    if (stim.style) {
      Object.keys(stim.style).forEach((property) => {
        img.style[property] = stim.style[property];
      });
    } else {
      // Default styling
      img.style.maxHeight = "300px";
      img.style.maxWidth = "100%";
    }

    container.appendChild(img);
  }

  getImageDimensions(img, trial, stim) {
    var height, width;

    // Use individual stimulus dimensions if available, otherwise use trial defaults
    const stimHeight =
      stim.stimulus_height !== undefined
        ? stim.stimulus_height
        : trial.stimulus_height;
    const stimWidth =
      stim.stimulus_width !== undefined
        ? stim.stimulus_width
        : trial.stimulus_width;
    const maintainAspect =
      stim.maintain_aspect_ratio !== undefined
        ? stim.maintain_aspect_ratio
        : trial.maintain_aspect_ratio;

    if (stimHeight !== null) {
      height = stimHeight;
      if (stimWidth == null && maintainAspect) {
        width = img.naturalWidth * (stimHeight / img.naturalHeight);
      }
    } else {
      height = img.naturalHeight;
    }

    if (stimWidth !== null) {
      width = stimWidth;
      if (stimHeight == null && maintainAspect) {
        height = img.naturalHeight * (stimWidth / img.naturalWidth);
      }
    } else if (!(stimHeight !== null && maintainAspect)) {
      width = img.naturalWidth;
    }

    return { width, height };
  }
}

MultiImageKeyboardResponsePlugin.info = info;

export default MultiImageKeyboardResponsePlugin;
