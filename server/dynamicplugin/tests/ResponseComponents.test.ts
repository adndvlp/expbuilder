import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ResponseTimingManager from "../utils/ResponseTimingManager";
import { createPrecisionTiming } from "../utils/PrecisionTiming";
import KeyboardResponseComponent from "../response_components/KeyboardResponseComponent";
import ClickResponseComponent from "../response_components/ClickResponseComponent";
import ButtonResponseComponent from "../response_components/ButtonResponseComponent";
import InputResponseComponent from "../response_components/InputResponseComponent";
import SliderResponseComponent from "../response_components/SliderResponseComponent";
import FileUploadResponseComponent from "../response_components/FileUploadResponseComponent";
import AudioResponseComponent from "../response_components/AudioResponseComponent";
import { createParticipantResponseSignal } from "../utils/EventTiming";
import { installFakeRaf, restoreFakeRaf } from "./helpers/fakeRaf";

function fakeJsPsych() {
  return {
    getInitSettings: () => ({ case_sensitive_responses: false, minimum_valid_rt: 0 }),
    getDisplayContainerElement: () => document.body,
    getDisplayElement: () => document.body,
  };
}

function makeTiming(origin = 1000) {
  const cancel = () => {};
  const context: any = {
    id: "response-component-context",
    getFrameIntervalEstimate: () => 20,
    start: vi.fn(),
    stop: vi.fn(),
    onStart: vi.fn((callback) => {
      callback(origin, {
        source: "frame_engine_raf",
        scheduledTimestamp: origin,
      });
      return cancel;
    }),
    onFrame: vi.fn(() => cancel),
    onFrameCommit: vi.fn(() => cancel),
    onPostCommit: vi.fn(() => cancel),
    scheduleAt: vi.fn(() => cancel),
    requestBoundary: vi.fn(() => true),
    replaceBoundary: vi.fn(() => true),
    queuePostCritical: vi.fn(() => ({ cancel })),
    recordStimulusCommit: vi.fn(),
    getTransitionTelemetry: vi.fn(() => []),
  };
  return createPrecisionTiming({
    expectedFrameMs: 20,
    trialContext: context,
  });
}

function makeManager(options: {
  trial?: Record<string, any>;
  onFinish?: () => boolean | void;
} = {}) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const manager = new ResponseTimingManager({
    trial: options.trial ?? {},
    timing: makeTiming(1000),
    container,
    canvasWidth: 1024,
    canvasHeight: 768,
    onFinish: options.onFinish ?? (() => true),
  });
  return manager;
}

function eventWithTimestamp(event: Event, timeStamp: number) {
  Object.defineProperty(event, "timeStamp", { value: timeStamp });
  return event;
}

