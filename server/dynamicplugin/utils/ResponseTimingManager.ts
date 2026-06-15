type TimingQuality = "ok" | "warning" | "bad";

type ResponseInvalidReason =
  | "missing_anchor"
  | "anchor_without_onset_commit"
  | "before_anchor"
  | "keyboard_repeat"
  | "timeout"
  | "document_hidden"
  | "window_blur"
  | "below_minimum_rt"
  | "no_valid_response"
  | "calibration_mismatch"
  | "";

type ResponseAllowedFrom =
  | "anchor_onset"
  | "trial_onset"
  | { from: "trial_onset" | "anchor_onset"; at_ms: number };

type ResponseTimingMode = "normal" | "strict";

type CalibrationMatchStatus = "matched" | "partial" | "mismatch" | "none";

type TimestampInfo = {
  response_time: number;
  response_now_at_handler: number;
  response_timestamp_source: "event.timeStamp" | "performance.now_fallback";
  response_event_lag: number;
};

type PointerTarget = {
  componentId: string | null;
  componentName: string | null;
  label?: string | null;
  element?: HTMLElement;
  canvasX?: number;
  canvasY?: number;
  width?: number;
  height?: number;
  hitTest?: (point: {
    clientX: number;
    clientY: number;
    canvasX: number | null;
    canvasY: number | null;
  }) => boolean;
  onResponse?: (response: ResponseTimingResult) => boolean | void;
};

type KeyboardTarget = {
  componentId: string | null;
  componentName: string | null;
  choices: any;
  caseSensitive: boolean;
  minimumValidRtMs: number | null;
  onResponse?: (response: ResponseTimingResult) => boolean | void;
};

export type ResponseTimingResult = ReturnType<ResponseTimingManager["getData"]> & {
  event?: Event;
};

const round3 = (value: number | null): number | null =>
  value === null ? null : Math.round(value * 1000) / 1000;

const resolveRawValue = (value: any) =>
  value && typeof value === "object" && "value" in value ? value.value : value;

const normalizeBoolean = (value: any, fallback: boolean) => {
  const raw = resolveRawValue(value);
  return raw === undefined || raw === null ? fallback : raw !== false;
};

const normalizeString = (value: any, fallback = "") => {
  const raw = resolveRawValue(value);
  return raw === undefined || raw === null ? fallback : String(raw);
};

function parseBrowser(userAgent: string) {
  const ua = userAgent || "";
  const edge = ua.match(/Edg\/(\d+)/);
  if (edge) return { family: "Edge", major: Number(edge[1]) };
  const chrome = ua.match(/Chrome\/(\d+)/);
  if (chrome) return { family: "Chrome", major: Number(chrome[1]) };
  const firefox = ua.match(/Firefox\/(\d+)/);
  if (firefox) return { family: "Firefox", major: Number(firefox[1]) };
  const safari = ua.match(/Version\/(\d+).+Safari/);
  if (safari) return { family: "Safari", major: Number(safari[1]) };
  return { family: "unknown", major: null as number | null };
}

function parseOs(userAgent: string) {
  const ua = userAgent || "";
  if (/Mac OS X|Macintosh/i.test(ua)) return "macOS";
  if (/Windows/i.test(ua)) return "Windows";
  if (/Android/i.test(ua)) return "Android";
  if (/iPhone|iPad|iOS/i.test(ua)) return "iOS";
  if (/Linux/i.test(ua)) return "Linux";
  return "unknown";
}

function normalizeChoices(choices: any, caseSensitive: boolean) {
  const rawChoices = resolveRawValue(choices);
  if (rawChoices === "ALL_KEYS" || rawChoices === "NO_KEYS") return rawChoices;
  const flatChoices = Array.isArray(rawChoices) ? rawChoices.flat() : [rawChoices];
  return caseSensitive
    ? flatChoices
    : flatChoices.map((choice: any) =>
        typeof choice === "string" ? choice.toLowerCase() : choice,
      );
}

