import { readEventTimestamp } from "./EventTiming";
import { preloadAudioBuffer } from "./AudioTiming";

export type TrialTimeOriginSource =
  | "fresh_raf"
  | "visual_handoff"
  | "host_coordinator"
  | "frame_engine_raf"
  | "frame_engine_transition";

export type DeadlinePolicy = "nearest" | "not_before";
export type VisualBoundaryPolicy =
  | "strict_not_before_ms"
  | "frame_tolerant_not_before"
  | "frame_locked"
  | "frame_count";

export interface HostTrialTimingContext {
  readonly id: string;
  setTrialIndex(index: number): void;
  getOriginTime(): number | null;
  getScheduledOriginTime(): number | null;
  getLatestFrameTime(): number | null;
  getLatestCommittedFrameTime(): number | null;
  getFrameIntervalEstimate(): number;
  getFrameIndex(): number | null;
  markReady(readyAt?: number, diagnostics?: Record<string, unknown>): void;
  markNotReady?(reason: string, diagnostics?: Record<string, unknown>): void;
  getReadinessDiagnostics?(): Record<string, unknown>;
  setPresentationLifecycle(lifecycle: {
    arm?(info: any): void;
    activate?(info: any): void;
    deactivate?(info: any): void;
  }): void;
  start(): void;
  stop(): void;
  onStart(callback: (timestamp: number, info: any) => void): () => void;
  onFrame(callback: (timestamp: number, info: any) => void): () => void;
  onFrameCommit(callback: (timestamp: number, info: any) => void): () => void;
  onPostCommit(callback: (timestamp: number, info: any) => void): () => void;
  scheduleAt(
    delayMs: number,
    callback: (timestamp: number, elapsed: number) => void,
    options?: { policy?: DeadlinePolicy },
  ): () => void;
  requestBoundary(options: {
    targetTime?: number;
    targetTimeMs?: number;
    targetFrameIndex?: number | null;
    frameCount?: number | null;
    boundaryPolicy?: VisualBoundaryPolicy;
    reason?: string;
    requestedAt?: number;
    allowTerminal?: boolean;
    onCommit?: (info: any) => void;
  }): boolean;
  queuePostCritical(
    task: (budgetMs?: number) => void | boolean,
    options?: {
      label?: string;
      estimatedCostMs?: number;
      responseSafe?: boolean;
      minimumBudgetMs?: number;
    },
  ): { cancel(): void };
  setResponseSensitive?(active: boolean): void;
  setNextAudioDeadline?(timestamp: number | null): void;
  recordStimulusCommit(anchor: {
    componentId: string | null;
    name: string;
    scheduledTime: number | null;
    commitTime: number;
  }): void;
  getTransitionTelemetry(): readonly any[];
}

type FrameTimingOptions = {
  recordFrameTiming?: boolean;
  longFrameThreshold?: number;
  expectedFrameMs?: number;
  trialContext?: HostTrialTimingContext | null;
};

type ScheduledFrameEvent = {
  at: number;
  policy: DeadlinePolicy;
  callback: (timestamp: number, elapsed: number) => void;
  cancelled: boolean;
};

type FrameInterval = {
  t: number;
  duration: number;
};

export type StimulusTimingRecord = {
  component_id: string | null;
  name: string;
  desired_onset: number;
  desired_duration: number | null;
  desired_offset: number | null;
  scheduled_onset_abs: number | null;
  scheduled_offset_abs: number | null;

  // Canonical V2 frame-domain fields. frame_* values are rAF/commit frame
  // timestamps; they are NOT physical photon-onset measurements.
  frame_onset: number | null;
  frame_onset_abs: number | null;
  frame_offset: number | null;
  frame_offset_abs: number | null;
  frame_duration: number | null;

  // Deprecated V1 aliases of the frame_* fields.
  actual_onset: number | null;
  actual_onset_abs: number | null;
  actual_offset: number | null;
  actual_offset_abs: number | null;
  actual_duration: number | null;

  onset_error: number | null;
  offset_error: number | null;
  duration_error: number | null;
  onset_commit_index: number | null;
  offset_commit_index: number | null;
  onset_commit_duration: number | null;
  offset_commit_duration: number | null;
  onset_cpu_commit_start_abs: number | null;
  onset_cpu_commit_end_abs: number | null;
  offset_cpu_commit_start_abs: number | null;
  offset_cpu_commit_end_abs: number | null;
  render_backend: string | null;
  timestamp_semantics: string;
  timing_degraded: boolean;
  timing_degraded_reason: string;

  /** Unavailable in a browser-only record; may be filled by an external
   * measurement system in the future. */
  physical_onset_abs: null;
  physical_offset_abs: null;
};

export type AssetPreloadList = {
  images: string[];
  audio: string[];
  video: string[];
};

export type CanvasBitmapSource = ImageBitmap | HTMLImageElement;

const DEFAULT_FRAME_MS = 1000 / 60;
const MIN_FRAME_INTERVAL_MS = 0.25;
export type StimulusRegistrationMetadata = {
  renderBackend?: string;
  timestampSemantics?: string;
  timingDegraded?: boolean;
  timingDegradedReason?: string;
};

const round3 = (value: number): number => Math.round(value * 1000) / 1000;
const imagePreloadCache = new Map<string, Promise<void>>();
const bitmapPreloadCache = new Map<string, Promise<CanvasBitmapSource>>();
const bitmapSourceCache = new Map<string, CanvasBitmapSource>();
const audioPreloadCache = new Map<string, Promise<void>>();
const videoPreloadCache = new Map<string, Promise<void>>();

export function resolveTimingMs(
  raw: any,
  fallback: number | null = null,
): number | null {
  if (raw === null || raw === undefined) return fallback;
  if (typeof raw === "object" && "value" in raw) {
    return raw.value === null || raw.value === undefined
      ? fallback
      : Number(raw.value);
  }
  return Number(raw);
}