function installFakeCanvasContexts() {
  const gl: any = {
    VERTEX_SHADER: 35633,
    FRAGMENT_SHADER: 35632,
    ARRAY_BUFFER: 34962,
    TEXTURE_2D: 3553,
    RGBA: 6408,
    UNSIGNED_BYTE: 5121,
    BLEND: 3042,
    ONE_MINUS_SRC_ALPHA: 771,
    ONE: 1,
    TRIANGLES: 4,
    COLOR_BUFFER_BIT: 16384,
    COMPILE_STATUS: 35713,
    LINK_STATUS: 35714,
    TEXTURE0: 33984,
    CLAMP_TO_EDGE: 33071,
    NEAREST: 9728,
    LINEAR: 9729,
    TEXTURE_WRAP_S: 10242,
    TEXTURE_WRAP_T: 10243,
    TEXTURE_MIN_FILTER: 10241,
    TEXTURE_MAG_FILTER: 10240,
    UNPACK_PREMULTIPLY_ALPHA_WEBGL: 37440,
    STATIC_DRAW: 35044,
    FLOAT: 5126,
    createShader: () => ({}),
    createProgram: () => ({}),
    createBuffer: () => ({}),
    createTexture: () => ({}),
    shaderSource: () => {},
    compileShader: () => {},
    getShaderParameter: () => true,
    attachShader: () => {},
    linkProgram: () => {},
    getProgramParameter: () => true,
    bindBuffer: () => {},
    bufferData: () => {},
    getAttribLocation: () => 0,
    getUniformLocation: () => ({}),
    viewport: () => {},
    useProgram: () => {},
    uniform2f: () => {},
    uniform4f: () => {},
    uniform1i: () => {},
    enable: () => {},
    blendFunc: () => {},
    clearColor: () => {},
    clear: () => {},
    bindTexture: () => {},
    texParameteri: () => {},
    texImage2D: () => {},
    pixelStorei: () => {},
    activeTexture: () => {},
    enableVertexAttribArray: () => {},
    vertexAttribPointer: () => {},
    drawArrays: () => {},
    getExtension: () => null,
  };
  const ctx2d: any = {
    font: "",
    fillStyle: "",
    strokeStyle: "",
    globalAlpha: 1,
    textAlign: "",
    textBaseline: "",
    lineWidth: 0,
    save: () => {},
    restore: () => {},
    beginPath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    quadraticCurveTo: () => {},
    closePath: () => {},
    fill: () => {},
    stroke: () => {},
    fillRect: () => {},
    clearRect: () => {},
    translate: () => {},
    rotate: () => {},
    setTransform: () => {},
    drawImage: () => {},
    fillText: () => {},
    setLineDash: () => {},
    strokeRect: () => {},
    measureText: (text: string) => ({ width: text.length * 8 }),
    getImageData: () => ({
      data: new Uint8ClampedArray([255, 255, 255, 255]),
    }),
  };
  const originalGetContext = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (
    this: HTMLCanvasElement,
    type: string,
    _options?: any,
  ) {
    if (type === "2d") return ctx2d as any;
    return gl as any;
  } as any;
  return () => {
    HTMLCanvasElement.prototype.getContext = originalGetContext;
  };
}

describe("KeyboardResponseComponent timing authority", () => {
  beforeEach(() => installFakeRaf());
  afterEach(() => {
    restoreFakeRaf();
    vi.restoreAllMocks();
    document.body.innerHTML = "";
  });

  it("manager enabled: registers only the shared keyboard target", () => {
    const jsPsych = fakeJsPsych();
    const component = new KeyboardResponseComponent(jsPsych);
    const registerKeyboardTarget = vi.fn(() => () => {});
    const display = document.createElement("div");
    document.body.appendChild(display);
    component.render(display, {
      name: "Keyboard_1",
      choices: "ALL_KEYS",
      __timing: makeTiming(),
      __responseTiming: { enabled: true, registerKeyboardTarget },
    });
    expect(registerKeyboardTarget).toHaveBeenCalledTimes(1);
    // A keydown on the root element must not be captured by a component-owned
    // listener.
    vi.spyOn(performance, "now").mockReturnValue(1270);
    document.body.dispatchEvent(eventWithTimestamp(
      new KeyboardEvent("keydown", { key: "a", bubbles: true }),
      1250,
    ));
    expect(component.getResponse()).toBeNull();
    component.destroy();
  });

  it("manager disabled: one keydown fallback using the shared timestamp", () => {
    const jsPsych = fakeJsPsych();
    const component = new KeyboardResponseComponent(jsPsych);
    const display = document.createElement("div");
    document.body.appendChild(display);
    component.render(display, {
      name: "Keyboard_1",
      choices: "ALL_KEYS",
      __timing: makeTiming(),
      __responseTiming: { enabled: false },
    });
    vi.spyOn(performance, "now").mockReturnValue(1270);
    document.body.dispatchEvent(eventWithTimestamp(
      new KeyboardEvent("keydown", { key: "a" }),
      1250,
    ));
    expect(component.getResponse()).toBe("a");
    expect(component.getRT()).toBe(250);
    component.destroy();
  });
});

