import { afterEach, describe, expect, it, vi } from "vitest";
import ResponseTimingManager from "../utils/ResponseTimingManager";

function createTiming(onset: number | null) {
  return {
    getOnsetTime: () => onset,
    getFrameIntervalEstimate: () => 1000 / 60,
  };
}

function createManager(
  overrides: {
    timing?: any;
    trial?: Record<string, any>;
    onFinish?: (
      timestamp?: number | null,
      options?: { force: boolean },
    ) => boolean | void;
  } = {},
) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const manager = new ResponseTimingManager({
    trial: overrides.trial ?? {},
    timing: overrides.timing ?? createTiming(1000),
    container,
    canvasWidth: 1024,
    canvasHeight: 768,
    onFinish: overrides.onFinish ?? (() => true),
  });
  return { manager, container };
}

function keydownEvent(key: string, timeStamp: number, repeat = false) {
  const event = new KeyboardEvent("keydown", { key, repeat });
  Object.defineProperty(event, "timeStamp", { value: timeStamp });
  return event;
}

function pointerdownEvent(x = 10, y = 10) {
  const event = new PointerEvent("pointerdown", {
    clientX: x,
    clientY: y,
    pointerType: "mouse",
  });
  return event;
}

describe("ResponseTimingManager baseline characterization", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = "";
  });

  it("uses a valid event.timeStamp as response_time", () => {
    const captured: any[] = [];
    const { manager } = createManager();
    manager.attach();
    manager.registerKeyboardTarget({
      componentId: "kb",
      componentName: "Keyboard",
      choices: "ALL_KEYS",
      caseSensitive: false,
      minimumValidRtMs: null,
      onResponse: (response: any) => {
        captured.push(response);
      },
    });
    vi.spyOn(performance, "now").mockReturnValue(1270);
    window.dispatchEvent(keydownEvent("a", 1250));
    expect(captured).toHaveLength(1);
    expect(captured[0].response_time).toBe(1250);
    expect(captured[0].response_timestamp_source).toBe("event.timeStamp");
    expect(captured[0].rt_raw).toBe(250);
    expect(captured[0].rt).toBe(250);
    manager.detach();
  });

  it("falls back to handler-time performance.now() for invalid timestamps", () => {
    const captured: any[] = [];
    const { manager } = createManager();
    manager.attach();
    manager.registerKeyboardTarget({
      componentId: "kb",
      componentName: "Keyboard",
      choices: "ALL_KEYS",
      caseSensitive: false,
      minimumValidRtMs: null,
      onResponse: (response: any) => {
        captured.push(response);
      },
    });
    vi.spyOn(performance, "now").mockReturnValue(1270);
    window.dispatchEvent(keydownEvent("a", 0));
    expect(captured).toHaveLength(1);
    expect(captured[0].response_time).toBe(1270);
    expect(captured[0].response_timestamp_source).toBe(
      "performance.now_fallback",
    );
    manager.detach();
  });

  it("ignores keyboard repeat events", () => {
    const captured: any[] = [];
    const { manager } = createManager();
    manager.attach();
    manager.registerKeyboardTarget({
      componentId: "kb",
      componentName: "Keyboard",
      choices: "ALL_KEYS",
      caseSensitive: false,
      minimumValidRtMs: null,
      onResponse: (response: any) => {
        captured.push(response);
      },
    });
    window.dispatchEvent(keydownEvent("a", 1250, true));
    expect(captured).toHaveLength(0);
    manager.detach();
  });

  it("records a pointer target response only once", () => {
    const captured: any[] = [];
    let finishes = 0;
    const { manager } = createManager({
      onFinish: () => {
        finishes += 1;
        return true;
      },
    });
    manager.attach();
    manager.registerPointerTarget({
      componentId: "btn",
      componentName: "Button",
      label: "choice-a",
      hitTest: () => true,
      onResponse: (response: any) => {
        captured.push(response);
      },
    });
    vi.spyOn(performance, "now").mockReturnValue(1270);
    const first = pointerdownEvent();
    Object.defineProperty(first, "timeStamp", { value: 1250 });
    window.dispatchEvent(first);
    const second = pointerdownEvent();
    Object.defineProperty(second, "timeStamp", { value: 1260 });
    window.dispatchEvent(second);
    expect(captured).toHaveLength(1);
    expect(captured[0].rt_raw).toBe(250);
    expect(finishes).toBe(1);
    manager.detach();
  });
});