function isChoiceValid(validResponses: any, key: string) {
  if (validResponses === "ALL_KEYS") return true;
  if (validResponses === "NO_KEYS") return false;
  return Array.isArray(validResponses) && validResponses.includes(key);
}

export class ResponseTimingManager {
  readonly enabled: boolean;

  private trial: any;
  private timing: any;
  private container: HTMLElement;
  private canvasWidth: number;
  private canvasHeight: number;
  private onFinish?: (
    timestamp?: number | null,
    options?: { force: boolean },
  ) => boolean | void;
  private controller: AbortController | null = null;
  private pointerTargets: PointerTarget[] = [];
  private keyboardTargets: KeyboardTarget[] = [];
  private data: Record<string, any>;
  private responseAllowedFrom: ResponseAllowedFrom = "anchor_onset";
  private responseRecorded = false;
  private hiddenDuringTrial = false;
  private blurDuringTrial = false;
  private responseQualityReasonDetails: string[] = [];

  constructor(options: {
    trial: any;
    timing: any;
    container: HTMLElement;
    canvasWidth: number;
    canvasHeight: number;
    onFinish?: (
      timestamp?: number | null,
      options?: { force: boolean },
    ) => boolean | void;
  }) {
    this.trial = options.trial;
    this.timing = options.timing;
    this.container = options.container;
    this.canvasWidth = options.canvasWidth;
    this.canvasHeight = options.canvasHeight;
    this.onFinish = options.onFinish;
    this.enabled = resolveRawValue(this.trial.response_timing_enabled) === true;
    this.data = this.createInitialData();
  }

  attach() {
    if (!this.enabled || this.controller) return;
    this.controller = new AbortController();
    const options = {
      capture: true,
      passive: false,
      signal: this.controller.signal,
    } as AddEventListenerOptions;

    window.addEventListener("keydown", this.handleKeydown, options);
    window.addEventListener("pointerdown", this.handlePointerDown, options);
    document.addEventListener("visibilitychange", this.handleVisibilityChange, {
      signal: this.controller.signal,
    });
    window.addEventListener("blur", this.handleBlur, {
      capture: true,
      signal: this.controller.signal,
    });
    this.data.response_listener_attached = true;
  }

  detach() {
    if (!this.controller) return;
    this.controller.abort();
    this.controller = null;
    this.data.response_listener_removed = true;
  }

  registerKeyboardTarget(target: KeyboardTarget) {
    if (!this.enabled) return () => {};
    this.keyboardTargets.push(target);
    return () => {
      const index = this.keyboardTargets.indexOf(target);
      if (index >= 0) this.keyboardTargets.splice(index, 1);
    };
  }

  registerPointerTarget(target: PointerTarget) {
    if (!this.enabled) return () => {};
    this.pointerTargets.push(target);
    return () => {
      const index = this.pointerTargets.indexOf(target);
      if (index >= 0) this.pointerTargets.splice(index, 1);
    };
  }

  finishWithoutResponse(offsetTime: number | null = null) {
    if (!this.enabled || this.responseRecorded) return;
    const anchor = this.resolveAnchor();
    if (!anchor.ok) {
      this.recordInvalid(anchor.reason, null, null, null);
    } else if (this.isResponseRequired()) {
      this.data.response_timeout = true;
      this.data.response_timeout_ms =
        typeof offsetTime === "number" && typeof this.data.response_allowed_from_abs === "number"
          ? round3(offsetTime - this.data.response_allowed_from_abs)
          : null;
      this.recordInvalid("timeout", null, null, null);
    } else {
      this.data.response_valid = null;
      this.data.response_invalid_reason = "";
      this.updateResponseQuality();
    }
  }