describe("ClickResponseComponent timing authority", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = "";
  });

  it("manager enabled: registers only the shared pointer target", () => {
    const jsPsych = fakeJsPsych();
    const component = new ClickResponseComponent(jsPsych);
    const registerPointerTarget = vi.fn(() => () => {});
    const display = document.createElement("div");
    document.body.appendChild(display);
    component.render(display, {
      name: "Click_1",
      __timing: makeTiming(),
      __responseTiming: { enabled: true, registerPointerTarget },
    });
    expect(registerPointerTarget).toHaveBeenCalledTimes(1);
    // Without the manager invoking onResponse, the component must not
    // record anything from a raw pointerdown.
    const overlay = display.querySelector("div");
    overlay?.dispatchEvent(new PointerEvent("pointerdown", { clientX: 5, clientY: 5, pointerType: "mouse", bubbles: true }));
    expect(component.getResponse()).toBeNull();
    component.destroy();
  });

  it("manager disabled: default pointer RT uses pointerdown with shared timestamp", () => {
    const jsPsych = fakeJsPsych();
    const component = new ClickResponseComponent(jsPsych);
    const display = document.createElement("div");
    document.body.appendChild(display);
    component.render(display, {
      name: "Click_1",
      capture_full_screen: true,
      __timing: makeTiming(),
      __responseTiming: { enabled: false },
    });
    vi.spyOn(performance, "now").mockReturnValue(1270);
    const overlay = display.querySelector("div") as HTMLElement;
    overlay.dispatchEvent(eventWithTimestamp(
      new PointerEvent("pointerdown", { clientX: 12, clientY: 34, pointerType: "mouse" }),
      1250,
    ));
    expect(component.getResponse()).toEqual({ x: 12, y: 34, is_touch: false });
    expect(component.getRT()).toBe(250);
    expect(component.responseEventType).toBe("pointerdown");
    component.destroy();
  });

  it("no-PointerEvent browsers: explicit click fallback records the event type", () => {
    const jsPsych = fakeJsPsych();
    const component = new ClickResponseComponent(jsPsych);
    const display = document.createElement("div");
    document.body.appendChild(display);
    const originalPointerEvent = (window as any).PointerEvent;
    const originalMatchMedia = window.matchMedia;
    (window as any).PointerEvent = undefined;
    window.matchMedia = ((query: string) => ({
      matches: query === "(pointer: fine)",
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    })) as any;
    try {
      component.render(display, {
        name: "Click_1",
        capture_full_screen: true,
        __timing: makeTiming(),
        __responseTiming: { enabled: false },
      });
      vi.spyOn(performance, "now").mockReturnValue(1270);
      const overlay = display.querySelector("div") as HTMLElement;
      overlay.dispatchEvent(eventWithTimestamp(
        new MouseEvent("click", { clientX: 7, clientY: 8 }),
        1250,
      ));
      expect(component.getResponse()).toEqual({ x: 7, y: 8, is_touch: false });
      expect(component.getRT()).toBe(250);
      expect(component.responseEventType).toBe("click");
    } finally {
      (window as any).PointerEvent = originalPointerEvent;
      window.matchMedia = originalMatchMedia;
    }
    component.destroy();
  });
});