export function createPrecisionTiming(options: FrameTimingOptions = {}) {
  const recordFrameTiming = options.recordFrameTiming !== false;
  const longFrameThreshold = options.longFrameThreshold ?? 34;
  const fallbackFrameMs = options.expectedFrameMs ?? DEFAULT_FRAME_MS;
  const scheduledEvents: ScheduledFrameEvent[] = [];
  const startCallbacks: Array<(timestamp: number) => void> = [];
  const frameCommitCallbacks: Array<(timestamp: number) => void> = [];
  const frameIntervals: FrameInterval[] = [];
  const stimulusRecords: StimulusTimingRecord[] = [];
  const stimulusControllers: Array<{
    markOffset(timestamp: number, commitInfo?: any): void;
    record: StimulusTimingRecord;
  }> = [];
  const trialContext = options.trialContext ?? null;
  const contextUnsubscribers: Array<() => void> = [];

  let trialTimeOrigin: number | null = null;
  let scheduledTrialTimeOrigin: number | null = null;
  let trialTimeOriginSource: TrialTimeOriginSource | null = null;
  let lastFrameTime: number | null = null;
  let latestFrameTime: number | null = null;
  let latestCommittedFrameTime: number | null = null;
  let frameIntervalEstimate = fallbackFrameMs;
  let rafHandle: number | null = null;
  let running = false;

  const getTrialTimeOrigin = () => trialTimeOrigin;
  const getScheduledTrialTimeOrigin = () => scheduledTrialTimeOrigin;
  const getTrialTimeOriginSource = () => trialTimeOriginSource;

  /** Deprecated V1 compatibility alias of getTrialTimeOrigin(). */
  const getOnsetTime = () => trialTimeOrigin;

  const getElapsed = (timestamp = performance.now()): number | null => {
    if (trialTimeOrigin === null) return null;
    return timestamp - trialTimeOrigin;
  };

  const getFrameIntervalEstimate = () => {
    const estimate =
      trialContext?.getFrameIntervalEstimate() ?? frameIntervalEstimate;
    return Math.max(1, estimate || fallbackFrameMs);
  };

  const estimateBaselineFrameMs = (intervals: number[]) => {
    const usable = intervals.filter(
      (duration) =>
        Number.isFinite(duration) && duration > MIN_FRAME_INTERVAL_MS,
    );
    if (usable.length === 0) return getFrameIntervalEstimate();

    const sorted = [...usable].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    if (sorted.length % 2 === 1) return sorted[middle];
    return (sorted[middle - 1] + sorted[middle]) / 2;
  };

  const shouldRunEventOnFrame = (
    event: ScheduledFrameEvent,
    timestamp: number,
  ) => {
    if (trialTimeOrigin === null) return false;
    const targetTime = trialTimeOrigin + event.at;
    if (event.policy === "not_before") {
      return timestamp >= targetTime;
    }

    // nearest (P5): the OBSERVED frame's error vs the ONE-STEP-AHEAD
    // prediction (observed timestamp + robust nominal period). Ties fire on
    // the earlier (current) frame — documented policy. The event still only
    // runs on a REAL observed rAF; prediction decides WHICH frame, the rAF
    // decides WHEN.
    const frameMs = getFrameIntervalEstimate();
    const errorNow = Math.abs(timestamp - targetTime);
    const errorNext = Math.abs(timestamp + frameMs - targetTime);
    return errorNow <= errorNext;
  };

  const runDueEvents = (timestamp: number) => {
    if (trialTimeOrigin === null) return;
    const elapsed = timestamp - trialTimeOrigin;
    for (const event of scheduledEvents) {
      if (!event.cancelled && shouldRunEventOnFrame(event, timestamp)) {
        event.cancelled = true;
        event.callback(timestamp, elapsed);
      }
    }
  };

  // -------------------------------------------------------------------------
  // P5 frame-phase predictor (FrameClock). The OBSERVED rAF timestamp remains
  // the only scheduling authority; the clock only maintains a robust nominal
  // period and a phase anchor so that frame SELECTION (nearest/not_before) is
  // stable under jitter, dropped frames and refresh-rate transitions.
  // Predicted frame times are PREDICTIVE diagnostics — never physical
  // presentation times.
  // -------------------------------------------------------------------------
  const FRAME_CLOCK_MAX_SAMPLES = 8;

  const frameClock = {
    periodMs: fallbackFrameMs,
    anchorTimestamp: null as number | null,
    anchorOrdinal: 0,
    nextOrdinal: 0,
    acceptedSamples: 0,
    samples: [] as number[],
    fastStreak: 0,
    fastDeltas: [] as number[],
    slowStreak: 0,
    slowDeltas: [] as number[],
    gapStreak: 0,
    gapFrames: 0,
    gapDeltas: [] as number[],
    lastPredictionError: null as number | null,
    lastObservedTimestamp: null as number | null,
  };

  const frameClockMedian = (samples: number[]) => {
    const sorted = [...samples].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 1
      ? sorted[middle]
      : (sorted[middle - 1] + sorted[middle]) / 2;
  };

  const observeFrame = (timestamp: number) => {
    const clock = frameClock;
    const previous = clock.lastObservedTimestamp;
    clock.lastObservedTimestamp = timestamp;

    if (clock.anchorTimestamp === null) {
      clock.anchorTimestamp = timestamp;
      clock.anchorOrdinal = 0;
      clock.nextOrdinal = 1;
      return;
    }

    const delta = timestamp - previous!;
    if (!Number.isFinite(delta) || delta <= MIN_FRAME_INTERVAL_MS) {
      return;
    }

    // Nominal-period gating: interpret the delta as `expectedFrames` nominal
    // intervals. An isolated multi-frame gap (e.g. 50 ms at 60 Hz ≈ 3 frames)
    // updates the PHASE but never pollutes the period samples.
    const expectedFrames = Math.max(1, Math.round(delta / clock.periodMs));
    const tolerance = Math.max(0.25 * clock.periodMs, 2);

    const adoptNewPeriod = (newPeriod: number) => {
      // The samples window describes the CURRENT regime only: a regime
      // adoption resets the predictor diagnostics to the new cadence.
      clock.samples = [newPeriod];
      clock.acceptedSamples = 1;
      clock.periodMs = newPeriod;
      frameIntervalEstimate = newPeriod;
      clock.fastStreak = 0;
      clock.fastDeltas = [];
      clock.slowStreak = 0;
      clock.slowDeltas = [];
      clock.gapStreak = 0;
      clock.gapFrames = 0;
      clock.gapDeltas = [];
      clock.anchorTimestamp = timestamp;
      clock.anchorOrdinal = clock.nextOrdinal;
    };

    const clearRegimeCandidates = () => {
      clock.fastStreak = 0;
      clock.fastDeltas = [];
      clock.slowStreak = 0;
      clock.slowDeltas = [];
      clock.gapStreak = 0;
      clock.gapFrames = 0;
      clock.gapDeltas = [];
    };

    if (expectedFrames === 1) {
      if (Math.abs(delta - clock.periodMs) <= tolerance) {
        // NOMINAL: resets every regime candidate.
        clock.samples.push(delta);
        if (clock.samples.length > FRAME_CLOCK_MAX_SAMPLES) {
          clock.samples.shift();
        }
        clock.acceptedSamples += 1;
        clock.periodMs = frameClockMedian(clock.samples);
        frameIntervalEstimate = clock.periodMs;
        clearRegimeCandidates();
      } else if (delta < clock.periodMs * 0.75) {
        // FAST regime candidate: stable consecutive fast deltas only
        // (unstable candidates restart the streak). Resets slow/gap.
        clock.slowStreak = 0;
        clock.slowDeltas = [];
        clock.gapStreak = 0;
        clock.gapDeltas = [];
        if (clock.fastDeltas.length > 0) {
          const lastFast = clock.fastDeltas[clock.fastDeltas.length - 1];
          clock.fastStreak =
            Math.abs(delta - lastFast) <= Math.max(0.25 * lastFast, 2)
              ? clock.fastStreak + 1
              : 1;
        } else {
          clock.fastStreak = 1;
        }
        clock.fastDeltas.push(delta);
        if (clock.fastDeltas.length > 3) clock.fastDeltas.shift();
        if (clock.fastStreak >= 3) {
          adoptNewPeriod(frameClockMedian(clock.fastDeltas));
        }
      } else {
        // MODERATE SLOW regime candidate: stable consecutive slow deltas.
        // Resets fast/gap.
        clock.fastStreak = 0;
        clock.fastDeltas = [];
        clock.gapStreak = 0;
        clock.gapDeltas = [];
        if (clock.slowDeltas.length > 0) {
          const lastSlow = clock.slowDeltas[clock.slowDeltas.length - 1];
          clock.slowStreak =
            Math.abs(delta - lastSlow) <= Math.max(0.25 * lastSlow, 2)
              ? clock.slowStreak + 1
              : 1;
        } else {
          clock.slowStreak = 1;
        }
        clock.slowDeltas.push(delta);
        if (clock.slowDeltas.length > 3) clock.slowDeltas.shift();
        if (clock.slowStreak >= 3) {
          adoptNewPeriod(frameClockMedian(clock.slowDeltas));
        }
      }
    } else {
      // Multi-interval delta: advance PHASE only. A multi-frame gap
      // INTERRUPTS fast and moderate-slow candidates (mutual exclusivity).
      clock.fastStreak = 0;
      clock.fastDeltas = [];
      clock.slowStreak = 0;
      clock.slowDeltas = [];
      if (expectedFrames === clock.gapFrames && clock.gapDeltas.length > 0) {
        const lastGap = clock.gapDeltas[clock.gapDeltas.length - 1];
        clock.gapStreak =
          Math.abs(delta - lastGap) <= Math.max(0.25 * lastGap, 2)
            ? clock.gapStreak + 1
            : 1;
      } else {
        clock.gapStreak = 1;
        clock.gapFrames = expectedFrames;
      }
      clock.gapDeltas.push(delta);
      if (clock.gapDeltas.length > 3) clock.gapDeltas.shift();
      if (clock.gapStreak >= 3) {
        adoptNewPeriod(frameClockMedian(clock.gapDeltas));
      }
    }

    const observedOrdinal = clock.nextOrdinal + expectedFrames - 1;
    clock.nextOrdinal = observedOrdinal + 1;

    // Phase correction against the anchored prediction for this ordinal.
    const predicted =
      clock.anchorTimestamp +
      (observedOrdinal - clock.anchorOrdinal) * clock.periodMs;
    const error = timestamp - predicted;
    clock.lastPredictionError = error;
    if (Math.abs(error) > 0.5 * clock.periodMs) {
      // Major divergence (missed frames / big jitter): safe re-anchor.
      clock.anchorTimestamp = timestamp;
      clock.anchorOrdinal = observedOrdinal;
      clock.lastPredictionError = 0;
    } else if (Math.abs(error) > 0.25) {
      // Gradual drift correction.
      clock.anchorTimestamp += error * 0.25;
    }
  };

  const runFrameCommitCallbacks = (timestamp: number) => {
    for (const callback of [...frameCommitCallbacks]) {
      callback(timestamp);
    }
    // Authority of the last frame whose commit phase ACTUALLY ran. If a
    // scheduled event ends/stops the trial during `runDueEvents`, the current
    // frame never reaches this point and must not be marked as committed.
    latestCommittedFrameTime = timestamp;
  };

  const postCommitCallbacks: Array<(timestamp: number) => void> = [];

  const runPostCommitCallbacks = (timestamp: number) => {
    // Snapshot semantics: callbacks queued DURING this phase run on the next
    // committed frame, never on the current one. One-shot: the queue is
    // cleared before invocation, so a throwing callback cannot re-run later.
    // Explicit stop policy: if a callback stops the scheduler, the remaining
    // callbacks of this frame's snapshot do NOT run, and the queue is cleared
    // again so that no callback — including ones queued during this phase —
    // survives a stop.
    const callbacks = [...postCommitCallbacks];
    postCommitCallbacks.length = 0;
    for (const callback of callbacks) {
      callback(timestamp);
      if (!running) {
        postCommitCallbacks.length = 0;
        break;
      }
    }
  };

  /**
   * Queues a one-shot callback to run AFTER the next frame's commit phase
   * (`runFrameCommitCallbacks`), receiving exactly that commit timestamp. The
   * callback observes `latestCommittedFrameTime === timestamp`. `stop()` clears
   * pending callbacks. No extra rAF/setTimeout is created.
   */
  const queuePostCommit = (callback: (timestamp: number) => void) => {
    if (trialContext) {
      let unsubscribe = () => {};
      unsubscribe = trialContext.onPostCommit((timestamp) => {
        unsubscribe();
        callback(timestamp);
      });
      return unsubscribe;
    }
    postCommitCallbacks.push(callback);
    return () => {
      const index = postCommitCallbacks.indexOf(callback);
      if (index >= 0) {
        postCommitCallbacks.splice(index, 1);
      }
    };
  };

  /**
   * Single observable frame phase sequence shared by `tick()` and `startAt()`:
   *   1. latestFrameTime = timestamp
   *   2. frame-interval estimator update
   *   3. runDueEvents
   *   4. if !running → return            (hard stop before commit: no commit)
   *   5. runFrameCommitCallbacks         (sets latestCommittedFrameTime)
   *   6. if !running → return
   *   7. runPostCommitCallbacks
   *   8. if !running → return            (post-commit finalize must not
   *                                      schedule another rAF)
   *   9. schedule next rAF
   */
  const runFramePhases = (timestamp: number) => {
    latestFrameTime = timestamp;
    if (lastFrameTime !== null) {
      const duration = timestamp - lastFrameTime;
      observeFrame(timestamp);
      if (recordFrameTiming && duration > MIN_FRAME_INTERVAL_MS) {
        frameIntervals.push({
          t: round3(timestamp - trialTimeOrigin),
          duration: round3(duration),
        });
      }
    }
    lastFrameTime = timestamp;
    runDueEvents(timestamp);
    if (!running) return;
    runFrameCommitCallbacks(timestamp);
    if (!running) return;
    runPostCommitCallbacks(timestamp);
    if (!running) return;
    rafHandle = requestAnimationFrame(tick);
  };

  const tick = (timestamp: number) => {
    if (!running || trialTimeOrigin === null) return;
    runFramePhases(timestamp);
  };

  if (trialContext) {
    contextUnsubscribers.push(
      trialContext.onStart((timestamp, info) => {
        if (trialTimeOrigin !== null) return;
        trialTimeOrigin = timestamp;
        scheduledTrialTimeOrigin =
          typeof info?.scheduledTimestamp === "number"
            ? info.scheduledTimestamp
            : timestamp;
        trialTimeOriginSource =
          info?.source === "frame_engine_transition"
            ? "frame_engine_transition"
            : "frame_engine_raf";
        lastFrameTime = null;
        latestFrameTime = timestamp;
        running = true;
        for (const callback of [...startCallbacks]) callback(timestamp);
      }),
      trialContext.onFrame((timestamp) => {
        latestFrameTime = timestamp;
        observeFrame(timestamp);
        if (lastFrameTime !== null) {
          const duration = timestamp - lastFrameTime;
          if (recordFrameTiming && duration > MIN_FRAME_INTERVAL_MS) {
            frameIntervals.push({
              t: round3(timestamp - (trialTimeOrigin ?? timestamp)),
              duration: round3(duration),
            });
          }
        }
        lastFrameTime = timestamp;
      }),
      trialContext.onPostCommit((timestamp) => {
        latestCommittedFrameTime = timestamp;
      }),
    );
  }

  const startAt = (timestamp: number, source: TrialTimeOriginSource) => {
    if (trialContext) {
      trialContext.start();
      return;
    }
    if (trialTimeOrigin !== null || rafHandle !== null) return;
    trialTimeOrigin = timestamp;
    scheduledTrialTimeOrigin = timestamp;
    trialTimeOriginSource = source;
    lastFrameTime = timestamp;
    latestFrameTime = timestamp;
    running = true;
    for (const callback of [...startCallbacks]) {
      callback(timestamp);
    }
    runFramePhases(timestamp);
  };

  const start = () => {
    if (trialContext) {
      trialContext.start();
      return;
    }
    if (trialTimeOrigin !== null || rafHandle !== null) return;
    rafHandle = requestAnimationFrame((timestamp) => {
      rafHandle = null;
      startAt(timestamp, "fresh_raf");
    });
  };

  const stop = () => {
    running = false;
    if (trialContext) {
      trialContext.stop();
      while (contextUnsubscribers.length > 0) contextUnsubscribers.pop()!();
      postCommitCallbacks.length = 0;
      return;
    }
    if (rafHandle !== null) {
      cancelAnimationFrame(rafHandle);
      rafHandle = null;
    }
    // A stopped scheduler must never run pending post-commit callbacks.
    postCommitCallbacks.length = 0;
  };

  const onStart = (callback: (timestamp: number) => void) => {
    if (trialTimeOrigin !== null) {
      callback(trialTimeOrigin);
    } else {
      startCallbacks.push(callback);
    }
  };

  const onFrameCommit = (callback: (timestamp: number) => void) => {
    if (trialContext) {
      return trialContext.onFrameCommit((timestamp) => callback(timestamp));
    }
    frameCommitCallbacks.push(callback);
    return () => {
      const index = frameCommitCallbacks.indexOf(callback);
      if (index >= 0) {
        frameCommitCallbacks.splice(index, 1);
      }
    };
  };

  const scheduleAt = (
    delayMs: number | null | undefined,
    callback: (timestamp: number, elapsed: number) => void,
    options: { policy?: DeadlinePolicy } = {},
  ) => {
    if (trialContext) {
      return trialContext.scheduleAt(
        Math.max(0, Number(delayMs ?? 0)),
        callback,
        options,
      );
    }
    const at = Math.max(0, Number(delayMs ?? 0));
    const event: ScheduledFrameEvent = {
      at,
      policy: options.policy ?? "nearest",
      callback,
      cancelled: false,
    };
    scheduledEvents.push(event);
    scheduledEvents.sort((a, b) => a.at - b.at);
    return () => {
      event.cancelled = true;
    };
  };

  const requestBoundary = (boundaryOptions: {
    targetTime?: number;
    targetTimeMs?: number;
    targetFrameIndex?: number | null;
    frameCount?: number | null;
    boundaryPolicy?: VisualBoundaryPolicy;
    reason?: string;
    requestedAt?: number;
    allowTerminal?: boolean;
    onCommit?: (info: any) => void;
  }) => trialContext?.requestBoundary(boundaryOptions) ?? false;

  const queuePostCritical = (
    task: (budgetMs?: number) => void | boolean,
    taskOptions?: {
      label?: string;
      estimatedCostMs?: number;
      responseSafe?: boolean;
      minimumBudgetMs?: number;
    },
  ) => {
    if (trialContext) {
      return trialContext.queuePostCritical(task, taskOptions);
    } else {
      const handle = setTimeout(task, 0);
      return { cancel: () => clearTimeout(handle) };
    }
  };

  const setNextAudioDeadline = (timestamp: number | null) => {
    trialContext?.setNextAudioDeadline?.(timestamp);
  };

  const registerStimulus = (
    name: string,
    desiredOnset: number | null,
    desiredDuration: number | null,
    componentId: string | null = null,
    metadata: StimulusRegistrationMetadata = {},
  ) => {
    const desired_onset = desiredOnset ?? 0;
    const record: StimulusTimingRecord = {
      component_id: componentId,
      name,
      desired_onset,
      desired_duration: desiredDuration,
      desired_offset:
        desiredDuration === null ? null : desired_onset + desiredDuration,
      scheduled_onset_abs: null,
      scheduled_offset_abs: null,
      frame_onset: null,
      frame_onset_abs: null,
      frame_offset: null,
      frame_offset_abs: null,
      frame_duration: null,
      actual_onset: null,
      actual_onset_abs: null,
      actual_offset: null,
      actual_offset_abs: null,
      actual_duration: null,
      onset_error: null,
      offset_error: null,
      duration_error: null,
      onset_commit_index: null,
      offset_commit_index: null,
      onset_commit_duration: null,
      offset_commit_duration: null,
      onset_cpu_commit_start_abs: null,
      onset_cpu_commit_end_abs: null,
      offset_cpu_commit_start_abs: null,
      offset_cpu_commit_end_abs: null,
      render_backend: metadata.renderBackend ?? null,
      timestamp_semantics: metadata.timestampSemantics ?? "",
      timing_degraded: metadata.timingDegraded ?? false,
      timing_degraded_reason: metadata.timingDegradedReason ?? "",
      physical_onset_abs: null,
      physical_offset_abs: null,
    };
    stimulusRecords.push(record);

    const applyCommitInfo = (phase: "onset" | "offset", commitInfo: any) => {
      if (!commitInfo) return;
      const frameTimestamp =
        typeof commitInfo.frameTimestamp === "number"
          ? commitInfo.frameTimestamp
          : typeof commitInfo.timestamp === "number"
            ? commitInfo.timestamp
            : null;
      if (phase === "onset") {
        record.onset_commit_index = commitInfo.commitIndex ?? null;
        record.onset_commit_duration =
          typeof commitInfo.commitDuration === "number"
            ? round3(commitInfo.commitDuration)
            : null;
        record.onset_cpu_commit_start_abs =
          typeof commitInfo.cpuCommitStartedAt === "number"
            ? round3(commitInfo.cpuCommitStartedAt)
            : null;
        record.onset_cpu_commit_end_abs =
          typeof commitInfo.cpuCommitEndedAt === "number"
            ? round3(commitInfo.cpuCommitEndedAt)
            : null;
        record.render_backend =
          commitInfo.renderBackend ?? record.render_backend;
        if (record.timestamp_semantics === "") {
          record.timestamp_semantics =
            record.render_backend === "dom"
              ? "dom_mutation_frame"
              : record.render_backend === "html_media"
                ? "html_media_play_request"
                : "webgl_commit_frame";
        }
      } else {
        record.offset_commit_index = commitInfo.commitIndex ?? null;
        record.offset_commit_duration =
          typeof commitInfo.commitDuration === "number"
            ? round3(commitInfo.commitDuration)
            : null;
        record.offset_cpu_commit_start_abs =
          typeof commitInfo.cpuCommitStartedAt === "number"
            ? round3(commitInfo.cpuCommitStartedAt)
            : null;
        record.offset_cpu_commit_end_abs =
          typeof commitInfo.cpuCommitEndedAt === "number"
            ? round3(commitInfo.cpuCommitEndedAt)
            : null;
        record.render_backend =
          commitInfo.renderBackend ?? record.render_backend;
      }
      return frameTimestamp;
    };

    const controller = {
      markOnset(timestamp: number, commitInfo?: any) {
        if (trialTimeOrigin === null || record.frame_onset !== null) return;
        const frameTimestamp = applyCommitInfo("onset", commitInfo);
        const onsetTimestamp =
          typeof frameTimestamp === "number" ? frameTimestamp : timestamp;
        record.frame_onset_abs = round3(onsetTimestamp);
        record.frame_onset = round3(onsetTimestamp - trialTimeOrigin);
        const scheduleOrigin = scheduledTrialTimeOrigin ?? trialTimeOrigin;
        record.scheduled_onset_abs = round3(
          scheduleOrigin + record.desired_onset,
        );
        record.onset_error = round3(
          onsetTimestamp - record.scheduled_onset_abs,
        );
        trialContext?.recordStimulusCommit({
          componentId: record.component_id,
          name: record.name,
          scheduledTime: record.scheduled_onset_abs,
          commitTime: onsetTimestamp,
        });
        // V1 compatibility aliases
        record.actual_onset_abs = record.frame_onset_abs;
        record.actual_onset = record.frame_onset;
      },
      markOffset(timestamp: number, commitInfo?: any) {
        if (
          trialTimeOrigin === null ||
          record.frame_onset === null ||
          record.frame_offset !== null
        ) {
          return;
        }
        const frameTimestamp = applyCommitInfo("offset", commitInfo);
        const offsetTimestamp =
          typeof frameTimestamp === "number" ? frameTimestamp : timestamp;
        record.frame_offset_abs = round3(offsetTimestamp);
        record.frame_offset = round3(offsetTimestamp - trialTimeOrigin);
        record.frame_duration = round3(
          record.frame_offset - record.frame_onset,
        );
        const scheduleOrigin = scheduledTrialTimeOrigin ?? trialTimeOrigin;
        record.scheduled_offset_abs =
          record.desired_offset === null
            ? null
            : round3(scheduleOrigin + record.desired_offset);
        record.offset_error =
          record.scheduled_offset_abs === null
            ? null
            : round3(offsetTimestamp - record.scheduled_offset_abs);
        record.duration_error =
          record.desired_duration === null
            ? null
            : round3(record.frame_duration - record.desired_duration);
        // V1 compatibility aliases
        record.actual_offset_abs = record.frame_offset_abs;
        record.actual_offset = record.frame_offset;
        record.actual_duration = record.frame_duration;
      },
      record,
    };
    stimulusControllers.push(controller);
    return controller;
  };

  const closeOpenStimuli = (timestamp: number, commitInfo?: any) => {
    for (const controller of stimulusControllers) {
      if (
        controller.record.frame_onset !== null &&
        controller.record.frame_offset === null
      ) {
        controller.markOffset(timestamp, commitInfo);
      }
    }
  };

  const getEventTime = (event: Event): number => {
    return readEventTimestamp(event).responseTime;
  };

  const getSummary = (offsetTime = performance.now()) => {
    const actualDuration =
      trialTimeOrigin === null ? null : offsetTime - trialTimeOrigin;
    const intervals = recordFrameTiming
      ? frameIntervals.map((frame) => frame.duration)
      : [];
    const longFrames = intervals.filter(
      (duration) => duration > longFrameThreshold,
    );
    const baselineFrameMs = estimateBaselineFrameMs(intervals);
    const droppedFrameCount = intervals.reduce((sum, duration) => {
      return sum + Math.max(0, Math.round(duration / baselineFrameMs) - 1);
    }, 0);
    const maxFrameInterval =
      intervals.length > 0 ? Math.max(...intervals) : null;
    const meanFrameInterval =
      intervals.length > 0
        ? intervals.reduce((sum, duration) => sum + duration, 0) /
          intervals.length
        : null;
    const finalizedStimulusRecords = stimulusRecords.map((record) => {
      const next = { ...record };
      if (
        trialTimeOrigin !== null &&
        next.frame_onset !== null &&
        next.frame_offset === null
      ) {
        next.frame_offset_abs = round3(offsetTime);
        next.frame_offset = round3(offsetTime - trialTimeOrigin);
        next.frame_duration = round3(next.frame_offset - next.frame_onset);
        next.offset_error =
          next.desired_offset === null
            ? null
            : round3(next.frame_offset - next.desired_offset);
        next.duration_error =
          next.desired_duration === null
            ? null
            : round3(next.frame_duration - next.desired_duration);
        // V1 compatibility aliases
        next.actual_offset_abs = next.frame_offset_abs;
        next.actual_offset = next.frame_offset;
        next.actual_duration = next.frame_duration;
      }
      return next;
    });

    const findStimulusRecord = (
      componentId?: string | null,
      name?: string | null,
    ) => {
      if (componentId) {
        const byId = finalizedStimulusRecords.find(
          (record) => record.component_id === componentId,
        );
        if (byId) return byId;
      }
      if (name) {
        return (
          finalizedStimulusRecords.find((record) => record.name === name) ??
          null
        );
      }
      return null;
    };

    return {
      trialTimeOrigin,
      scheduledTrialTimeOrigin,
      trialTimeOriginSource,
      onsetTime: trialTimeOrigin,
      offsetTime,
      actualDuration,
      latestFrameTime,
      latestCommittedFrameTime,
      framePeriodEstimateMs: round3(frameClock.periodMs),
      framePredictionErrorMs:
        frameClock.lastPredictionError === null
          ? null
          : round3(frameClock.lastPredictionError),
      framePredictorSamples: frameClock.acceptedSamples,
      frameCount: intervals.length,
      longFrameCount: longFrames.length,
      droppedFrameCount,
      maxFrameInterval,
      meanFrameInterval,
      frameIntervalEstimate: baselineFrameMs,
      longFrameThreshold,
      frameIntervals: intervals,
      frameLog: recordFrameTiming ? frameIntervals : [],
      transitionTelemetry: trialContext
        ? [...trialContext.getTransitionTelemetry()]
        : [],
      stimulusRecords: finalizedStimulusRecords,
      findStimulusRecord,
    };
  };

  const findStimulusRecord = (
    componentId?: string | null,
    name?: string | null,
  ) => {
    if (componentId) {
      const byId = stimulusRecords.find(
        (record) => record.component_id === componentId,
      );
      if (byId) return byId;
    }
    if (name) {
      return stimulusRecords.find((record) => record.name === name) ?? null;
    }
    return stimulusRecords[0] ?? null;
  };

  return {
    start,
    startAt,
    stop,
    onStart,
    onFrameCommit,
    queuePostCommit,
    requestBoundary,
    queuePostCritical,
    setNextAudioDeadline,
    scheduleAt,
    registerStimulus,
    closeOpenStimuli,
    getTrialTimeOrigin,
    getScheduledTrialTimeOrigin,
    getTrialTimeOriginSource,
    getOnsetTime,
    getElapsed,
    getFrameIntervalEstimate,
    getEventTime,
    findStimulusRecord,
    getSummary,
    isGlobalFrameEngine: () => trialContext !== null,
    getTrialContext: () => trialContext,
  };
}