  getData() {
    if (this.enabled) {
      this.updateResponseQuality();
    }
    return {
      rt: this.data.rt,
      rt_raw: this.data.rt_raw,
      rt_corrected: this.data.rt_corrected,
      response_timing_enabled: this.data.response_timing_enabled,
      response_required: this.data.response_required,
      response_anchor_component_id: this.data.response_anchor_component_id,
      response_anchor_component: this.data.response_anchor_component,
      response_start_anchor: this.data.response_start_anchor,
      stimulus_actual_onset_abs: this.data.stimulus_actual_onset_abs,
      response_allowed_from: this.data.response_allowed_from,
      response_allowed_from_abs: this.data.response_allowed_from_abs,
      premature_response_policy: this.data.premature_response_policy,
      response_timing_quality_mode: this.data.response_timing_quality_mode,
      minimum_valid_rt_ms: this.data.minimum_valid_rt_ms,
      response_before_anchor: this.data.response_before_anchor,
      response_before_anchor_time: this.data.response_before_anchor_time,
      response_timeout: this.data.response_timeout,
      response_timeout_ms: this.data.response_timeout_ms,
      response_time: this.data.response_time,
      response_now_at_handler: this.data.response_now_at_handler,
      response_timestamp_source: this.data.response_timestamp_source,
      response_event_lag: this.data.response_event_lag,
      response_bias_correction_ms: this.data.response_bias_correction_ms,
      response_calibration_profile_id: this.data.response_calibration_profile_id,
      response_calibration_match_status:
        this.data.response_calibration_match_status,
      response_event_type: this.data.response_event_type,
      response_device: this.data.response_device,
      response_key: this.data.response_key,
      response_code: this.data.response_code,
      response_repeat: this.data.response_repeat,
      response_is_trusted: this.data.response_is_trusted,
      response_valid: this.data.response_valid,
      response_invalid_reason: this.data.response_invalid_reason,
      response_client_x: this.data.response_client_x,
      response_client_y: this.data.response_client_y,
      response_canvas_x: this.data.response_canvas_x,
      response_canvas_y: this.data.response_canvas_y,
      device_pixel_ratio: this.data.device_pixel_ratio,
      canvas_bounding_rect: this.data.canvas_bounding_rect,
      response_target_component: this.data.response_target_component,
      response_timing_quality: this.data.response_timing_quality,
      response_timing_quality_reason: this.data.response_timing_quality_reason,
      document_hidden_during_trial: this.hiddenDuringTrial,
      window_blur_during_trial: this.blurDuringTrial,
      response_expected_delay_ms: this.data.response_expected_delay_ms,
      external_reference_id: this.data.external_reference_id,
      response_error_ms: this.data.response_error_ms,
      response_listener_attached: this.data.response_listener_attached,
      response_listener_removed: this.data.response_listener_removed,
    };
  }

  private handleKeydown = (event: KeyboardEvent) => {
    if (!this.enabled || this.responseRecorded) return;
    if (event.repeat) return;

    for (const target of this.keyboardTargets) {
      const comparableKey = target.caseSensitive
        ? event.key
        : event.key.toLowerCase();
      const validResponses = normalizeChoices(target.choices, target.caseSensitive);
      if (!isChoiceValid(validResponses, comparableKey)) continue;

      const accepted = this.tryRecordResponse(event, {
        eventType: "keydown",
        device: "keyboard",
        key: event.key,
        code: event.code,
        repeat: event.repeat,
        targetComponent: target.componentName ?? target.componentId,
        minimumValidRtMs: target.minimumValidRtMs,
      });
      if (!accepted) return;

      const callbackResult = target.onResponse?.({
        ...this.getData(),
        event,
      });
      if (callbackResult === false) {
        this.clearRecordedResponse();
        return;
      }
      event.preventDefault();
      this.finishIfNeeded();
      return;
    }
  };