describe("ButtonResponseComponent timing authority", () => {
  beforeEach(() => installFakeRaf());
  afterEach(() => {
    restoreFakeRaf();
    vi.restoreAllMocks();
    document.body.innerHTML = "";
  });

  function renderDomButton(options: { managerEnabled: boolean; onFinish?: () => boolean | void }) {
    const jsPsych = fakeJsPsych();
    const component = new ButtonResponseComponent(jsPsych);
    const display = document.createElement("div");
    document.body.appendChild(display);
    const manager = makeManager({ onFinish: options.onFinish });
    if (!options.managerEnabled) {
      // disabled manager double
      (manager as any).enabled = false;
    }
    const timing = makeTiming(1000);
    const onResponse = vi.fn();
    component.render(display, {
      name: "Button_1",
      choices: ["A"],
      button_html: () => `<button>${"A"}</button>`,
      enable_button_after: 0,
      zIndex: 0,
      __timing: timing,
      __responseTiming: manager,
    }, onResponse);
    const button = display.querySelector("button") as HTMLButtonElement;
    return { component, display, button, manager, timing, onResponse };
  }

  it("pointerdown manager response stores one result; following click cannot double-record", () => {
    let finishes = 0;
    const { component, button, manager } = renderDomButton({
      managerEnabled: true,
      onFinish: () => {
        finishes += 1;
        return true;
      },
    });
    manager.attach();
    vi.spyOn(performance, "now").mockReturnValue(1270);
    window.dispatchEvent(eventWithTimestamp(
      new PointerEvent("pointerdown", { clientX: 0, clientY: 0, pointerType: "mouse" }),
      1250,
    ));
    expect(finishes).toBe(1);
    expect(component.getResponse()).toBe("A");
    expect(component.getRT()).toBe(250);
    expect(manager.getData().response_event_type).toBe("pointerdown");
    button.dispatchEvent(eventWithTimestamp(
      new MouseEvent("click"),
      1260,
    ));
    expect(finishes).toBe(1);
    expect(component.getRT()).toBe(250);
    expect(manager.getData().response_event_type).toBe("pointerdown");
    manager.detach();
    component.destroy();
  });

  it("accessibility click with no pointer response routes through manager external-event path", () => {
    let finishes = 0;
    const { component, button, manager } = renderDomButton({
      managerEnabled: true,
      onFinish: () => {
        finishes += 1;
        return true;
      },
    });
    manager.attach();
    vi.spyOn(performance, "now").mockReturnValue(1270);
    button.dispatchEvent(eventWithTimestamp(new MouseEvent("click"), 1250));
    expect(finishes).toBe(1);
    expect(component.getResponse()).toBe("A");
    expect(component.getRT()).toBe(250);
    expect(manager.getData().response_event_type).toBe("click");
    manager.detach();
    component.destroy();
  });

  it("disabled manager fallback uses shared event timing via pointerdown", () => {
    const { component, display } = renderDomButton({ managerEnabled: false });
    vi.spyOn(performance, "now").mockReturnValue(1270);
    const button = display.querySelector("button") as HTMLButtonElement;
    button.dispatchEvent(eventWithTimestamp(
      new PointerEvent("pointerdown", { clientX: 0, clientY: 0, pointerType: "mouse" }),
      1250,
    ));
    expect(component.getResponse()).toBe("A");
    expect(component.getRT()).toBe(250);
    expect(component.getResponseEventType()).toBe("pointerdown");
    component.destroy();
  });
});