export function scheduleStimulusVisibility(
  element: HTMLElement,
  config: any,
  timing?: ReturnType<typeof createPrecisionTiming>,
) {
  const stimulusOnset = resolveTimingMs(config.stimulus_onset, null);
  const stimulusDuration = resolveTimingMs(config.stimulus_duration, null);
  const cancellations: Array<() => void> = [];
  const stimulusTiming = timing?.registerStimulus?.(
    config.name || config.type || element.id || "stimulus",
    stimulusOnset,
    stimulusDuration,
    config.__componentId ?? config.builder_id ?? config.id ?? null,
    {
      renderBackend: "dom",
      timestampSemantics: "dom_mutation_frame",
      timingDegraded: true,
      timingDegradedReason: "browser_paint_unobservable",
    },
  );

  if (timing && stimulusOnset === null) {
    timing.onStart((timestamp) => {
      stimulusTiming?.markOnset(timestamp);
    });
  }

  if (stimulusOnset !== null) {
    element.style.visibility = "hidden";
    if (timing) {
      cancellations.push(
        timing.scheduleAt(
          stimulusOnset,
          (timestamp) => {
            element.style.visibility = "visible";
            stimulusTiming?.markOnset(timestamp);
          },
          { policy: "nearest" },
        ),
      );
    } else {
      cancellations.push(
        scheduleFrameEvent(stimulusOnset, () => {
          element.style.visibility = "visible";
        }),
      );
    }
  }

  if (stimulusDuration !== null) {
    const hideAt = (stimulusOnset ?? 0) + stimulusDuration;
    if (timing) {
      cancellations.push(
        timing.scheduleAt(
          hideAt,
          (timestamp) => {
            element.style.visibility = "hidden";
            stimulusTiming?.markOffset(timestamp);
          },
          { policy: "not_before" },
        ),
      );
    } else {
      cancellations.push(
        scheduleFrameEvent(
          hideAt,
          () => {
            element.style.visibility = "hidden";
          },
          { policy: "not_before" },
        ),
      );
    }
  }

  return () => {
    for (const cancel of cancellations) cancel();
  };
}