  private handlePointerDown = (event: PointerEvent) => {
    if (!this.enabled || this.responseRecorded) return;

    const coordinates = this.computePointerCoordinates(event.clientX, event.clientY);
    const target = this.findPointerTarget(
      event.clientX,
      event.clientY,
      coordinates.canvasX,
      coordinates.canvasY,
    );
    if (!target) return;

    const accepted = this.tryRecordResponse(event, {
      eventType: "pointerdown",
      device: event.pointerType || "pointer",
      clientX: event.clientX,
      clientY: event.clientY,
      canvasX: coordinates.canvasX,
      canvasY: coordinates.canvasY,
      canvasBoundingRect: coordinates.canvasBoundingRect,
      targetComponent: target.componentName ?? target.componentId ?? target.label,
    });
    if (!accepted) return;

    const callbackResult = target.onResponse?.({
      ...this.getData(),
      event,
    });
    if (callbackResult === false) {
      this.clearRecordedResponse();
      return;
    }
    event.preventDefault();
    this.finishIfNeeded();
  };

  private handleVisibilityChange = () => {
    if (document.hidden) {
      this.hiddenDuringTrial = true;
      this.data.document_hidden_during_trial = true;
    }
  };

  private handleBlur = () => {
    this.blurDuringTrial = true;
    this.data.window_blur_during_trial = true;
  };

  private tryRecordResponse(
    event: Event,
    details: {
      eventType: string;
      device: string;
      key?: string;
      code?: string;
      repeat?: boolean;
      clientX?: number;
      clientY?: number;
      canvasX?: number | null;
      canvasY?: number | null;
      canvasBoundingRect?: string;
      targetComponent?: string | null;
      minimumValidRtMs?: number | null;
    },
  ) {
    const timestamp = this.getResponseTimestamp(event);
    this.applyCommonEventData(timestamp, event, details);

    const anchor = this.resolveAnchor();
    if (!anchor.ok) {
      if (anchor.reason === "anchor_without_onset_commit") {
        if (this.getPrematurePolicy() === "ignore") return false;
        this.recordBeforeAnchor(timestamp.response_time, anchor.reason);
        this.finishIfNeeded(true);
        return false;
      }
      this.recordInvalid(anchor.reason, timestamp, event, details);
      this.finishIfNeeded(true);
      return false;
    }

    if (
      typeof anchor.allowedFromAbs === "number" &&
      timestamp.response_time < anchor.allowedFromAbs
    ) {
      if (this.getPrematurePolicy() === "ignore") return false;
      this.recordBeforeAnchor(timestamp.response_time, "before_anchor");
      this.finishIfNeeded(true);
      return false;
    }

    const rtRaw = round3(timestamp.response_time - anchor.stimulusActualOnsetAbs);
    const minimumValidRt = this.getMinimumValidRt(details.minimumValidRtMs);
    if (
      typeof rtRaw === "number" &&
      typeof minimumValidRt === "number" &&
      rtRaw < minimumValidRt
    ) {
      this.recordInvalid("below_minimum_rt", timestamp, event, details);
      this.data.rt_raw = null;
      this.data.rt = null;
      this.data.rt_corrected = null;
      this.finishIfNeeded(true);
      return false;
    }

    const calibration = this.resolveCalibration(details.device);
    const rtCorrected =
      calibration.matchStatus === "matched" &&
      typeof calibration.biasMs === "number" &&
      typeof rtRaw === "number"
        ? round3(rtRaw - calibration.biasMs)
        : null;

    this.data.rt = rtRaw;
    this.data.rt_raw = rtRaw;
    this.data.rt_corrected = rtCorrected;
    this.data.response_bias_correction_ms =
      calibration.matchStatus === "matched" ? calibration.biasMs : null;
    this.data.response_calibration_profile_id = calibration.profileId;
    this.data.response_calibration_match_status = calibration.matchStatus;
    this.data.response_valid = true;
    this.data.response_invalid_reason = "";
    this.data.response_error_ms =
      typeof rtRaw === "number" &&
      typeof this.data.response_expected_delay_ms === "number"
        ? round3(rtRaw - this.data.response_expected_delay_ms)
        : null;
    this.responseRecorded = true;
    this.updateResponseQuality();
    return true;
  }