describe("ButtonResponseComponent default canvas path accessibility", () => {
  let restoreContexts: (() => void) | null = null;

  beforeEach(() => {
    installFakeRaf();
    restoreContexts = installFakeCanvasContexts();
  });

  afterEach(() => {
    restoreFakeRaf();
    restoreContexts?.();
    vi.restoreAllMocks();
    document.body.innerHTML = "";
  });

  function renderCanvasButton(onFinish?: () => boolean | void) {
    const jsPsych = fakeJsPsych();
    const component = new ButtonResponseComponent(jsPsych);
    const display = document.createElement("div");
    document.body.appendChild(display);
    const container = document.createElement("div");
    document.body.appendChild(container);
    container.getBoundingClientRect = () =>
      ({
        left: 0,
        top: 0,
        width: 1024,
        height: 768,
        right: 1024,
        bottom: 768,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }) as DOMRect;
    const manager = new ResponseTimingManager({
      trial: {},
      timing: makeTiming(1000),
      container,
      canvasWidth: 1024,
      canvasHeight: 768,
      onFinish: onFinish ?? (() => true),
    });
    const onResponse = vi.fn();
    component.render(
      display,
      {
        name: "Button_1",
        choices: ["A"],
        enable_button_after: 0,
        zIndex: 0,
        button_color: "#e7e7e7",
        __timing: makeTiming(1000),
        __responseTiming: manager,
      },
      onResponse,
    );
    return { component, display, manager, onResponse };
  }

  function pointerdownEvent(timeStamp: number) {
    return eventWithTimestamp(
      new PointerEvent("pointerdown", {
        clientX: 512,
        clientY: 384,
        pointerType: "mouse",
      }),
      timeStamp,
    );
  }

  it("canvas pointerdown records exactly once through the manager", () => {
    let finishes = 0;
    const { component, manager } = renderCanvasButton(() => {
      finishes += 1;
      return true;
    });
    manager.attach();
    vi.spyOn(performance, "now").mockReturnValue(1270);
    window.dispatchEvent(pointerdownEvent(1250));
    expect(finishes).toBe(1);
    expect(component.getResponse()).toBe("A");
    expect(component.getRT()).toBe(250);
    expect(component.getResponseEventType()).toBe("pointerdown");
    expect(manager.getData().response_event_type).toBe("pointerdown");
    manager.detach();
    component.destroy();
  });

  it("a following click cannot record or finish again after canvas pointerdown", () => {
    let finishes = 0;
    const { component, display, manager, onResponse } = renderCanvasButton(
      () => {
        finishes += 1;
        return true;
      },
    );
    manager.attach();
    vi.spyOn(performance, "now").mockReturnValue(1270);
    window.dispatchEvent(pointerdownEvent(1250));
    expect(finishes).toBe(1);

    const overlayButton = display.querySelector(
      ".jspsych-button-response-accessibility-overlay button",
    ) as HTMLButtonElement;
    overlayButton.dispatchEvent(eventWithTimestamp(new MouseEvent("click"), 1260));

    expect(finishes).toBe(1);
    expect(component.getRT()).toBe(250);
    expect(manager.getData().response_event_type).toBe("pointerdown");
    expect(onResponse).not.toHaveBeenCalled();
    manager.detach();
    component.destroy();
  });

  it("keyboard/programmatic click routes through recordExternalEvent", () => {
    let finishes = 0;
    const { component, display, manager, onResponse } = renderCanvasButton(
      () => {
        finishes += 1;
        return true;
      },
    );
    manager.attach();
    vi.spyOn(performance, "now").mockReturnValue(1270);
    const overlayButton = display.querySelector(
      ".jspsych-button-response-accessibility-overlay button",
    ) as HTMLButtonElement;
    overlayButton.dispatchEvent(eventWithTimestamp(new MouseEvent("click"), 1250));

    expect(finishes).toBe(1);
    expect(component.getResponse()).toBe("A");
    expect(component.getRT()).toBe(250);
    expect(component.getResponseEventType()).toBe("click");
    expect(onResponse).not.toHaveBeenCalled();
    manager.detach();
    component.destroy();
  });

  it("manager remains the timestamp authority for canvas accessibility clicks", () => {
    const { component, display, manager } = renderCanvasButton();
    manager.attach();
    vi.spyOn(performance, "now").mockReturnValue(1270);
    const overlayButton = display.querySelector(
      ".jspsych-button-response-accessibility-overlay button",
    ) as HTMLButtonElement;
    overlayButton.dispatchEvent(eventWithTimestamp(new MouseEvent("click"), 1250));

    const data = manager.getData();
    expect(data.response_time).toBe(1250);
    expect(data.response_timestamp_source).toBe("event.timeStamp");
    expect(data.rt_raw).toBe(250);
    expect(data.response_event_type).toBe("click");
    expect(data.response_device).toBe("activation");
    // The component RT comes from the manager's accepted response.
    expect(component.getRT()).toBe(data.rt_raw);
    manager.detach();
    component.destroy();
  });

  it("the accessibility overlay is non-visual and mirrors the button layout", () => {
    const { display } = renderCanvasButton();
    const overlay = display.querySelector(
      ".jspsych-button-response-accessibility-overlay",
    ) as HTMLElement;
    expect(overlay).not.toBeNull();
    expect(overlay.style.opacity).not.toBe("1");
    const button = overlay.querySelector("button") as HTMLButtonElement;
    expect(button).not.toBeNull();
    expect(button.style.opacity).toBe("0");
    expect(button.getAttribute("aria-label")).toBe("A");
    expect(button.dataset.choice).toBe("A");
  });

  it("uses unique overlay ids when multiple button components with the same name coexist", () => {
    const jsPsych = fakeJsPsych();
    const display = document.createElement("div");
    document.body.appendChild(display);
    const container = document.createElement("div");
    document.body.appendChild(container);
    container.getBoundingClientRect = () =>
      ({
        left: 0,
        top: 0,
        width: 1024,
        height: 768,
        right: 1024,
        bottom: 768,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }) as DOMRect;
    const manager = new ResponseTimingManager({
      trial: {},
      timing: makeTiming(1000),
      container,
      canvasWidth: 1024,
      canvasHeight: 768,
      onFinish: () => true,
    });
    const first = new ButtonResponseComponent(jsPsych);
    const second = new ButtonResponseComponent(jsPsych);
    const baseConfig = {
      enable_button_after: 0,
      zIndex: 0,
      __timing: makeTiming(1000),
      __responseTiming: manager,
    };
    // Same explicit trial.name: drawable ids may collide by design, but the
    // accessibility overlay ids must stay unique per instance.
    first.render(
      display,
      { name: "Button_1", choices: ["A"], ...baseConfig },
      () => {},
    );
    second.render(
      display,
      { name: "Button_1", choices: ["B"], ...baseConfig },
      () => {},
    );
    const ids = Array.from(
      display.querySelectorAll(".jspsych-button-response-accessibility-overlay"),
    ).map((element) => element.id);
    expect(ids).toHaveLength(2);
    expect(new Set(ids).size).toBe(2);
    first.destroy();
    second.destroy();
  });
});