export function scheduleFrameEvent(
  delayMs: number | null | undefined,
  callback: (timestamp: number, elapsed: number) => void,
  { policy = "nearest" }: { policy?: DeadlinePolicy } = {},
) {
  const delay = Math.max(0, Number(delayMs ?? 0));
  let startTime: number | null = null;
  let lastFrameTime: number | null = null;
  let frameMs = DEFAULT_FRAME_MS;
  let rafHandle: number | null = null;
  let cancelled = false;

  const tick = (timestamp: number) => {
    if (cancelled) return;
    if (startTime === null) {
      startTime = timestamp;
    }

    if (lastFrameTime !== null) {
      const duration = timestamp - lastFrameTime;
      if (Number.isFinite(duration) && duration > MIN_FRAME_INTERVAL_MS) {
        frameMs = duration;
      }
    }
    lastFrameTime = timestamp;

    const targetTime = startTime + delay;
    const elapsed = timestamp - startTime;

    if (policy === "not_before") {
      if (timestamp >= targetTime) {
        callback(timestamp, elapsed);
        return;
      }
      rafHandle = requestAnimationFrame(tick);
      return;
    }

    const errorNow = Math.abs(timestamp - targetTime);
    const errorNext = Math.abs(timestamp + frameMs - targetTime);

    if (errorNow <= errorNext) {
      callback(timestamp, elapsed);
      return;
    }

    rafHandle = requestAnimationFrame(tick);
  };

  rafHandle = requestAnimationFrame(tick);

  return () => {
    cancelled = true;
    if (rafHandle !== null) {
      cancelAnimationFrame(rafHandle);
      rafHandle = null;
    }
  };
}