  private resolveAnchor():
    | {
        ok: true;
        stimulusActualOnsetAbs: number;
        allowedFromAbs: number | null;
      }
    | { ok: false; reason: ResponseInvalidReason } {
    const componentId = this.data.response_anchor_component_id;
    const componentName = this.data.response_anchor_component;
    if (!componentId && !componentName) return { ok: false, reason: "missing_anchor" };

    const record =
      this.timing?.findStimulusRecord?.(componentId, componentName) ?? null;
    if (!record) return { ok: false, reason: "missing_anchor" };

    this.data.response_anchor_component_id =
      record.component_id ?? componentId ?? null;
    this.data.response_anchor_component = record.name ?? componentName ?? "";

    if (typeof record.actual_onset_abs !== "number") {
      return { ok: false, reason: "anchor_without_onset_commit" };
    }

    const allowedFromAbs = this.resolveAllowedFromAbs(record.actual_onset_abs);
    this.data.stimulus_actual_onset_abs = round3(record.actual_onset_abs);
    this.data.response_start_anchor = "stimulus_onset_commit";
    this.data.response_allowed_from_abs = round3(allowedFromAbs);

    return {
      ok: true,
      stimulusActualOnsetAbs: record.actual_onset_abs,
      allowedFromAbs,
    };
  }

  private resolveAllowedFromAbs(anchorAbs: number) {
    const allowed = this.responseAllowedFrom;
    const trialOnset = this.timing?.getOnsetTime?.() ?? null;

    if (allowed === "trial_onset") return trialOnset;
    if (allowed === "anchor_onset") return anchorAbs;
    if (allowed && typeof allowed === "object") {
      const atMs = Number(allowed.at_ms ?? 0);
      if (allowed.from === "trial_onset") {
        return typeof trialOnset === "number" ? trialOnset + atMs : null;
      }
      if (allowed.from === "anchor_onset") return anchorAbs + atMs;
    }
    return anchorAbs;
  }

  private recordBeforeAnchor(responseTime: number, detail?: ResponseInvalidReason) {
    this.data.response_before_anchor = true;
    this.data.response_before_anchor_time = round3(responseTime);
    if (detail && detail !== "before_anchor") {
      this.responseQualityReasonDetails.push(detail);
    }
    this.recordInvalid("before_anchor", null, null, null);
  }

  private recordInvalid(
    reason: ResponseInvalidReason,
    timestamp: TimestampInfo | null,
    event: Event | null,
    details: any,
  ) {
    if (timestamp && event && details) {
      this.applyCommonEventData(timestamp, event, details);
    }
    this.data.rt = null;
    this.data.rt_raw = null;
    this.data.rt_corrected = null;
    this.data.response_valid = false;
    this.data.response_invalid_reason = reason;
    this.responseRecorded = true;
    this.updateResponseQuality();
  }

  private applyCommonEventData(
    timestamp: TimestampInfo,
    event: Event,
    details: any,
  ) {
    this.data.response_time = round3(timestamp.response_time);
    this.data.response_now_at_handler = round3(timestamp.response_now_at_handler);
    this.data.response_timestamp_source = timestamp.response_timestamp_source;
    this.data.response_event_lag = round3(timestamp.response_event_lag);
    this.data.response_event_type = details.eventType;
    this.data.response_device = details.device;
    this.data.response_key = details.key ?? "";
    this.data.response_code = details.code ?? "";
    this.data.response_repeat = details.repeat === true;
    this.data.response_is_trusted = event.isTrusted === true;
    this.data.response_client_x =
      typeof details.clientX === "number" ? round3(details.clientX) : null;
    this.data.response_client_y =
      typeof details.clientY === "number" ? round3(details.clientY) : null;
    this.data.response_canvas_x =
      typeof details.canvasX === "number" ? round3(details.canvasX) : null;
    this.data.response_canvas_y =
      typeof details.canvasY === "number" ? round3(details.canvasY) : null;
    this.data.canvas_bounding_rect = details.canvasBoundingRect ?? "";
    this.data.response_target_component = details.targetComponent ?? "";
  }

