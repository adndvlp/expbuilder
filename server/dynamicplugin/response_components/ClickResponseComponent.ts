import { ParameterType } from "jspsych";

var version = "1.0.0";

const info = {
  name: "ClickResponseComponent",
  version,
  parameters: {
    name: {
      type: ParameterType.STRING,
      default: undefined,
    },
    /**
     * If true, the component listens for clicks/touches on the entire viewport.
     * If false, only the target element (defined by `target_selector`) is listened to.
     */
    capture_full_screen: {
      type: ParameterType.BOOL,
      default: true,
    },
    /**
     * CSS selector for the element to listen on. Only used when `capture_full_screen` is false.
     * Falls back to full-screen capture if no element is found.
     */
    target_selector: {
      type: ParameterType.STRING,
      default: null,
    },
    /**
     * If true, the click/touch coordinates are recorded relative to the target element
     * (origin at top-left corner of the element). If false, coordinates are relative
     * to the full viewport (origin at top-left corner of the screen).
     */
    relative_to_element: {
      type: ParameterType.BOOL,
      default: false,
    },
    /**
     * Show a visual marker (crosshair dot) at the clicked location.
     */
    show_click_marker: {
      type: ParameterType.BOOL,
      default: false,
    },
    /**
     * Color of the click marker (CSS color string).
     */
    marker_color: {
      type: ParameterType.STRING,
      default: "#e74c3c",
    },
    /**
     * Radius of the click marker in pixels.
     */
    marker_radius: {
      type: ParameterType.INT,
      default: 8,
    },
    /** Position coordinates for the component overlay. x and y in [-100, 100]. */
    coordinates: {
      type: ParameterType.OBJECT,
      default: { x: 0, y: 0 },
    },
    /** Z-index for layering (higher values appear on top). */
    zIndex: {
      type: ParameterType.INT,
      default: 10,
    },
  },
  data: {
    /** The x coordinate of the click/touch in pixels (viewport or element-relative). */
    x: {
      type: ParameterType.INT,
    },
    /** The y coordinate of the click/touch in pixels (viewport or element-relative). */
    y: {
      type: ParameterType.INT,
    },
    /** Whether the event was triggered by a touch (true) or mouse click (false). */
    is_touch: {
      type: ParameterType.BOOL,
    },
    /** The response time in milliseconds from component render to the click/touch. */
    rt: {
      type: ParameterType.INT,
    },
  },
};

interface ClickResponse {
  x: number;
  y: number;
  is_touch: boolean;
}

/**
 * ClickResponseComponent
 *
 * Captures where the participant clicks (desktop) or taps (mobile/tablet).
 * Automatically detects the input modality:
 *  - Touch devices (mobile / tablet): listens for `touchstart`
 *  - Pointer devices (desktop): listens for `click`
 *
 * Follows the "sketchpad pattern":
 * - Does NOT call finishTrial()
 * - Stores response data internally
 * - Exposes data via getters (getResponse(), getRT())
 * - Parent plugin orchestrates trial completion
 */
class ClickResponseComponent {
  private jsPsych: any;
  private response: ClickResponse | null = null;
  private rt: number | null = null;
  private start_time: number | null = null;
  private overlayElement: HTMLElement | null = null;
  private markerElement: HTMLElement | null = null;
  private boundHandler: ((e: Event) => void) | null = null;
  private listenTarget: HTMLElement | EventTarget | null = null;
  private useTouch: boolean = false;

  static info = info;

  constructor(jsPsych: any) {
    this.jsPsych = jsPsych;
  }

  /**
   * Detect whether the primary input device supports touch.
   * Uses both the Pointer Events API (most reliable) and a fallback
   * to `navigator.maxTouchPoints` / `ontouchstart`.
   */
  private static isTouchDevice(): boolean {
    // Pointer Events API: coarse pointer = touch/stylus
    if (window.matchMedia) {
      if (window.matchMedia("(pointer: coarse)").matches) return true;
      if (window.matchMedia("(pointer: fine)").matches) return false;
    }
    // Fallback: presence of touch APIs
    return navigator.maxTouchPoints > 0 || "ontouchstart" in window;
  }