describe("pending Input/Slider submit timestamp inheritance", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = "";
  });

  it("records InputResponse with the authoritative submit event, not handler time", () => {
    const timing = makeTiming(1000);
    const component = new InputResponseComponent(fakeJsPsych());
    const display = document.createElement("div");
    document.body.appendChild(display);
    const config = {
      text: "%%",
      allow_blanks: true,
      check_answers: false,
      case_sensitivity: true,
      autofocus: false,
      coordinates: { x: 0, y: 0 },
      __timing: timing,
    };
    component.render(display, config);
    (display.querySelector("input") as HTMLInputElement).value = "answer";
    vi.spyOn(performance, "now").mockReturnValue(1110);
    const signal = createParticipantResponseSignal(
      eventWithTimestamp(new Event("submit"), 1100),
      { eventType: "submit", componentId: "submit-button" },
    );

    expect(component.recordResponse(config, signal)).toBe(true);
    expect(component.getRT()).toBe(100);
    expect(component.getResponseTimestampSource()).toBe("event.timeStamp");
    component.destroy();
  });

  it("records SliderResponse with the authoritative submit event", () => {
    const timing = makeTiming(1000);
    const component = new SliderResponseComponent(fakeJsPsych());
    const display = document.createElement("div");
    document.body.appendChild(display);
    const config = {
      min: 0,
      max: 100,
      slider_start: 50,
      require_movement: false,
      labels: [],
      coordinates: { x: 0, y: 0 },
      __canvasStyles: { width: 1024, height: 768 },
      __timing: timing,
    };
    component.render(display, config);
    (display.querySelector('input[type="range"]') as HTMLInputElement).value =
      "73";
    vi.spyOn(performance, "now").mockReturnValue(1110);
    const signal = createParticipantResponseSignal(
      eventWithTimestamp(new Event("submit"), 1100),
      { eventType: "submit", componentId: "submit-button" },
    );

    expect(component.recordResponse(config, signal)).toBe(true);
    expect(component.getResponse()).toBe(73);
    expect(component.getRT()).toBe(100);
    expect(component.getResponseTimestampSource()).toBe("event.timeStamp");
    component.destroy();
  });
});