describe("ResponseTimingManager V2 semantics", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = "";
  });

  it("rt_raw = response - trial_time_origin for fresh_raf origin", () => {
    const captured: any[] = [];
    const { manager } = createManager({
      timing: {
        getOnsetTime: () => 1000,
        getTrialTimeOrigin: () => 1000,
        getFrameIntervalEstimate: () => 1000 / 60,
      },
      onFinish: () => true,
    });
    manager.attach();
    manager.registerKeyboardTarget({
      componentId: "kb",
      componentName: "Keyboard",
      choices: "ALL_KEYS",
      caseSensitive: false,
      minimumValidRtMs: null,
      onResponse: (response: any) => captured.push(response),
    });
    vi.spyOn(performance, "now").mockReturnValue(1270);
    window.dispatchEvent(keydownEvent("a", 1250));
    expect(captured[0].rt_raw).toBe(250);
    expect(captured[0].rt).toBe(250);
    manager.detach();
  });

  it("preserves scheduled, visual-commit, and trial-origin RT anchors separately", () => {
    const captured: any[] = [];
    const stimulusRecord = {
      component_id: "target",
      name: "target",
      scheduled_onset_abs: 100,
      frame_onset_abs: 108.333,
    };
    const { manager } = createManager({
      trial: {
        response_rt_anchor: { from: "stimulus_commit", component: "target" },
      },
      timing: {
        getOnsetTime: () => 108.333,
        getScheduledTrialTimeOrigin: () => 100,
        getFrameIntervalEstimate: () => 1000 / 60,
        findStimulusRecord: () => stimulusRecord,
      },
      onFinish: () => true,
    });
    manager.attach();
    manager.registerKeyboardTarget({
      componentId: "kb",
      componentName: "Keyboard",
      choices: "ALL_KEYS",
      caseSensitive: false,
      minimumValidRtMs: null,
      onResponse: (response: any) => captured.push(response),
    });

    vi.spyOn(performance, "now").mockReturnValue(309);
    window.dispatchEvent(keydownEvent("a", 308.333));

    expect(captured[0].rt_scheduled_onset).toBe(208.333);
    expect(captured[0].rt_visual_commit).toBe(200);
    expect(captured[0].rt_trial_origin).toBe(200);
    expect(captured[0].rt_raw).toBe(200);
    expect(captured[0].rt_anchor).toBe("stimulus_commit");
    expect(captured[0].rt_anchor_component).toBe("target");
    manager.detach();
  });

  it("response_event_lag is never subtracted from RT", () => {
    const captured: any[] = [];
    const { manager } = createManager({ onFinish: () => true });
    manager.attach();
    manager.registerKeyboardTarget({
      componentId: "kb",
      componentName: "Keyboard",
      choices: "ALL_KEYS",
      caseSensitive: false,
      minimumValidRtMs: null,
      onResponse: (response: any) => captured.push(response),
    });
    // event at 1250, handler at 1270 -> lag 20ms. rt_raw must stay 250.
    vi.spyOn(performance, "now").mockReturnValue(1270);
    window.dispatchEvent(keydownEvent("a", 1250));
    expect(captured[0].response_event_lag).toBe(20);
    expect(captured[0].rt_raw).toBe(250);
    manager.detach();
  });

  it("rt_from_allowed_onset uses the allowed-from absolute time separately", () => {
    const captured: any[] = [];
    const { manager } = createManager({
      trial: { response_allowed_from: { from: "trial_onset", at_ms: 300 } },
      onFinish: () => true,
    });
    manager.attach();
    manager.registerKeyboardTarget({
      componentId: "kb",
      componentName: "Keyboard",
      choices: "ALL_KEYS",
      caseSensitive: false,
      minimumValidRtMs: null,
      onResponse: (response: any) => captured.push(response),
    });
    vi.spyOn(performance, "now").mockReturnValue(1470);
    window.dispatchEvent(keydownEvent("a", 1450));
    expect(captured[0].rt_raw).toBe(450);
    expect(captured[0].rt_from_allowed_onset).toBe(150);
    manager.detach();
  });

  it("minimum RT semantics reject responses below the bound", () => {
    const captured: any[] = [];
    let finishes = 0;
    const { manager } = createManager({
      trial: { minimum_valid_rt_ms: 300 },
      onFinish: () => {
        finishes += 1;
        return true;
      },
    });
    manager.attach();
    manager.registerKeyboardTarget({
      componentId: "kb",
      componentName: "Keyboard",
      choices: "ALL_KEYS",
      caseSensitive: false,
      minimumValidRtMs: null,
      onResponse: (response: any) => captured.push(response),
    });
    vi.spyOn(performance, "now").mockReturnValue(1270);
    window.dispatchEvent(keydownEvent("a", 1250)); // rt 250 < 300
    expect(captured).toHaveLength(0);
    expect(manager.getData().response_invalid_reason).toBe("below_minimum_rt");
    expect(manager.getData().rt_raw).toBeNull();
    expect(finishes).toBe(1);
    manager.detach();
  });

  it("response before the allowed gate is rejected per policy", () => {
    const captured: any[] = [];
    let finishes = 0;
    const { manager } = createManager({
      trial: {
        response_allowed_from: { from: "trial_onset", at_ms: 300 },
        premature_response_policy: "end_invalid",
      },
      onFinish: (timestamp, options) => {
        finishes += 1;
        return true;
      },
    });
    manager.attach();
    manager.registerKeyboardTarget({
      componentId: "kb",
      componentName: "Keyboard",
      choices: "ALL_KEYS",
      caseSensitive: false,
      minimumValidRtMs: null,
      onResponse: (response: any) => captured.push(response),
    });
    vi.spyOn(performance, "now").mockReturnValue(1170);
    window.dispatchEvent(keydownEvent("a", 1150)); // before 1300 gate
    expect(captured).toHaveLength(0);
    expect(finishes).toBe(1);
    expect(manager.getData().response_invalid_reason).toBe(
      "before_response_allowed",
    );
    manager.detach();
  });

  it("allows responses relative to a component scheduled onset", () => {
    const captured: any[] = [];
    const stimulusRecord = {
      component_id: "target",
      name: "target",
      scheduled_onset_abs: 1100,
      frame_onset_abs: 1116.667,
    };
    const { manager } = createManager({
      trial: {
        response_allowed_from: {
          from: "scheduled_onset",
          component: "target",
          at_ms: 25,
        },
      },
      timing: {
        getOnsetTime: () => 1000,
        getFrameIntervalEstimate: () => 1000 / 60,
        findStimulusRecord: () => stimulusRecord,
      },
      onFinish: () => true,
    });
    manager.attach();
    manager.registerKeyboardTarget({
      componentId: "kb",
      componentName: "Keyboard",
      choices: "ALL_KEYS",
      caseSensitive: false,
      minimumValidRtMs: null,
      onResponse: (response: any) => captured.push(response),
    });

    vi.spyOn(performance, "now").mockReturnValue(1140);
    window.dispatchEvent(keydownEvent("a", 1130));
    expect(captured).toHaveLength(1);
    expect(captured[0].response_allowed_from_abs).toBe(1125);
    expect(captured[0].rt_from_allowed_onset).toBe(5);
    manager.detach();
  });

  it("classifies a response before the real component commit as premature", () => {
    const captured: any[] = [];
    const stimulusRecord = {
      component_id: "target",
      name: "target",
      scheduled_onset_abs: 1050,
      frame_onset_abs: 1100,
    };
    const { manager } = createManager({
      trial: {
        response_allowed_from: {
          from: "stimulus_commit",
          component: "target",
          at_ms: 0,
        },
        premature_response_policy: "end_invalid",
      },
      timing: {
        getOnsetTime: () => 1000,
        getFrameIntervalEstimate: () => 1000 / 60,
        findStimulusRecord: () => stimulusRecord,
      },
      onFinish: () => true,
    });
    manager.attach();
    manager.registerKeyboardTarget({
      componentId: "kb",
      componentName: "Keyboard",
      choices: "ALL_KEYS",
      caseSensitive: false,
      minimumValidRtMs: null,
      onResponse: (response: any) => captured.push(response),
    });

    vi.spyOn(performance, "now").mockReturnValue(1080);
    window.dispatchEvent(keydownEvent("a", 1075));
    expect(captured).toHaveLength(0);
    expect(manager.getData().response_allowed_from_abs).toBe(1100);
    expect(manager.getData().rt_from_allowed_onset).toBe(-25);
    expect(manager.getData().response_invalid_reason).toBe(
      "before_response_allowed",
    );
    manager.detach();
  });

  it("rejects a missing response-allowed component without origin fallback", () => {
    const { manager } = createManager({
      trial: {
        response_allowed_from: {
          from: "stimulus_commit",
          component: "missing",
          at_ms: 0,
        },
      },
      timing: {
        getOnsetTime: () => 1000,
        getFrameIntervalEstimate: () => 1000 / 60,
        findStimulusRecord: () => null,
      },
      onFinish: () => true,
    });
    manager.attach();
    manager.registerKeyboardTarget({
      componentId: "kb",
      componentName: "Keyboard",
      choices: "ALL_KEYS",
      caseSensitive: false,
      minimumValidRtMs: null,
    });

    vi.spyOn(performance, "now").mockReturnValue(1200);
    window.dispatchEvent(keydownEvent("a", 1190));
    expect(manager.getData().response_allowed_from_abs).toBeNull();
    expect(manager.getData().response_invalid_reason).toBe(
      "response_allowed_component_missing",
    );
    manager.detach();
  });

  it("rejects a missing RT-anchor component without origin fallback", () => {
    const { manager } = createManager({
      trial: {
        response_rt_anchor: {
          from: "stimulus_commit",
          component: "missing",
        },
      },
      timing: {
        getOnsetTime: () => 1000,
        getFrameIntervalEstimate: () => 1000 / 60,
        findStimulusRecord: () => null,
      },
      onFinish: () => true,
    });
    manager.attach();
    manager.registerKeyboardTarget({
      componentId: "kb",
      componentName: "Keyboard",
      choices: "ALL_KEYS",
      caseSensitive: false,
      minimumValidRtMs: null,
    });

    vi.spyOn(performance, "now").mockReturnValue(1200);
    window.dispatchEvent(keydownEvent("a", 1190));
    expect(manager.getData().rt_anchor_time_abs).toBeNull();
    expect(manager.getData().response_invalid_reason).toBe(
      "response_anchor_component_missing",
    );
    manager.detach();
  });

  it("premature policy ignore does not end or accept the response", () => {
    const captured: any[] = [];
    let finishes = 0;
    const { manager } = createManager({
      trial: {
        response_allowed_from: { from: "trial_onset", at_ms: 300 },
        premature_response_policy: "ignore",
      },
      onFinish: () => {
        finishes += 1;
        return true;
      },
    });
    manager.attach();
    manager.registerKeyboardTarget({
      componentId: "kb",
      componentName: "Keyboard",
      choices: "ALL_KEYS",
      caseSensitive: false,
      minimumValidRtMs: null,
      onResponse: (response: any) => captured.push(response),
    });
    vi.spyOn(performance, "now").mockReturnValue(1170);
    window.dispatchEvent(keydownEvent("a", 1150));
    expect(captured).toHaveLength(0);
    expect(finishes).toBe(0);
    manager.detach();
  });

  it("calibration matched keeps raw unchanged and corrected separate", () => {
    const captured: any[] = [];
    const { manager } = createManager({
      trial: {
        response_calibration_profile: {
          id: "p1",
          browser_family: "Chrome",
          os_family: "macOS",
          input_device: "keyboard",
          display_hz: 60,
          bias_ms: 40,
        },
      },
      onFinish: () => true,
    });
    Object.defineProperty(window.navigator, "userAgent", {
      value: "Mozilla/5.0 (Macintosh) AppleWebKit/537.36 Chrome/120 Safari",
      configurable: true,
    });
    manager.attach();
    manager.registerKeyboardTarget({
      componentId: "kb",
      componentName: "Keyboard",
      choices: "ALL_KEYS",
      caseSensitive: false,
      minimumValidRtMs: null,
      onResponse: (response: any) => captured.push(response),
    });
    vi.spyOn(performance, "now").mockReturnValue(1270);
    window.dispatchEvent(keydownEvent("a", 1250));
    expect(captured[0].rt_raw).toBe(250);
    expect(captured[0].rt).toBe(250);
    expect(captured[0].rt_corrected).toBe(210);
    manager.detach();
  });

  it("calibration mismatch leaves corrected null", () => {
    const captured: any[] = [];
    const { manager } = createManager({
      trial: {
        response_calibration_profile: {
          id: "p1",
          browser_family: "Firefox",
          os_family: "Windows",
          input_device: "keyboard",
          display_hz: 60,
          bias_ms: 40,
        },
      },
      onFinish: () => true,
    });
    Object.defineProperty(window.navigator, "userAgent", {
      value: "Mozilla/5.0 (Macintosh) AppleWebKit/537.36 Chrome/120 Safari",
      configurable: true,
    });
    manager.attach();
    manager.registerKeyboardTarget({
      componentId: "kb",
      componentName: "Keyboard",
      choices: "ALL_KEYS",
      caseSensitive: false,
      minimumValidRtMs: null,
      onResponse: (response: any) => captured.push(response),
    });
    vi.spyOn(performance, "now").mockReturnValue(1270);
    window.dispatchEvent(keydownEvent("a", 1250));
    expect(captured[0].rt_raw).toBe(250);
    expect(captured[0].rt_corrected).toBeNull();
    manager.detach();
  });

  it("recordExternalEvent reuses the shared timestamp and anchor path", () => {
    const { manager } = createManager({ onFinish: () => true });
    manager.attach();
    vi.spyOn(performance, "now").mockReturnValue(1270);
    const accepted = manager.recordExternalEvent(
      keydownEvent("a", 1250),
      { eventType: "click", device: "activation" },
      () => true,
    );
    expect(accepted).toBe(true);
    const data = manager.getData();
    expect(data.rt_raw).toBe(250);
    expect(data.response_event_type).toBe("click");
    expect(data.response_timestamp_source).toBe("event.timeStamp");
    manager.detach();
  });

  it("recordExternalEvent callback returning false rolls back the response", () => {
    let finishes = 0;
    const { manager } = createManager({
      onFinish: () => {
        finishes += 1;
        return true;
      },
    });
    manager.attach();
    vi.spyOn(performance, "now").mockReturnValue(1270);
    const accepted = manager.recordExternalEvent(
      keydownEvent("a", 1250),
      { eventType: "click", device: "activation" },
      () => false,
    );
    expect(accepted).toBe(false);
    expect(finishes).toBe(0);
    expect(manager.getData().rt_raw).toBeNull();
    manager.detach();
  });

  it("accepted external event triggers at most one finish", () => {
    let finishes = 0;
    const { manager } = createManager({
      onFinish: () => {
        finishes += 1;
        return true;
      },
    });
    manager.attach();
    vi.spyOn(performance, "now").mockReturnValue(1270);
    manager.recordExternalEvent(
      keydownEvent("a", 1250),
      { eventType: "click", device: "activation" },
      () => true,
    );
    expect(finishes).toBe(1);
    const second = manager.recordExternalEvent(
      keydownEvent("b", 1260),
      { eventType: "click", device: "activation" },
      () => true,
    );
    expect(second).toBe(false);
    expect(finishes).toBe(1);
    manager.detach();
  });
});