export function setResponseStartTime(
  target: any,
  timing?: ReturnType<typeof createPrecisionTiming>,
) {
  if (timing) {
    target.start_time = null;
    timing.onStart((timestamp) => {
      target.start_time = timestamp;
    });
  } else {
    target.start_time = performance.now();
  }
}

export function getResponseRT(
  target: any,
  timing?: ReturnType<typeof createPrecisionTiming>,
  event?: Event,
) {
  const eventTimestamp = event ? readEventTimestamp(event) : null;
  const source = eventTimestamp
    ? eventTimestamp.source
    : "performance.now_fallback";
  target.responseTimestampSource = source;
  const endTime = eventTimestamp?.responseTime ?? performance.now();
  const startTime = timing?.getOnsetTime() ?? target.start_time ?? endTime;
  return endTime - startTime;
}

export function preloadImages(
  urls: string[],
  timeoutMs = 10000,
): Promise<void> {
  const uniqueUrls = [...new Set(urls.filter(Boolean))];
  if (uniqueUrls.length === 0) return Promise.resolve();

  return Promise.all(
    uniqueUrls.map((url) => {
      if (!imagePreloadCache.has(url)) {
        imagePreloadCache.set(
          url,
          new Promise<void>((resolve) => {
            const image = new Image();
            let settled = false;
            const finish = () => {
              if (settled) return;
              settled = true;
              window.clearTimeout(timeout);
              resolve();
            };
            const timeout = window.setTimeout(finish, timeoutMs);
            image.onload = finish;
            image.onerror = finish;
            image.src = url;
            if (image.complete && image.naturalWidth !== 0) {
              finish();
            } else if ("decode" in image) {
              image
                .decode()
                .then(finish)
                .catch(() => undefined);
            }
          }),
        );
      }
      return imagePreloadCache.get(url)!;
    }),
  )
    .then(() =>
      Promise.all(uniqueUrls.map((url) => preloadBitmap(url, timeoutMs))),
    )
    .then(() => undefined);
}

