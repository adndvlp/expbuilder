(function (global, factory) {
  typeof exports === "object" && typeof module !== "undefined"
    ? (module.exports = factory())
    : typeof define === "function" && define.amd
    ? define(factory)
    : ((global =
        typeof globalThis !== "undefined" ? globalThis : global || self),
      (global.jsPsychCustomImageKeyboardResponse = factory()));
})(this, function () {
  "use strict";

  const { ParameterType } = jsPsychModule;

  var version = "2.1.0";

  const info = {
    name: "custom-image-keyboard-response",
    version,
    parameters: {
      /** The path of the image file to be displayed. */
      stimulus: {
        type: ParameterType.IMAGE,
        default: void 0,
      },
      /** Set the height of the image in pixels. If left null (no value specified), then the image will display at its natural height. */
      stimulus_height: {
        type: ParameterType.INT,
        default: null,
      },
      /** Set the width of the image in pixels. If left null (no value specified), then the image will display at its natural width. */
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
      /** Position coordinates for the image */
      coordinates: {
        type: ParameterType.OBJECT,
        pretty_name: "Coordinates",
        default: { x: 0, y: 0 },
        description: "Object with x and y properties for absolute positioning",
      },
      /**This array contains the key(s) that the participant is allowed to press in order to respond to the stimulus. Keys should
       * be specified as characters (e.g., `'a'`, `'q'`, `' '`, `'Enter'`, `'ArrowDown'`) - see
       * [this page](https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/key/Key_Values) and
       * [this page (event.key column)](https://www.freecodecamp.org/news/javascript-keycode-list-keypress-event-key-codes/)
       * for more examples. Any key presses that are not listed in the array will be ignored. The default value of `"ALL_KEYS"`
       * means that all keys will be accepted as valid responses. Specifying `"NO_KEYS"` will mean that no responses are allowed. */
      choices: {
        type: ParameterType.KEYS,
        default: "ALL_KEYS",
      },
      /**This string can contain HTML markup. Any content here will be displayed below the stimulus. The intention is that it can
       * be used to provide a reminder about the action the participant is supposed to take (e.g., which key to press). */
      prompt: {
        type: ParameterType.HTML_STRING,
        default: null,
      },
      /** How long to show the stimulus for in milliseconds. If the value is `null`, then the stimulus will be shown until the
       * participant makes a response. */
      stimulus_duration: {
        type: ParameterType.INT,
        default: null,
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
       * `trial_duration` is reached. You can set this parameter to `false` to force the participant to view a stimulus for a
       * fixed amount of time, even if they respond before the time is complete.  */
      response_ends_trial: {
        type: ParameterType.BOOL,
        default: true,
      },
      /**
       * If `true`, the image will be drawn onto a canvas element. This prevents a blank screen (white flash) between consecutive image trials in some browsers, like Firefox and Edge.
       * If `false`, the image will be shown via an img element, as in previous versions of jsPsych. If the stimulus is an **animated gif**, you must set this parameter to false, because the canvas rendering method will only present static images.
       */
      render_on_canvas: {
        type: ParameterType.BOOL,
        default: true,
      },
    },
    data: {
      /** The path of the image that was displayed. */
      stimulus: {
        type: ParameterType.STRING,
      },
      /**  Indicates which key the participant pressed. */
      response: {
        type: ParameterType.STRING,
      },
      /** The response time in milliseconds for the participant to make a response. The time is measured from when the stimulus
       * first appears on the screen until the participant's response. */
      rt: {
        type: ParameterType.INT,
      },
      /** Position data */
      coordinates: {
        type: ParameterType.OBJECT,
      },
    },
    // prettier-ignore
    citations: {
            "apa": "de Leeuw, J. R., Gilbert, R. A., & Luchterhandt, B. (2023). jsPsych: Enabling an Open-Source Collaborative Ecosystem of Behavioral Experiments. Journal of Open Source Software, 8(85), 5351. https://doi.org/10.21105/joss.05351 ",
            "bibtex": '@article{Leeuw2023jsPsych, 	author = {de Leeuw, Joshua R. and Gilbert, Rebecca A. and Luchterhandt, Bj{\\" o}rn}, 	journal = {Journal of Open Source Software}, 	doi = {10.21105/joss.05351}, 	issn = {2475-9066}, 	number = {85}, 	year = {2023}, 	month = {may 11}, 	pages = {5351}, 	publisher = {Open Journals}, 	title = {jsPsych: Enabling an {Open}-{Source} {Collaborative} {Ecosystem} of {Behavioral} {Experiments}}, 	url = {https://joss.theoj.org/papers/10.21105/joss.05351}, 	volume = {8}, }  '
        },
  };

  class CustomImageKeyboardResponsePlugin {
    constructor(jsPsych) {
      this.jsPsych = jsPsych;
    }
    static {
      this.info = info;
    }
    trial(display_element, trial) {
      var height, width;

      // Clear display
      if (display_element.hasChildNodes()) {
        while (display_element.firstChild) {
          display_element.removeChild(display_element.firstChild);
        }
      }

      // Create main container if positioning is used
      let imageContainer;
      const usePositioning =
        trial.coordinates &&
        (trial.coordinates.x !== 0 || trial.coordinates.y !== 0);

      if (usePositioning) {
        // Create positioned container
        const mainContainer = document.createElement("div");
        mainContainer.style.position = "relative";
        mainContainer.style.margin = "0 auto";

        imageContainer = document.createElement("div");
        imageContainer.style.position = "relative";

        // Apply coordinates if provided and not default
        if (
          trial.coordinates &&
          (trial.coordinates.x !== 0 || trial.coordinates.y !== 0)
        ) {
          const mapValue = (value) => {
            if (value > 1) return 50;
            if (value < -1) return -50;
            return value * 50;
          };

          if (trial.coordinates.x !== undefined) {
            trial.coordinates.x = mapValue(trial.coordinates.x);
            imageContainer.style.left = `${trial.coordinates.x}vw`;
          }
          if (trial.coordinates.y !== undefined) {
            trial.coordinates.y = mapValue(trial.coordinates.y);
            imageContainer.style.top = `${trial.coordinates.y}vh`;
          }
        }

        mainContainer.appendChild(imageContainer);
        display_element.appendChild(mainContainer);
      } else {
        imageContainer = display_element;
      }

      if (trial.render_on_canvas) {
        var image_drawn = false;

        var canvas = document.createElement("canvas");
        canvas.id = "jspsych-custom-image-keyboard-response-stimulus";
        canvas.style.margin = "0";
        canvas.style.padding = "0";
        var ctx = canvas.getContext("2d");
        var img = new Image();
        img.onload = () => {
          if (!image_drawn) {
            getHeightWidth();
            ctx.drawImage(img, 0, 0, width, height);
          }
        };
        img.src = trial.stimulus;

        const getHeightWidth = () => {
          if (trial.stimulus_height !== null) {
            height = trial.stimulus_height;
            if (trial.stimulus_width == null && trial.maintain_aspect_ratio) {
              width =
                img.naturalWidth * (trial.stimulus_height / img.naturalHeight);
            }
          } else {
            height = img.naturalHeight;
          }
          if (trial.stimulus_width !== null) {
            width = trial.stimulus_width;
            if (trial.stimulus_height == null && trial.maintain_aspect_ratio) {
              height =
                img.naturalHeight * (trial.stimulus_width / img.naturalWidth);
            }
          } else if (
            !(trial.stimulus_height !== null && trial.maintain_aspect_ratio)
          ) {
            width = img.naturalWidth;
          }
          canvas.height = height;
          canvas.width = width;
        };

        getHeightWidth();
        imageContainer.appendChild(canvas);

        if (img.complete && Number.isFinite(width) && Number.isFinite(height)) {
          ctx.drawImage(img, 0, 0, width, height);
          image_drawn = true;
        }

        if (trial.prompt !== null) {
          if (usePositioning) {
            // Add prompt below the positioned container
            const promptElement = document.createElement("div");
            promptElement.innerHTML = trial.prompt;
            imageContainer.appendChild(promptElement);
          } else {
            imageContainer.insertAdjacentHTML("beforeend", trial.prompt);
          }
        }
      } else {
        var html =
          '<img src="' +
          trial.stimulus +
          '" id="jspsych-custom-image-keyboard-response-stimulus">';

        imageContainer.innerHTML = html;

        var img = imageContainer.querySelector(
          "#jspsych-custom-image-keyboard-response-stimulus"
        );

        if (trial.stimulus_height !== null) {
          height = trial.stimulus_height;
          if (trial.stimulus_width == null && trial.maintain_aspect_ratio) {
            width =
              img.naturalWidth * (trial.stimulus_height / img.naturalHeight);
          }
        } else {
          height = img.naturalHeight;
        }
        if (trial.stimulus_width !== null) {
          width = trial.stimulus_width;
          if (trial.stimulus_height == null && trial.maintain_aspect_ratio) {
            height =
              img.naturalHeight * (trial.stimulus_width / img.naturalWidth);
          }
        } else if (
          !(trial.stimulus_height !== null && trial.maintain_aspect_ratio)
        ) {
          width = img.naturalWidth;
        }

        img.style.height = height.toString() + "px";
        img.style.width = width.toString() + "px";

        if (trial.prompt !== null) {
          if (usePositioning) {
            // Add prompt below the positioned container
            const promptElement = document.createElement("div");
            promptElement.innerHTML = trial.prompt;
            promptElement.style.textAlign = "center";
            imageContainer.appendChild(promptElement);
          } else {
            imageContainer.insertAdjacentHTML("beforeend", trial.prompt);
          }
        }
      }

      var response = {
        rt: null,
        key: null,
      };

      const end_trial = () => {
        if (typeof keyboardListener !== "undefined") {
          this.jsPsych.pluginAPI.cancelKeyboardResponse(keyboardListener);
        }
        var trial_data = {
          rt: response.rt,
          stimulus: trial.stimulus,
          response: response.key,
          coordinates: trial.coordinates
            ? `x: ${trial.coordinates.x}vw, y: ${trial.coordinates.y}vh`
            : "x: 0vw, y: 0vh",
        };

        this.jsPsych.finishTrial(trial_data);
      };

      var after_response = (info2) => {
        const stimulusElement = display_element.querySelector(
          "#jspsych-custom-image-keyboard-response-stimulus"
        );
        if (stimulusElement) {
          stimulusElement.className += " responded";
        }
        if (response.key == null) {
          response = info2;
        }

        if (trial.response_ends_trial) {
          end_trial();
        }
      };

      if (trial.choices != "NO_KEYS") {
        var keyboardListener = this.jsPsych.pluginAPI.getKeyboardResponse({
          callback_function: after_response,
          valid_responses: trial.choices,
          rt_method: "performance",
          persist: false,
          allow_held_key: false,
        });
      }

      if (trial.stimulus_duration !== null) {
        this.jsPsych.pluginAPI.setTimeout(() => {
          const stimulusElement = display_element.querySelector(
            "#jspsych-custom-image-keyboard-response-stimulus"
          );
          if (stimulusElement) {
            stimulusElement.style.visibility = "hidden";
          }
        }, trial.stimulus_duration);
      }

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

    simulate(trial, simulation_mode, simulation_options, load_callback) {
      if (simulation_mode == "data-only") {
        load_callback();
        this.simulate_data_only(trial, simulation_options);
      }
      if (simulation_mode == "visual") {
        this.simulate_visual(trial, simulation_options, load_callback);
      }
    }

    simulate_data_only(trial, simulation_options) {
      const data = this.create_simulation_data(trial, simulation_options);
      this.jsPsych.finishTrial(data);
    }

    simulate_visual(trial, simulation_options, load_callback) {
      const data = this.create_simulation_data(trial, simulation_options);
      const display_element = this.jsPsych.getDisplayElement();
      this.trial(display_element, trial);
      load_callback();
      if (data.rt !== null) {
        this.jsPsych.pluginAPI.pressKey(data.response, data.rt);
      }
    }

    create_simulation_data(trial, simulation_options) {
      const default_data = {
        stimulus: trial.stimulus,
        rt: this.jsPsych.randomization.sampleExGaussian(500, 50, 1 / 150, true),
        response: this.jsPsych.pluginAPI.getValidKey(trial.choices),
        coordinates: trial.coordinates,
      };
      const data = this.jsPsych.pluginAPI.mergeSimulationData(
        default_data,
        simulation_options
      );
      this.jsPsych.pluginAPI.ensureSimulationDataConsistency(trial, data);
      return data;
    }
  }

  // Asignar info estático a la clase
  CustomImageKeyboardResponsePlugin.info = info;

  return CustomImageKeyboardResponsePlugin;
});