  private getResponseTimestamp(event: Event): TimestampInfo {
    const now = performance.now();
    const raw = event.timeStamp;
    const useEventTimestamp =
      typeof raw === "number" &&
      Number.isFinite(raw) &&
      raw > 0 &&
      Math.abs(raw - now) <= 60000;
    const responseTime = useEventTimestamp ? raw : now;
    return {
      response_time: responseTime,
      response_now_at_handler: now,
      response_timestamp_source: useEventTimestamp
        ? "event.timeStamp"
        : "performance.now_fallback",
      response_event_lag: now - responseTime,
    };
  }

  private findPointerTarget(
    clientX: number,
    clientY: number,
    canvasX: number | null,
    canvasY: number | null,
  ) {
    for (let index = this.pointerTargets.length - 1; index >= 0; index -= 1) {
      const target = this.pointerTargets[index];
      if (target.hitTest?.({ clientX, clientY, canvasX, canvasY })) {
        return target;
      }
      if (
        typeof canvasX === "number" &&
        typeof canvasY === "number" &&
        typeof target.canvasX === "number" &&
        typeof target.canvasY === "number" &&
        typeof target.width === "number" &&
        typeof target.height === "number" &&
        canvasX >= target.canvasX &&
        canvasX <= target.canvasX + target.width &&
        canvasY >= target.canvasY &&
        canvasY <= target.canvasY + target.height
      ) {
        return target;
      }
      if (target.element) {
        const rect = target.element.getBoundingClientRect();
        if (
          clientX >= rect.left &&
          clientX <= rect.right &&
          clientY >= rect.top &&
          clientY <= rect.bottom
        ) {
          return target;
        }
      }
    }
    return null;
  }

  private computePointerCoordinates(clientX: number, clientY: number) {
    const rect = this.container.getBoundingClientRect();
    const canvasX =
      rect.width > 0 ? ((clientX - rect.left) / rect.width) * this.canvasWidth : null;
    const canvasY =
      rect.height > 0 ? ((clientY - rect.top) / rect.height) * this.canvasHeight : null;
    return {
      canvasX,
      canvasY,
      canvasBoundingRect: JSON.stringify({
        left: round3(rect.left),
        top: round3(rect.top),
        width: round3(rect.width),
        height: round3(rect.height),
      }),
    };
  }

  private resolveCalibration(inputDevice: string) {
    const profile = resolveRawValue(this.trial.response_calibration_profile);
    if (!profile || typeof profile !== "object") {
      return {
        matchStatus: "none" as CalibrationMatchStatus,
        profileId: "",
        biasMs: null as number | null,
      };
    }

    const browser = parseBrowser(navigator.userAgent);
    const osFamily = parseOs(navigator.userAgent);
    const displayHz =
      1000 / (this.timing?.getFrameIntervalEstimate?.() || 1000 / 60);
    const mismatches: boolean[] = [];
    let comparableCount = 0;

    const browserFamily = profile.browser_family ?? profile.browser;
    if (browserFamily) {
      comparableCount += 1;
      mismatches.push(
        String(browserFamily).toLowerCase() !== browser.family.toLowerCase(),
      );
    }

    if (profile.browser_major !== undefined && profile.browser_major !== null) {
      comparableCount += 1;
      mismatches.push(Number(profile.browser_major) !== browser.major);
    }

    const profileOs = profile.os_family ?? profile.os;
    if (profileOs) {
      comparableCount += 1;
      mismatches.push(String(profileOs).toLowerCase() !== osFamily.toLowerCase());
    }

    if (profile.input_device) {
      comparableCount += 1;
      mismatches.push(
        String(profile.input_device).toLowerCase() !==
          String(inputDevice).toLowerCase(),
      );
    }

    if (profile.display_hz !== undefined && profile.display_hz !== null) {
      comparableCount += 1;
      mismatches.push(Math.abs(Number(profile.display_hz) - displayHz) > 1);
    }

    const matchStatus: CalibrationMatchStatus = mismatches.some(Boolean)
      ? "mismatch"
      : comparableCount >= 3
        ? "matched"
        : "partial";

    return {
      matchStatus,
      profileId: profile.id ? String(profile.id) : "",
      biasMs:
        matchStatus === "matched" && typeof profile.bias_ms === "number"
          ? profile.bias_ms
          : null,
    };
  }