export function preloadBitmap(
  url: string,
  timeoutMs = 10000,
): Promise<CanvasBitmapSource> {
  if (!bitmapPreloadCache.has(url)) {
    bitmapPreloadCache.set(
      url,
      new Promise<CanvasBitmapSource>((resolve) => {
        const image = new Image();
        let settled = false;

        const resolveWithImage = async () => {
          if (settled) return;
          settled = true;
          window.clearTimeout(timeout);

          if (
            typeof window.createImageBitmap === "function" &&
            image.complete &&
            image.naturalWidth !== 0
          ) {
            try {
              const bitmap = await window.createImageBitmap(image);
              bitmapSourceCache.set(url, bitmap);
              resolve(bitmap);
              return;
            } catch {
              // Fall back to the decoded image element when bitmap creation
              // is unsupported for this image type.
            }
          }

          bitmapSourceCache.set(url, image);
          resolve(image);
        };

        const timeout = window.setTimeout(resolveWithImage, timeoutMs);
        image.onload = resolveWithImage;
        image.onerror = resolveWithImage;
        image.src = url;

        if (image.complete && image.naturalWidth !== 0) {
          resolveWithImage();
        } else if ("decode" in image) {
          image
            .decode()
            .then(resolveWithImage)
            .catch(() => undefined);
        }
      }),
    );
  }

  return bitmapPreloadCache.get(url)!;
}