  render(
    display_element: HTMLElement,
    trial: any,
    onResponse?: () => void,
  ): void {
    this.start_time = performance.now();
    this.useTouch = ClickResponseComponent.isTouchDevice();

    // Build an overlay div so the hit area is explicit and controllable.
    // When capture_full_screen is true it covers the full viewport.
    this.overlayElement = document.createElement("div");
    this.overlayElement.id = trial.name
      ? `jspsych-click-response-${trial.name}`
      : "jspsych-click-response-overlay";
    this.overlayElement.style.position = "absolute";
    this.overlayElement.style.cursor = "pointer";
    // Transparent but still receives pointer events
    this.overlayElement.style.background = "transparent";

    const zIndex = trial.zIndex ?? 10;
    this.overlayElement.style.zIndex = String(zIndex);

    if (trial.capture_full_screen !== false) {
      // Cover the entire viewport
      this.overlayElement.style.inset = "0";
      this.overlayElement.style.width = "100%";
      this.overlayElement.style.height = "100%";
    } else {
      // Position via coordinates parameter (same convention as other components)
      const mapValue = (v: number): number =>
        v > 100 ? 50 : v < -100 ? -50 : v * 0.5;

      const coords = trial.coordinates ?? { x: 0, y: 0 };
      const xVw = mapValue(coords.x ?? 0);
      const yVh = mapValue(coords.y ?? 0);
      this.overlayElement.style.left = `calc(50% + ${xVw}vw)`;
      this.overlayElement.style.top = `calc(50% - ${yVh}vh)`;
      this.overlayElement.style.transform = "translate(-50%, -50%)";
      // Size defaults to auto; caller can pass width/height in px via trial if needed
      this.overlayElement.style.minWidth = "40px";
      this.overlayElement.style.minHeight = "40px";
    }

    display_element.appendChild(this.overlayElement);

    // Determine the actual listen target
    if (trial.capture_full_screen === false && trial.target_selector) {
      const found = display_element.querySelector(
        trial.target_selector,
      ) as HTMLElement | null;
      this.listenTarget = found ?? this.overlayElement;
    } else {
      this.listenTarget = this.overlayElement;
    }

    // Build the unified handler
    this.boundHandler = (e: Event) => {
      if (this.response !== null) return; // Already captured

      let clientX: number;
      let clientY: number;
      let isTouch: boolean;

      if (e instanceof TouchEvent) {
        const touch = e.changedTouches[0] ?? e.touches[0];
        if (!touch) return;
        clientX = touch.clientX;
        clientY = touch.clientY;
        isTouch = true;
        // Prevent ghost mouse event that follows touchstart on some browsers
        e.preventDefault();
      } else if (e instanceof MouseEvent) {
        clientX = e.clientX;
        clientY = e.clientY;
        isTouch = false;
      } else {
        return;
      }

      // Compute coordinates
      let x: number;
      let y: number;

      if (trial.relative_to_element && this.listenTarget instanceof Element) {
        const rect = (this.listenTarget as Element).getBoundingClientRect();
        x = Math.round(clientX - rect.left);
        y = Math.round(clientY - rect.top);
      } else {
        x = Math.round(clientX);
        y = Math.round(clientY);
      }

      const end_time = performance.now();
      this.rt = Math.round(end_time - this.start_time!);
      this.response = { x, y, is_touch: isTouch };

      // Show visual marker if requested
      if (trial.show_click_marker !== false && trial.show_click_marker) {
        this.showMarker(clientX, clientY, trial);
      }

      if (onResponse) {
        onResponse();
      }
    };

    // Register the correct event type
    const eventType = this.useTouch ? "touchstart" : "click";
    (this.listenTarget as HTMLElement).addEventListener(
      eventType,
      this.boundHandler,
      // passive: false so we can call preventDefault() on touch to suppress ghost click
      { passive: false },
    );
  }

  /**
   * Place a small dot marker at the clicked viewport position.
   */
  private showMarker(clientX: number, clientY: number, trial: any): void {
    const color = trial.marker_color ?? "#e74c3c";
    const radius = trial.marker_radius ?? 8;

    const marker = document.createElement("div");
    marker.style.position = "fixed";
    marker.style.left = `${clientX}px`;
    marker.style.top = `${clientY}px`;
    marker.style.width = `${radius * 2}px`;
    marker.style.height = `${radius * 2}px`;
    marker.style.borderRadius = "50%";
    marker.style.background = color;
    marker.style.transform = "translate(-50%, -50%)";
    marker.style.pointerEvents = "none";
    marker.style.zIndex = "9999";
    document.body.appendChild(marker);
    this.markerElement = marker;
  }

  // ── Public getters ────────────────────────────────────────────

  /** Returns `{ x, y, is_touch }` or null if no click yet. */
  getResponse(): ClickResponse | null {
    return this.response;
  }

  getRT(): number | null {
    return this.rt;
  }

  /** True once a click/touch has been recorded. */
  isValid(_trial: any): boolean {
    return this.response !== null;
  }

  showValidationError(): void {
    if (this.overlayElement) {
      this.overlayElement.classList.add("jspsych-require-response-error");
    }
  }

  clearValidationError(): void {
    if (this.overlayElement) {
      this.overlayElement.classList.remove("jspsych-require-response-error");
    }
  }

  reset(): void {
    this.response = null;
    this.rt = null;
    if (this.markerElement) {
      this.markerElement.remove();
      this.markerElement = null;
    }
  }

  destroy(): void {
    if (this.boundHandler && this.listenTarget) {
      const eventType = this.useTouch ? "touchstart" : "click";
      (this.listenTarget as HTMLElement).removeEventListener(
        eventType,
        this.boundHandler,
      );
    }
    if (this.markerElement) {
      this.markerElement.remove();
      this.markerElement = null;
    }
    if (this.overlayElement) {
      this.overlayElement.remove();
      this.overlayElement = null;
    }
  }
}

export default ClickResponseComponent;