  private getResponseQuality() {
    return this.data.response_timing_quality as TimingQuality;
  }

  private getResponseQualityReasons() {
    const reasons: string[] = [];
    const mode = this.data.response_timing_quality_mode as ResponseTimingMode;
    const warningLag = mode === "strict" ? 4 : 8;
    const badLag = mode === "strict" ? 8 : 16.7;
    const lag = this.data.response_event_lag;

    if (this.data.response_timestamp_source === "performance.now_fallback") {
      reasons.push("timestamp_fallback");
    }
    if (typeof lag === "number" && lag > warningLag) {
      reasons.push(`response_event_lag ${round3(lag)}ms`);
    }
    if (this.hiddenDuringTrial) reasons.push("document_hidden");
    if (this.blurDuringTrial) reasons.push("window_blur");
    if (this.data.response_calibration_match_status === "mismatch") {
      reasons.push("calibration_mismatch");
    }
    if (this.data.response_invalid_reason) {
      reasons.push(this.data.response_invalid_reason);
    }
    for (const detail of this.responseQualityReasonDetails) {
      if (detail && !reasons.includes(detail)) {
        reasons.push(detail);
      }
    }
    return reasons;
  }

  private updateResponseQuality() {
    const mode = this.data.response_timing_quality_mode as ResponseTimingMode;
    const badLag = mode === "strict" ? 8 : 16.7;
    const warningLag = mode === "strict" ? 4 : 8;
    const lag = this.data.response_event_lag;
    const invalidReason = this.data.response_invalid_reason;
    let quality: TimingQuality = "ok";

    if (
      invalidReason === "missing_anchor" ||
      invalidReason === "anchor_without_onset_commit" ||
      invalidReason === "before_anchor" ||
      invalidReason === "timeout" ||
      invalidReason === "document_hidden" ||
      invalidReason === "window_blur" ||
      invalidReason === "below_minimum_rt" ||
      this.hiddenDuringTrial ||
      this.blurDuringTrial ||
      (typeof lag === "number" && lag > badLag)
    ) {
      quality = "bad";
    } else if (
      this.data.response_timestamp_source === "performance.now_fallback" ||
      this.data.response_calibration_match_status === "mismatch" ||
      (typeof lag === "number" && lag > warningLag)
    ) {
      quality = "warning";
    }

    this.data.response_timing_quality = quality;
    this.data.response_timing_quality_reason =
      this.getResponseQualityReasons().join("; ");
  }

  private getMinimumValidRt(targetMinimum: number | null | undefined) {
    if (typeof targetMinimum === "number" && Number.isFinite(targetMinimum)) {
      return targetMinimum;
    }
    const raw = resolveRawValue(this.trial.minimum_valid_rt_ms);
    return raw === undefined || raw === null ? null : Number(raw);
  }

  private getPrematurePolicy() {
    const policy = normalizeString(
      this.trial.premature_response_policy,
      "end_invalid",
    );
    return policy === "ignore" ? "ignore" : "end_invalid";
  }

  private isResponseRequired() {
    return resolveRawValue(this.trial.response_required) === true;
  }

