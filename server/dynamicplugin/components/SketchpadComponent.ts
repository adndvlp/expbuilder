import { ParameterType } from "jspsych";

var version = "2.1.0";

const info = {
  name: "SketchpadComponent",
  version,
  parameters: {
    name: {
      type: ParameterType.STRING,
      default: undefined,
    },
    /**
     * The shape of the canvas element. Accepts `'rectangle'` or `'circle'`
     */
    canvas_shape: {
      type: ParameterType.STRING,
      default: "rectangle",
    },
    /**
     * Width of the canvas in pixels when `canvas_shape` is a `"rectangle"`.
     */
    canvas_width: {
      type: ParameterType.INT,
      default: 500,
    },
    /**
     * Height of the canvas in pixels when `canvas_shape` is a `"rectangle"`.
     */
    canvas_height: {
      type: ParameterType.INT,
      default: 500,
    },
    /**
     * Diameter of the canvas (when `canvas_shape` is `'circle'`) in pixels.
     */
    canvas_diameter: {
      type: ParameterType.INT,
      default: 500,
    },
    /**
     * This width of the border around the canvas element
     */
    canvas_border_width: {
      type: ParameterType.INT,
      default: 0,
    },
    /**
     * The color of the border around the canvas element.
     */
    canvas_border_color: {
      type: ParameterType.STRING,
      default: "#000",
    },
    /**
     * Path to an image to render as the background of the canvas.
     */
    background_image: {
      type: ParameterType.IMAGE,
      default: null,
    },
    /**
     * Color of the canvas background. Note that a `background_image` will render on top of the color.
     */
    background_color: {
      type: ParameterType.STRING,
      default: "#ffffff",
    },
    /**
     * The width of the strokes on the canvas.
     */
    stroke_width: {
      type: ParameterType.INT,
      default: 2,
    },
    /**
     * The color of the stroke on the canvas.
     */
    stroke_color: {
      type: ParameterType.STRING,
      default: "#000000",
    },
    /**
     * Array of colors to render as a palette of choices for stroke color. Clicking on the corresponding color button will change the stroke color.
     */
    stroke_color_palette: {
      type: ParameterType.STRING,
      array: true,
      default: [],
    },
    /**
     * HTML content to render above or below the canvas (use `prompt_location` parameter to change location).
     */
    prompt: {
      type: ParameterType.HTML_STRING,
      default: null,
    },
    /**
     * Location of the `prompt` content. Can be 'abovecanvas' or 'belowcanvas' or 'belowbutton'.
     */
    prompt_location: {
      type: ParameterType.STRING,
      default: "abovecanvas",
    },
    /**
     * Whether to save the final image in the data as a base64 encoded data URL.
     */
    save_final_image: {
      type: ParameterType.BOOL,
      default: true,
    },
    /**
     * Whether to save the individual stroke data that generated the final image.
     */
    save_strokes: {
      type: ParameterType.BOOL,
      default: true,
    },
    /**
     * If this key is held down then it is like the mouse button being held down.
     * The "ink" will flow when the button is held and stop when it is lifted.
     * Pass in the string representation of the key, e.g., `'a'` for the A key
     * or `' '` for the spacebar.
     */
    key_to_draw: {
      type: ParameterType.KEY,
      default: null,
    },
    /**
     * Whether to show the button that clears the entire drawing.
     */
    show_clear_button: {
      type: ParameterType.BOOL,
      default: true,
    },
    /**
     * The label for the button that clears the entire drawing.
     */
    clear_button_label: {
      type: ParameterType.STRING,
      default: "Clear",
    },
    /**
     * Whether to show the button that enables an undo action.
     */
    show_undo_button: {
      type: ParameterType.BOOL,
      default: true,
    },
    /**
     * The label for the button that performs an undo action.
     */
    undo_button_label: {
      type: ParameterType.STRING,
      default: "Undo",
    },
    /**
     * Whether to show the button that enables an redo action. `show_undo_button` must also
     * be `true` for the redo button to show.
     */
    show_redo_button: {
      type: ParameterType.BOOL,
      default: true,
    },
    /**
     * The label for the button that performs an redo action.
     */
    redo_button_label: {
      type: ParameterType.STRING,
      default: "Redo",
    },
    /** Position coordinates for the sketchpad. x and y should be between -1 and 1, mapped to -50vw/vh to 50vw/vh. */
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
  data: {
    /** If `save_final_image` is true, then this will contain the base64 encoded data URL for the image, in png format. */
    png: {
      type: ParameterType.STRING,
    },
    /** If `save_strokes` is true, then this will contain an array of stroke objects. Objects have an `action` property that is either `"start"`, `"move"`, or `"end"`. If `action` is `"start"` or `"move"` it will have an `x` and `y` property that report the coordinates of the action relative to the upper-left corner of the canvas. If `action` is `"start"` then the object will also have a `t` and `color` property, specifying the time of the action relative to the onset of the trial (ms) and the color of the stroke. If `action` is `"end"` then it will only have a `t` property. */
    strokes: {
      type: ParameterType.COMPLEX,
      array: true,
      nested: {
        action: {
          type: ParameterType.STRING,
        },
        x: {
          type: ParameterType.INT,
          optional: true,
        },
        y: {
          type: ParameterType.INT,
          optional: true,
        },
        t: {
          type: ParameterType.INT,
          optional: true,
        },
        color: {
          type: ParameterType.STRING,
          optional: true,
        },
      },
    },
  },
  // prettier-ignore
  citations: {
    "apa": "de Leeuw, J. R., Gilbert, R. A., & Luchterhandt, B. (2023). jsPsych: Enabling an Open-Source Collaborative Ecosystem of Behavioral Experiments. Journal of Open Source Software, 8(85), 5351. https://doi.org/10.21105/joss.05351 ",
    "bibtex": '@article{Leeuw2023jsPsych, 	author = {de Leeuw, Joshua R. and Gilbert, Rebecca A. and Luchterhandt, Bj{\\" o}rn}, 	journal = {Journal of Open Source Software}, 	doi = {10.21105/joss.05351}, 	issn = {2475-9066}, 	number = {85}, 	year = {2023}, 	month = {may 11}, 	pages = {5351}, 	publisher = {Open Journals}, 	title = {jsPsych: Enabling an {Open}-{Source} {Collaborative} {Ecosystem} of {Behavioral} {Experiments}}, 	url = {https://joss.theoj.org/papers/10.21105/joss.05351}, 	volume = {8}, }  '
  },
};

/**
 * SketchpadComponent - Interactive drawing canvas
 * This component handles drawing but does NOT end the trial
 * The plugin principal extracts the data when needed
 */
class SketchpadComponent {
  private jsPsych: any;
  private display: HTMLElement | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private is_drawing: boolean = false;
  private strokes: any[] = [];
  private stroke: any[] = [];
  private undo_history: any[] = [];
  private mouse_position: { x: number; y: number } = { x: 0, y: 0 };
  private draw_key_held: boolean = false;
  private current_stroke_color: string = "#000000";
  private background_image: HTMLImageElement | null = null;
  private start_time: number = 0;

  constructor(jsPsych: any) {
    this.jsPsych = jsPsych;
  }

  static info = info;

  /**
   * Render the sketchpad canvas
   * @param container - The HTML element to render into
   * @param config - Configuration for the sketchpad
   * @returns Promise that resolves when ready
   */
  async render(container: HTMLElement, config: any): Promise<void> {
    // Helper to map coordinate values
    const mapValue = (value: number): number => {
      if (value < -1) return -50;
      if (value > 1) return 50;
      return value * 50;
    };

    // Create sketchpad container with coordinates
    const sketchpadContainer = document.createElement("div");
    sketchpadContainer.id = "jspsych-sketchpad-container";
    sketchpadContainer.style.position = "absolute";

    const xVw = mapValue(config.coordinates.x);
    const yVh = mapValue(config.coordinates.y);
    sketchpadContainer.style.left = `calc(50% + ${xVw}vw)`;
    sketchpadContainer.style.top = `calc(50% - ${yVh}vh)`;
    sketchpadContainer.style.transform = "translate(-50%, -50%)";

    container.appendChild(sketchpadContainer);

    this.display = sketchpadContainer;
    this.current_stroke_color = config.stroke_color;
    this.start_time = performance.now();

    this.init_display(config);
    this.setup_event_listeners(config);
    this.add_background_color(config);
    await this.add_background_image(config);
  }
  init_display(config: any) {
    this.add_css(config);
    let canvas_html;
    if (config.canvas_shape == "rectangle") {
      canvas_html = `
        <canvas id="sketchpad-canvas" 
        width="${config.canvas_width}" 
        height="${config.canvas_height}" 
        class="sketchpad-rectangle"></canvas>
      `;
    } else if (config.canvas_shape == "circle") {
      canvas_html = `
        <canvas id="sketchpad-canvas" 
        width="${config.canvas_diameter}" 
        height="${config.canvas_diameter}" 
        class="sketchpad-circle">
        </canvas>
      `;
    } else {
      throw new Error(
        '`canvas_shape` parameter in sketchpad plugin must be either "rectangle" or "circle"',
      );
    }
    let sketchpad_controls = `<div id="sketchpad-controls">`;
    sketchpad_controls += `<div id="sketchpad-color-palette">`;
    const palette = Array.isArray(config.stroke_color_palette)
      ? config.stroke_color_palette
      : [];
    for (const color of palette) {
      sketchpad_controls += `<button class="sketchpad-color-select" data-color="${color}" style="background-color:${color};"></button>`;
    }
    sketchpad_controls += `</div>`;
    sketchpad_controls += `<div id="sketchpad-actions">`;
    if (config.show_clear_button) {
      sketchpad_controls += `<button class="jspsych-btn" id="sketchpad-clear" disabled>${config.clear_button_label}</button>`;
    }
    if (config.show_undo_button) {
      sketchpad_controls += `<button class="jspsych-btn" id="sketchpad-undo" disabled>${config.undo_button_label}</button>`;
      if (config.show_redo_button) {
        sketchpad_controls += `<button class="jspsych-btn" id="sketchpad-redo" disabled>${config.redo_button_label}</button>`;
      }
    }
    sketchpad_controls += `</div></div>`;
    canvas_html += sketchpad_controls;

    let display_html = canvas_html;
    if (config.prompt !== null) {
      if (config.prompt_location == "abovecanvas") {
        display_html = config.prompt + canvas_html;
      } else if (config.prompt_location == "belowcanvas") {
        display_html = canvas_html + config.prompt;
      }
    }

    if (this.display) {
      this.display.innerHTML = display_html;
      this.canvas = this.display.querySelector("#sketchpad-canvas");
      if (this.canvas) {
        this.ctx = this.canvas.getContext("2d");
      }
    }
  }
  setup_event_listeners(config: any) {
    document.addEventListener("pointermove", (e) => {
      this.mouse_position = { x: e.clientX, y: e.clientY };
    });

    if (!this.canvas) return;

    this.canvas.addEventListener(
      "pointerdown",
      this.start_draw.bind(this, config),
    );
    this.canvas.addEventListener(
      "pointermove",
      this.move_draw.bind(this, config),
    );
    this.canvas.addEventListener("pointerup", this.end_draw.bind(this));
    this.canvas.addEventListener("pointerleave", this.end_draw.bind(this));
    this.canvas.addEventListener("pointercancel", this.end_draw.bind(this));
    if (config.key_to_draw !== null) {
      document.addEventListener("keydown", (e) => {
        if (
          e.key == config.key_to_draw &&
          !this.is_drawing &&
          !this.draw_key_held
        ) {
          this.draw_key_held = true;
          if (
            this.canvas &&
            document.elementFromPoint(
              this.mouse_position.x,
              this.mouse_position.y,
            ) == this.canvas
          ) {
            this.canvas.dispatchEvent(
              new PointerEvent("pointerdown", {
                clientX: this.mouse_position.x,
                clientY: this.mouse_position.y,
              }),
            );
          }
        }
      });
      document.addEventListener("keyup", (e) => {
        if (e.key == config.key_to_draw) {
          this.draw_key_held = false;
          if (
            this.canvas &&
            document.elementFromPoint(
              this.mouse_position.x,
              this.mouse_position.y,
            ) == this.canvas
          ) {
            this.canvas.dispatchEvent(
              new PointerEvent("pointerup", {
                clientX: this.mouse_position.x,
                clientY: this.mouse_position.y,
              }),
            );
          }
        }
      });
    }
    if (config.show_undo_button && this.display) {
      this.display
        .querySelector("#sketchpad-undo")
        ?.addEventListener("click", this.undo.bind(this, config));
      if (config.show_redo_button) {
        this.display
          .querySelector("#sketchpad-redo")
          ?.addEventListener("click", this.redo.bind(this, config));
      }
    }
    if (config.show_clear_button && this.display) {
      this.display
        .querySelector("#sketchpad-clear")
        ?.addEventListener("click", this.clear.bind(this, config));
    }
    if (this.display) {
      const color_btns = Array.prototype.slice.call(
        this.display.querySelectorAll(".sketchpad-color-select"),
      );
      for (const btn of color_btns) {
        btn.addEventListener("click", (e: any) => {
          const target = e.target;
          this.current_stroke_color = target.getAttribute("data-color");
        });
      }
    }
  }
  add_css(config: any) {
    document.querySelector("head")?.insertAdjacentHTML(
      "beforeend",
      `<style id="sketchpad-styles">
        #sketchpad-controls {
          line-height: 1; 
          width:${
            config.canvas_shape == "rectangle"
              ? config.canvas_width + config.canvas_border_width * 2
              : config.canvas_diameter + config.canvas_border_width * 2
          }px; 
          display: flex; 
          justify-content: space-between; 
          flex-wrap: wrap;
          margin: auto;
        }
        #sketchpad-color-palette { 
          display: inline-block; text-align:left; flex-grow: 1;
        }
        .sketchpad-color-select { 
          cursor: pointer; height: 33px; width: 33px; border-radius: 4px; padding: 0; border: 1px solid #ccc; 
        }
        #sketchpad-actions {
          display:inline-block; text-align:right; flex-grow: 1;
        }
        #sketchpad-actions button {
          margin-left: 4px;
        }
        #sketchpad-canvas {
          touch-action: none;
          border: ${config.canvas_border_width}px solid ${
            config.canvas_border_color
          };
        }
        .sketchpad-circle {
          border-radius: ${config.canvas_diameter / 2}px;
        }
      </style>`,
    );
  }
  add_background_color(config: any) {
    if (!this.ctx) return;
    this.ctx.fillStyle = config.background_color;
    if (config.canvas_shape == "rectangle") {
      this.ctx.fillRect(0, 0, config.canvas_width, config.canvas_height);
    }
    if (config.canvas_shape == "circle") {
      this.ctx.fillRect(0, 0, config.canvas_diameter, config.canvas_diameter);
    }
  }
  async add_background_image(config: any): Promise<void> {
    return new Promise((resolve, reject) => {
      if (config.background_image !== null) {
        this.background_image = new Image();
        this.background_image.src = config.background_image;
        this.background_image.onload = () => {
          if (this.ctx && this.background_image) {
            this.ctx.drawImage(this.background_image, 0, 0);
          }
          resolve();
        };
      } else {
        resolve();
      }
    });
  }
  start_draw(config: any, e: PointerEvent) {
    if (!this.canvas || !this.ctx) return;

    this.is_drawing = true;
    const x = Math.round(e.clientX - this.canvas.getBoundingClientRect().left);
    const y = Math.round(e.clientY - this.canvas.getBoundingClientRect().top);
    this.undo_history = [];
    this.set_redo_btn_state(false, config);
    this.ctx.beginPath();
    this.ctx.moveTo(x, y);
    this.ctx.strokeStyle = this.current_stroke_color;
    this.ctx.lineJoin = "round";
    this.ctx.lineWidth = config.stroke_width;
    this.stroke = [];
    this.stroke.push({
      x,
      y,
      color: this.current_stroke_color,
      action: "start",
      t: Math.round(performance.now() - this.start_time),
    });
    this.canvas.releasePointerCapture(e.pointerId);
  }
  move_draw(config: any, e: PointerEvent) {
    if (!this.canvas || !this.ctx) return;

    if (this.is_drawing) {
      const x = Math.round(
        e.clientX - this.canvas.getBoundingClientRect().left,
      );
      const y = Math.round(e.clientY - this.canvas.getBoundingClientRect().top);
      this.ctx.lineTo(x, y);
      this.ctx.stroke();
      this.stroke.push({
        x,
        y,
        action: "move",
      });
    }
  }
  end_draw(e: PointerEvent) {
    if (this.is_drawing) {
      this.stroke.push({
        action: "end",
        t: Math.round(performance.now() - this.start_time),
      });
      this.strokes.push(this.stroke);
      this.set_undo_btn_state(true, {} as any);
      this.set_clear_btn_state(true, {} as any);
    }
    this.is_drawing = false;
  }
  render_drawing(config: any) {
    if (!this.ctx || !this.canvas) return;

    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.add_background_color(config);
    if (this.background_image && this.ctx) {
      this.ctx.drawImage(this.background_image, 0, 0);
    }
    for (const stroke of this.strokes) {
      for (const m of stroke) {
        if (m.action == "start") {
          this.ctx.beginPath();
          this.ctx.moveTo(m.x, m.y);
          this.ctx.strokeStyle = m.color;
          this.ctx.lineJoin = "round";
          this.ctx.lineWidth = config.stroke_width;
        }
        if (m.action == "move") {
          this.ctx.lineTo(m.x, m.y);
          this.ctx.stroke();
        }
      }
    }
  }
  undo(config: any) {
    this.undo_history.push(this.strokes.pop());
    this.set_redo_btn_state(true, config);
    if (this.strokes.length == 0) {
      this.set_undo_btn_state(false, config);
    }
    this.render_drawing(config);
  }
  redo(config: any) {
    this.strokes.push(this.undo_history.pop());
    this.set_undo_btn_state(true, config);
    if (this.undo_history.length == 0) {
      this.set_redo_btn_state(false, config);
    }
    this.render_drawing(config);
  }
  clear(config: any) {
    this.strokes = [];
    this.undo_history = [];
    this.render_drawing(config);
    this.set_redo_btn_state(false, config);
    this.set_undo_btn_state(false, config);
    this.set_clear_btn_state(false, config);
  }
  set_undo_btn_state(enabled: boolean, config: any) {
    if (config.show_undo_button && this.display) {
      const btn = this.display.querySelector(
        "#sketchpad-undo",
      ) as HTMLButtonElement;
      if (btn) btn.disabled = !enabled;
    }
  }
  set_redo_btn_state(enabled: boolean, config: any) {
    if (config.show_undo_button && config.show_redo_button && this.display) {
      const btn = this.display.querySelector(
        "#sketchpad-redo",
      ) as HTMLButtonElement;
      if (btn) btn.disabled = !enabled;
    }
  }
  set_clear_btn_state(enabled: boolean, config: any) {
    if (config.show_clear_button && this.display) {
      const btn = this.display.querySelector(
        "#sketchpad-clear",
      ) as HTMLButtonElement;
      if (btn) btn.disabled = !enabled;
    }
  }

  /**
   * Get the strokes data
   * @returns Array of stroke objects
   */
  getStrokes(): any[] {
    return this.strokes;
  }

  /**
   * Get the final image as base64 data URL
   * @returns PNG data URL or null if canvas not available
   */
  getImageData(): string | null {
    return this.canvas ? this.canvas.toDataURL() : null;
  }

  /**
   * Destroy and clean up the component
   */
  destroy() {
    document.querySelector("#sketchpad-styles")?.remove();
  }
}

export default SketchpadComponent;