export function getPreloadedBitmap(url: string): CanvasBitmapSource | null {
  return bitmapSourceCache.get(url) ?? null;
}

/**
 * Returns the cached bitmap ONLY when it is ready for synchronous drawing.
 * A cached HTMLImageElement that resolved via the preload timeout may still
 * have zero intrinsic dimensions; such a resource is NOT usable for a
 * synchronous drawable and must not enable the P4 fast activation path.
 */
export function getReadyPreloadedBitmap(
  url: string,
): CanvasBitmapSource | null {
  const source = bitmapSourceCache.get(url) ?? null;
  if (!source) return null;
  if ("naturalWidth" in source) {
    return source.naturalWidth > 0 && source.naturalHeight > 0 ? source : null;
  }
  return source.width > 0 && source.height > 0 ? source : null;
}

function preloadWithJsPsych(
  cache: Map<string, Promise<void>>,
  urls: string[],
  timeoutMs: number,
  preload: (
    files: string[],
    complete: () => void,
    load: (filepath: string) => void,
    error: (error: unknown) => void,
  ) => void,
) {
  const uniqueUrls = [...new Set(urls.filter(Boolean))];
  if (uniqueUrls.length === 0) return Promise.resolve();

  return Promise.all(
    uniqueUrls.map((url) => {
      if (!cache.has(url)) {
        cache.set(
          url,
          new Promise<void>((resolve) => {
            let settled = false;
            const finish = () => {
              if (settled) return;
              settled = true;
              window.clearTimeout(timeout);
              resolve();
            };
            const timeout = window.setTimeout(finish, timeoutMs);
            preload([url], finish, finish, finish);
          }),
        );
      }
      return cache.get(url)!;
    }),
  ).then(() => undefined);
}