  private finishIfNeeded(force = false) {
    if (force || this.trial.response_ends_trial !== false) {
      const finished = this.onFinish?.(this.data.response_time, { force });
      if (finished === false) {
        this.clearRecordedResponse();
        return;
      }
      this.detach();
    }
  }

  private clearRecordedResponse() {
    this.responseRecorded = false;
    this.responseQualityReasonDetails = [];
    this.data = {
      ...this.data,
      rt: null,
      rt_raw: null,
      rt_corrected: null,
      response_before_anchor: false,
      response_before_anchor_time: null,
      response_time: null,
      response_now_at_handler: null,
      response_timestamp_source: "",
      response_event_lag: null,
      response_bias_correction_ms: null,
      response_calibration_profile_id: "",
      response_calibration_match_status: "none",
      response_event_type: "",
      response_device: "",
      response_key: "",
      response_code: "",
      response_repeat: false,
      response_is_trusted: null,
      response_valid: null,
      response_invalid_reason: "",
      response_client_x: null,
      response_client_y: null,
      response_canvas_x: null,
      response_canvas_y: null,
      canvas_bounding_rect: "",
      response_target_component: "",
      response_error_ms: null,
    };
  }

  private createInitialData() {
    const allowedFrom = resolveRawValue(this.trial.response_allowed_from);
    const normalizedAllowedFrom: ResponseAllowedFrom =
      allowedFrom === "trial_onset" || allowedFrom === "anchor_onset"
        ? allowedFrom
        : allowedFrom && typeof allowedFrom === "object"
          ? allowedFrom
          : "anchor_onset";
    this.responseAllowedFrom = normalizedAllowedFrom;
    const qualityMode =
      normalizeString(this.trial.response_timing_quality_mode, "normal") ===
      "strict"
        ? "strict"
        : "normal";

    return {
      rt: null,
      rt_raw: null,
      rt_corrected: null,
      response_timing_enabled: this.enabled,
      response_required: this.isResponseRequired(),
      response_anchor_component_id:
        normalizeString(this.trial.response_anchor_component_id, "") || null,
      response_anchor_component:
        normalizeString(this.trial.response_anchor_component, "") || null,
      response_start_anchor: "",
      stimulus_actual_onset_abs: null,
      response_allowed_from:
        typeof normalizedAllowedFrom === "object"
          ? JSON.stringify(normalizedAllowedFrom)
          : normalizedAllowedFrom,
      response_allowed_from_abs: null,
      premature_response_policy: this.getPrematurePolicy(),
      response_timing_quality_mode: qualityMode,
      minimum_valid_rt_ms:
        resolveRawValue(this.trial.minimum_valid_rt_ms) ?? null,
      response_before_anchor: false,
      response_before_anchor_time: null,
      response_timeout: false,
      response_timeout_ms: null,
      response_time: null,
      response_now_at_handler: null,
      response_timestamp_source: "",
      response_event_lag: null,
      response_bias_correction_ms: null,
      response_calibration_profile_id: "",
      response_calibration_match_status: "none",
      response_event_type: "",
      response_device: "",
      response_key: "",
      response_code: "",
      response_repeat: false,
      response_is_trusted: null,
      response_valid: null,
      response_invalid_reason: "",
      response_client_x: null,
      response_client_y: null,
      response_canvas_x: null,
      response_canvas_y: null,
      device_pixel_ratio: window.devicePixelRatio || 1,
      canvas_bounding_rect: "",
      response_target_component: "",
      response_timing_quality: "ok",
      response_timing_quality_reason: "",
      document_hidden_during_trial: false,
      window_blur_during_trial: false,
      response_expected_delay_ms:
        resolveRawValue(this.trial.response_expected_delay_ms) ?? null,
      external_reference_id:
        normalizeString(this.trial.external_reference_id, "") || "",
      response_error_ms: null,
      response_listener_attached: false,
      response_listener_removed: false,
    };
  }
}

export default ResponseTimingManager;
