import { afterEach, describe, expect, it, vi } from "vitest";

import SketchpadComponent from "../components/SketchpadComponent";
import { ResponseTimingManager } from "../utils/ResponseTimingManager";

describe("component listener cleanup", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = "";
  });

  it("aborts every Sketchpad document/canvas listener across long sequences", () => {
    const observedSignals: AbortSignal[] = [];
    const documentAdd = document.addEventListener.bind(document);
    vi.spyOn(document, "addEventListener").mockImplementation(((
      type: string,
      listener: EventListenerOrEventListenerObject,
      options?: any,
    ) => {
      if (options?.signal) observedSignals.push(options.signal);
      documentAdd(type, listener, options);
    }) as typeof document.addEventListener);

    for (let index = 0; index < 100; index++) {
      const component = new SketchpadComponent({} as any);
      const canvas = document.createElement("canvas");
      const canvasAdd = canvas.addEventListener.bind(canvas);
      vi.spyOn(canvas, "addEventListener").mockImplementation(((
        type: string,
        listener: EventListenerOrEventListenerObject,
        options?: any,
      ) => {
        if (options?.signal) observedSignals.push(options.signal);
        canvasAdd(type, listener, options);
      }) as typeof canvas.addEventListener);
      (component as any).canvas = canvas;
      (component as any).setup_event_listeners({
        key_to_draw: "a",
        show_undo_button: false,
        show_clear_button: false,
      });
      component.destroy();
    }

    expect(observedSignals.length).toBeGreaterThan(0);
    expect(observedSignals.every((signal) => signal.aborted)).toBe(true);
  });

  it("uses one armed response hub and switches only the active manager", () => {
    const windowEvents: string[] = [];
    const documentEvents: string[] = [];
    const observedSignals = new Set<AbortSignal>();
    const windowAdd = window.addEventListener.bind(window);
    const documentAdd = document.addEventListener.bind(document);
    vi.spyOn(window, "addEventListener").mockImplementation(((
      type: string,
      listener: EventListenerOrEventListenerObject,
      options?: any,
    ) => {
      windowEvents.push(type);
      if (options?.signal) observedSignals.add(options.signal);
      windowAdd(type, listener, options);
    }) as typeof window.addEventListener);
    vi.spyOn(document, "addEventListener").mockImplementation(((
      type: string,
      listener: EventListenerOrEventListenerObject,
      options?: any,
    ) => {
      documentEvents.push(type);
      if (options?.signal) observedSignals.add(options.signal);
      documentAdd(type, listener, options);
    }) as typeof document.addEventListener);

    const timing = {
      getOnsetTime: () => 0,
      getScheduledTrialTimeOrigin: () => 0,
      getFrameIntervalEstimate: () => 1000 / 60,
      findStimulusRecord: () => ({
        scheduled_onset_abs: 0,
        frame_onset_abs: 0,
      }),
    };
    const managers = Array.from({ length: 100 }, () => {
      const container = document.createElement("div");
      document.body.appendChild(container);
      return new ResponseTimingManager({
        trial: {
          response_timing_enabled: true,
          response_ends_trial: false,
          response_rt_anchor: "stimulus_commit",
        },
        timing,
        container,
        canvasWidth: 1024,
        canvasHeight: 768,
      });
    });
    const accepted = [0, 0];
    for (let index = 0; index < 2; index++) {
      managers[index].registerKeyboardTarget({
        componentId: `keyboard-${index}`,
        componentName: `keyboard-${index}`,
        choices: "ALL_KEYS",
        caseSensitive: false,
        minimumValidRtMs: null,
        onResponse: () => {
          accepted[index] += 1;
        },
      });
    }

    managers.forEach((manager) => manager.arm());
    expect(windowEvents.filter((type) => type === "keydown")).toHaveLength(1);
    expect(windowEvents.filter((type) => type === "pointerdown")).toHaveLength(
      1,
    );
    expect(windowEvents.filter((type) => type === "blur")).toHaveLength(1);
    expect(
      documentEvents.filter((type) => type === "visibilitychange"),
    ).toHaveLength(1);

    managers[0].activate();
    window.dispatchEvent(
      new KeyboardEvent("keydown", { key: "a", code: "KeyA" }),
    );
    managers[1].activate();
    window.dispatchEvent(
      new KeyboardEvent("keydown", { key: "b", code: "KeyB" }),
    );
    expect(accepted).toEqual([1, 1]);

    managers.forEach((manager) => manager.detach());
    expect([...observedSignals]).toHaveLength(1);
    expect([...observedSignals][0].aborted).toBe(true);
  });
});