export function preloadAssets(
  jsPsych: any,
  assets: AssetPreloadList,
  timeoutMs = 10000,
): Promise<void> {
  const tasks: Promise<unknown>[] = [
    preloadImages(assets.images, timeoutMs),
    preloadWithJsPsych(
      audioPreloadCache,
      assets.audio,
      timeoutMs,
      jsPsych.pluginAPI.preloadAudio.bind(jsPsych.pluginAPI),
    ),
    preloadWithJsPsych(
      videoPreloadCache,
      assets.video,
      timeoutMs,
      jsPsych.pluginAPI.preloadVideo.bind(jsPsych.pluginAPI),
    ),
  ];

  // Timed-audio preload: when a usable WebAudio AudioContext is available,
  // decode audio buffers before presentation so the scheduled WebAudio path
  // never decodes inside the timing-critical callback.
  const audioContext =
    typeof jsPsych?.pluginAPI?.audioContext === "function"
      ? jsPsych.pluginAPI.audioContext()
      : null;
  if (audioContext) {
    for (const url of [...new Set(assets.audio.filter(Boolean))]) {
      tasks.push(
        preloadAudioBuffer(audioContext, url, timeoutMs).catch(() => null),
      );
    }
  }

  return Promise.all(tasks).then(() => undefined);
}