describe("shared hub boundary switch (P0.1: zero visible-but-not-responding window)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = "";
  });

  it("pointerdown after B's commit is captured by B while A's bookkeeping is still pending", () => {
    const capturedA: any[] = [];
    const capturedB: any[] = [];
    let aFinishes = 0;
    let bFinishes = 0;
    const timingA = {
      getOnsetTime: () => 1000,
      getTrialTimeOrigin: () => 1000,
      getScheduledTrialTimeOrigin: () => 1000,
      getFrameIntervalEstimate: () => 1000 / 60,
      findStimulusRecord: () => ({
        component_id: "target-a",
        name: "target-a",
        scheduled_onset_abs: 1000,
        frame_onset_abs: 1000,
      }),
    };
    const timingB = {
      getOnsetTime: () => 2000,
      getTrialTimeOrigin: () => 2000,
      getScheduledTrialTimeOrigin: () => 2000,
      getFrameIntervalEstimate: () => 1000 / 60,
      findStimulusRecord: () => ({
        component_id: "target-b",
        name: "target-b",
        scheduled_onset_abs: 2000,
        frame_onset_abs: 2000,
      }),
    };
    const a = createManager({
      timing: timingA,
      trial: { response_allowed_from: "trial_onset" },
      onFinish: () => {
        aFinishes += 1;
        return true;
      },
    });
    const b = createManager({
      timing: timingB,
      trial: {
        response_allowed_from: "trial_onset",
        response_rt_anchor: { from: "stimulus_commit", component: "target-b" },
      },
      onFinish: () => {
        bFinishes += 1;
        return true;
      },
    });
    // Both hubs armed during prepare(); the shared DOM listeners exist once.
    a.manager.arm();
    b.manager.arm();
    a.manager.registerPointerTarget({
      componentId: "btn-a",
      componentName: "Button-A",
      label: "a",
      hitTest: () => true,
      onResponse: (response: any) => capturedA.push(response),
    });
    b.manager.registerPointerTarget({
      componentId: "btn-b",
      componentName: "Button-B",
      label: "b",
      hitTest: () => true,
      onResponse: (response: any) => capturedB.push(response),
    });

    // rAF boundary tick: O(1) hub switch, no listener installation.
    a.manager.activate();
    const addEventListenerSpy = vi.spyOn(window, "addEventListener");
    a.manager.deactivate();
    b.manager.activate();
    const listenerCallsDuringSwitch = addEventListenerSpy.mock.calls.filter(
      ([type]) => type === "keydown" || type === "pointerdown",
    );
    expect(listenerCallsDuringSwitch).toHaveLength(0);

    // Pointerdown 2 ms after B's visual commit, while A's bookkeeping has not
    // finished. The event belongs to B only.
    vi.spyOn(performance, "now").mockReturnValue(2002);
    const event = pointerdownEvent();
    Object.defineProperty(event, "timeStamp", { value: 2002 });
    window.dispatchEvent(event);

    expect(capturedB).toHaveLength(1);
    expect(capturedB[0].response_time).toBe(2002);
    expect(capturedB[0].response_timestamp_source).toBe("event.timeStamp");
    expect(capturedB[0].rt_visual_commit).toBe(2);
    expect(capturedB[0].rt_trial_origin).toBe(2);
    expect(capturedB[0].response_valid).toBe(true);
    expect(capturedA).toHaveLength(0);
    expect(aFinishes).toBe(0);
    expect(bFinishes).toBe(1);

    a.manager.detach();
    b.manager.detach();
  });

  it("keydown before B's commit is still classified against A, never B", () => {
    const capturedA: any[] = [];
    const capturedB: any[] = [];
    const timingA = {
      getOnsetTime: () => 1000,
      getTrialTimeOrigin: () => 1000,
      getScheduledTrialTimeOrigin: () => 1000,
      getFrameIntervalEstimate: () => 1000 / 60,
      findStimulusRecord: () => null,
    };
    const timingB = {
      getOnsetTime: () => 2000,
      getTrialTimeOrigin: () => 2000,
      getScheduledTrialTimeOrigin: () => 2000,
      getFrameIntervalEstimate: () => 1000 / 60,
      findStimulusRecord: () => null,
    };
    const a = createManager({
      timing: timingA,
      trial: { response_allowed_from: "trial_onset" },
      onFinish: () => true,
    });
    const b = createManager({
      timing: timingB,
      trial: { response_allowed_from: "trial_onset" },
      onFinish: () => true,
    });
    a.manager.arm();
    b.manager.arm();
    a.manager.registerKeyboardTarget({
      componentId: "kb-a",
      componentName: "Keyboard-A",
      choices: "ALL_KEYS",
      caseSensitive: false,
      minimumValidRtMs: null,
      onResponse: (response: any) => capturedA.push(response),
    });
    b.manager.registerKeyboardTarget({
      componentId: "kb-b",
      componentName: "Keyboard-B",
      choices: "ALL_KEYS",
      caseSensitive: false,
      minimumValidRtMs: null,
      onResponse: (response: any) => capturedB.push(response),
    });
    a.manager.activate();
    // A keydown arriving before the A→B boundary belongs to A's window.
    vi.spyOn(performance, "now").mockReturnValue(1998);
    window.dispatchEvent(keydownEvent("x", 1998));
    expect(capturedA).toHaveLength(1);
    expect(capturedB).toHaveLength(0);
    a.manager.deactivate();
    b.manager.activate();
    a.manager.detach();
    b.manager.detach();
  });
});