describe("FileUploadResponseComponent scientific RT", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    document.body.innerHTML = "";
  });

  it("keeps change-event RT when upload completes five seconds later", async () => {
    const component = new FileUploadResponseComponent(fakeJsPsych());
    const display = document.createElement("div");
    document.body.appendChild(display);
    const manager = makeManager();
    const onResponse = vi.fn();
    let resolveFetch!: (value: any) => void;
    const fetchPromise = new Promise((resolve) => {
      resolveFetch = resolve;
    });
    vi.stubGlobal(
      "FileReader",
      class {
        onload: ((event: any) => void) | null = null;
        onerror: (() => void) | null = null;
        readAsDataURL() {
          this.onload?.({ target: { result: "data:text/plain;base64,QQ==" } });
        }
      },
    );
    vi.stubGlobal("localStorage", {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    });
    const fetchMock = vi.fn(() => fetchPromise);
    vi.stubGlobal("fetch", fetchMock);
    const now = vi.spyOn(performance, "now").mockReturnValue(1210);
    component.render(
      display,
      {
        name: "upload",
        __componentId: "upload",
        upload_endpoint: "/upload",
        show_preview: false,
        coordinates: { x: 0, y: 0 },
        __timing: makeTiming(1000),
        __responseTiming: manager,
      },
      onResponse,
    );
    const input = display.querySelector('input[type="file"]') as HTMLInputElement;
    Object.defineProperty(input, "files", {
      configurable: true,
      value: [new File(["A"], "answer.txt", { type: "text/plain" })],
    });
    input.dispatchEvent(eventWithTimestamp(new Event("change"), 1200));
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    now.mockReturnValue(6200);
    resolveFetch({
      ok: true,
      json: async () => ({ fileUrl: "/stored/answer.txt" }),
    });
    await vi.waitFor(() => expect(onResponse).toHaveBeenCalledTimes(1));

    expect(component.getFileSelectionResponseTime()).toBe(1200);
    expect(component.getRT()).toBe(200);
    expect(component.getUploadStartedAt()).toBe(1210);
    expect(component.getUploadCompletedAt()).toBe(6200);
    expect(component.getUploadDurationMs()).toBe(4990);
    expect(manager.getData().response_time).toBe(1200);
    expect(manager.getData().rt_raw).toBe(200);
    expect(onResponse.mock.calls[0][0]).toMatchObject({
      timestamp: 1200,
      timestampSource: "event.timeStamp",
      eventType: "change",
    });
    component.destroy();
  });
});

describe("AudioResponseComponent done-event timestamp", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    document.body.innerHTML = "";
  });

  it("keeps the done click timestamp while recorder shutdown finishes later", async () => {
    class FakeRecorder extends EventTarget {
      state = "inactive";
      start() {
        this.state = "recording";
        this.dispatchEvent(eventWithTimestamp(new Event("start"), 1000));
      }
      stop() {
        this.state = "inactive";
      }
    }
    const recorder = new FakeRecorder();
    const jsPsych = {
      ...fakeJsPsych(),
      pluginAPI: { getMicrophoneRecorder: () => recorder },
    };
    vi.stubGlobal(
      "FileReader",
      class extends EventTarget {
        result = "data:audio/webm;base64,QQ==";
        readAsDataURL() {
          queueMicrotask(() => this.dispatchEvent(new Event("load")));
        }
      },
    );
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:recording");
    const manager = makeManager();
    const component = new AudioResponseComponent(jsPsych as any);
    const display = document.createElement("div");
    document.body.appendChild(display);
    const onResponse = vi.fn();
    const now = vi.spyOn(performance, "now").mockReturnValue(2010);

    await component.render(
      display,
      {
        name: "audio-response",
        __componentId: "audio-response",
        __timing: makeTiming(1000),
        __responseTiming: manager,
        show_done_button: true,
        allow_playback: false,
      },
      onResponse,
    );
    const done = display.querySelector("#finish-trial") as HTMLButtonElement;
    done.dispatchEvent(
      eventWithTimestamp(new MouseEvent("click", { bubbles: true }), 2000),
    );
    expect(onResponse).not.toHaveBeenCalled();

    now.mockReturnValue(2500);
    recorder.dispatchEvent(new Event("stop"));
    await vi.waitFor(() => expect(onResponse).toHaveBeenCalledTimes(1));

    expect(manager.getData().response_time).toBe(2000);
    expect(manager.getData().rt_raw).toBe(1000);
    expect(component.getRT()).toBe(1000);
    expect(component.getResponseTimestampSource()).toBe("event.timeStamp");
    expect(onResponse.mock.calls[0][0]).toMatchObject({
      timestamp: 2000,
      timestampSource: "event.timeStamp",
      eventType: "click",
    });
    component.destroy();
  });
});
