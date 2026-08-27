import { readEventTimestamp } from "./EventTiming";
import { preloadAudioBuffer } from "./AudioTiming";

export type TrialTimeOriginSource =
  | "frame_engine_raf"
  | "frame_engine_transition";

export type DeadlinePolicy = "nearest" | "not_before";
export type VisualBoundaryPolicy =
  | "strict_not_before_ms"
  | "frame_tolerant_not_before"
  | "nearest_frame"
  | "frame_locked"
  | "frame_count";
export type ScheduleReference = "relative_duration" | "absolute_phase";

export interface HostTrialTimingContext {
  readonly id: string;
  setTrialIndex(index: number): void;
  getOriginTime(): number | null;
  getScheduledOriginTime(): number | null;
  getLatestFrameTime(): number | null;
  getLatestCommittedFrameTime(): number | null;
  getFrameClock(): {
    periodMs: number;
    acceptedSamples?: number;
    lastPredictionError?: number | null;
  };
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
  scheduleVisualTransition?(options: {
    key: string;
    drawableKey: string;
    targetTimeMs: number;
    visible: boolean;
    policy?: VisualBoundaryPolicy;
    minimumPresentedFrames?: number;
    reason?: string;
    onApply?: (timestamp: number) => void;
  }): () => void;
  scheduleVisualTransaction?(options: {
    key: string;
    targetTimeMs: number;
    policy?: VisualBoundaryPolicy;
    operations: Array<{
      drawableKey: string;
      visible: boolean;
      minimumPresentedFrames?: number;
    }>;
    reason?: string;
    onApply?: (timestamp: number) => void;
  }): () => void;
  requestBoundary(options: {
    targetTime?: number;
    targetTimeMs?: number;
    targetFrameIndex?: number | null;
    frameCount?: number | null;
    boundaryPolicy?: VisualBoundaryPolicy;
    scheduleReference?: ScheduleReference;
    requestedDurationMs?: number;
    lateSuccessorPolicy?: "hold_outgoing" | "terminal_blank" | "abort_precision_run";
    allowZeroFrame?: boolean;
    rebasePhase?: boolean;
    reason?: string;
    requestedAt?: number;
    allowTerminal?: boolean;
    onCommit?: (info: any) => void;
  }): boolean;
  replaceBoundary?(options: {
    targetTime?: number;
    targetTimeMs?: number;
    targetFrameIndex?: number | null;
    frameCount?: number | null;
    boundaryPolicy?: VisualBoundaryPolicy;
    scheduleReference?: ScheduleReference;
    requestedDurationMs?: number;
    allowZeroFrame?: boolean;
    rebasePhase?: boolean;
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
  recordCriticalDomMutation?(count?: number): void;
  getCriticalDomMutationCount?(): number;
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
  trialContext: HostTrialTimingContext;
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

export function createPrecisionTiming(options: FrameTimingOptions) {
  if (!options?.trialContext) {
    throw new Error(
      "DynamicPlugin timing requires a FrameEngine TrialTimingContext.",
    );
  }
  const trialContext = options.trialContext;
  const recordFrameTiming = options.recordFrameTiming !== false;
  const longFrameThreshold = options.longFrameThreshold ?? 34;
  const startCallbacks: Array<(timestamp: number) => void> = [];
  const frameIntervals: FrameInterval[] = [];
  // P0.5 (iteración 5): estadísticas ONLINE (O(1) por frame) para que la
  // Phase A lógica nunca recorra el log completo. El log completo sólo se
  // serializa en Phase B.
  let onlineFrameCount = 0;
  let onlineFrameDurationSum = 0;
  let onlineFrameMax: number | null = null;
  let onlineLongFrameCount = 0;
  let onlineDroppedFrameCount = 0;
  const onlineBaselineRing: number[] = [];
  const ONLINE_BASELINE_RING_SIZE = 32;
  const onlineBaselineEstimate = () => {
    if (onlineBaselineRing.length === 0) {
      return trialContext.getFrameIntervalEstimate();
    }
    const sorted = [...onlineBaselineRing].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 1
      ? sorted[middle]
      : (sorted[middle - 1] + sorted[middle]) / 2;
  };
  const recordOnlineInterval = (duration: number) => {
    onlineFrameCount += 1;
    onlineFrameDurationSum += duration;
    if (onlineFrameMax === null || duration > onlineFrameMax) {
      onlineFrameMax = duration;
    }
    if (duration > longFrameThreshold) onlineLongFrameCount += 1;
    const baseline = onlineBaselineEstimate();
    if (baseline > MIN_FRAME_INTERVAL_MS) {
      onlineDroppedFrameCount += Math.max(
        0,
        Math.round(duration / baseline) - 1,
      );
    }
    onlineBaselineRing.push(duration);
    if (onlineBaselineRing.length > ONLINE_BASELINE_RING_SIZE) {
      onlineBaselineRing.shift();
    }
  };
  const stimulusRecords: StimulusTimingRecord[] = [];
  const stimulusControllers: Array<{
    markOffset(timestamp: number, commitInfo?: any): void;
    record: StimulusTimingRecord;
  }> = [];
  const contextUnsubscribers: Array<() => void> = [];

  let trialTimeOrigin: number | null = null;
  let scheduledTrialTimeOrigin: number | null = null;
  let trialTimeOriginSource: TrialTimeOriginSource | null = null;
  let timingDegradedReason: string | null = null;
  const markTimingDegraded = (reason: string) => {
    timingDegradedReason = timingDegradedReason || reason;
  };
  let lastFrameTime: number | null = null;
  let latestFrameTime: number | null = null;
  let latestCommittedFrameTime: number | null = null;

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
    return Math.max(
      1,
      trialContext.getFrameIntervalEstimate() ||
        options.expectedFrameMs ||
        DEFAULT_FRAME_MS,
    );
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
      for (const callback of [...startCallbacks]) callback(timestamp);
    }),
    trialContext.onFrame((timestamp) => {
      latestFrameTime = timestamp;
      if (lastFrameTime !== null) {
        const duration = timestamp - lastFrameTime;
        if (recordFrameTiming && duration > MIN_FRAME_INTERVAL_MS) {
          frameIntervals.push({
            t: round3(timestamp - (trialTimeOrigin ?? timestamp)),
            duration: round3(duration),
          });
          recordOnlineInterval(duration);
        }
      }
      lastFrameTime = timestamp;
    }),
    trialContext.onPostCommit((timestamp) => {
      latestCommittedFrameTime = timestamp;
    }),
  );

  const start = () => trialContext.start();

  const stop = () => {
    trialContext.stop();
    while (contextUnsubscribers.length > 0) contextUnsubscribers.pop()!();
  };

  const onStart = (callback: (timestamp: number) => void) => {
    if (trialTimeOrigin !== null) {
      callback(trialTimeOrigin);
    } else {
      startCallbacks.push(callback);
    }
  };

  const onFrameCommit = (callback: (timestamp: number) => void) => {
    return trialContext.onFrameCommit((timestamp) => callback(timestamp));
  };

  const queuePostCommit = (callback: (timestamp: number) => void) => {
    let unsubscribe = () => {};
    unsubscribe = trialContext.onPostCommit((timestamp) => {
      unsubscribe();
      callback(timestamp);
    });
    return unsubscribe;
  };

  const scheduleAt = (
    delayMs: number | null | undefined,
    callback: (timestamp: number, elapsed: number) => void,
    options: { policy?: DeadlinePolicy } = {},
  ) =>
    trialContext.scheduleAt(
      Math.max(0, Number(delayMs ?? 0)),
      callback,
      options,
    );

  /**
   * P0.2 (iteración 5): intra-trial drawable visibility transitions with
   * full FrameEngine boundary-policy semantics.
   */
  interface GroupedVisualOp {
    drawableKey: string;
    visible: boolean;
    minimumPresentedFrames: number;
    onApply?: (timestamp: number) => void;
  }
  interface VisualTransitionGroup {
    targetTimeMs: number;
    policy: VisualBoundaryPolicy;
    ops: GroupedVisualOp[];
  }
  const visualTransitionGroups = new Map<string, VisualTransitionGroup>();

  /**
   * P0.5 (iteración 6): los offsets+onsets que comparten el MISMO target y
   * policy compatible se agrupan en una transacción atómica del FrameEngine.
   * Ninguna operación se aplica parcialmente: o todo el grupo muta antes del
   * mismo shared WebGL commit, o nada.
   */
  const scheduleVisualTransition = (options: {
    key: string;
    drawableKey: string;
    targetTimeMs: number;
    visible: boolean;
    policy?: VisualBoundaryPolicy;
    minimumPresentedFrames?: number;
    reason?: string;
    onApply?: (timestamp: number) => void;
  }) => {
    if (trialContext.scheduleVisualTransaction) {
      const policy = options.policy ?? "nearest_frame";
      const groupKey = `${options.targetTimeMs}:${policy}`;
      let group = visualTransitionGroups.get(groupKey);
      if (!group) {
        group = { targetTimeMs: options.targetTimeMs, policy, ops: [] };
        visualTransitionGroups.set(groupKey, group);
      }
      const op: GroupedVisualOp = {
        drawableKey: options.drawableKey,
        visible: options.visible === true,
        minimumPresentedFrames: Math.max(
          0,
          options.minimumPresentedFrames ?? 0,
        ),
        onApply: options.onApply,
      };
      group.ops.push(op);
      return () => {
        const index = group.ops.indexOf(op);
        if (index >= 0) group.ops.splice(index, 1);
        if (group.ops.length === 0) visualTransitionGroups.delete(groupKey);
      };
    }
    if (trialContext.scheduleVisualTransition) {
      return trialContext.scheduleVisualTransition(options);
    }
    throw new Error(
      "FrameEngine TrialTimingContext lacks visual transition support.",
    );
  };

  /** Materializa los grupos como transacciones atómicas del engine. */
  const flushVisualTransactions = () => {
    if (!trialContext.scheduleVisualTransaction) {
      throw new Error(
        "FrameEngine TrialTimingContext lacks visual transaction support.",
      );
    }
    for (const [groupKey, group] of visualTransitionGroups) {
      trialContext.scheduleVisualTransaction({
        key: groupKey,
        targetTimeMs: group.targetTimeMs,
        policy: group.policy,
        operations: group.ops.map((op) => ({
          drawableKey: op.drawableKey,
          visible: op.visible,
          minimumPresentedFrames: op.minimumPresentedFrames,
        })),
        reason: "visual_transaction",
        onApply: (timestamp) => {
          for (const op of group.ops) op.onApply?.(timestamp);
        },
      });
    }
    visualTransitionGroups.clear();
  };

  const requestBoundary = (boundaryOptions: {
    targetTime?: number;
    targetTimeMs?: number;
    targetFrameIndex?: number | null;
    frameCount?: number | null;
    boundaryPolicy?: VisualBoundaryPolicy;
    scheduleReference?: ScheduleReference;
    requestedDurationMs?: number;
    lateSuccessorPolicy?: "hold_outgoing" | "terminal_blank" | "abort_precision_run";
    allowZeroFrame?: boolean;
    rebasePhase?: boolean;
    reason?: string;
    requestedAt?: number;
    allowTerminal?: boolean;
    onCommit?: (info: any) => void;
  }) => trialContext.requestBoundary(boundaryOptions);

  const replaceBoundary = (boundaryOptions: {
    targetTime?: number;
    targetTimeMs?: number;
    targetFrameIndex?: number | null;
    frameCount?: number | null;
    boundaryPolicy?: VisualBoundaryPolicy;
    scheduleReference?: ScheduleReference;
    requestedDurationMs?: number;
    allowZeroFrame?: boolean;
    rebasePhase?: boolean;
    reason?: string;
    requestedAt?: number;
    allowTerminal?: boolean;
    onCommit?: (info: any) => void;
  }) => {
    if (!trialContext.replaceBoundary) {
      throw new Error(
        "FrameEngine TrialTimingContext lacks boundary replacement support.",
      );
    }
    return trialContext.replaceBoundary(boundaryOptions);
  };

  const queuePostCritical = (
    task: (budgetMs?: number) => void | boolean,
    taskOptions?: {
      label?: string;
      estimatedCostMs?: number;
      responseSafe?: boolean;
      minimumBudgetMs?: number;
    },
  ) => trialContext.queuePostCritical(task, taskOptions);

  const setNextAudioDeadline = (timestamp: number | null) => {
    trialContext.setNextAudioDeadline?.(timestamp);
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
        trialContext.recordStimulusCommit({
          componentId: record.component_id,
          name: record.name,
          scheduledTime: record.scheduled_onset_abs,
          commitTime: onsetTimestamp,
        });
        // V1 compatibility aliases
        record.actual_onset_abs = record.frame_onset_abs;
        record.actual_onset = record.frame_onset;
      },
      markDegraded(reason: string) {
        record.timing_degraded = true;
        record.timing_degraded_reason =
          record.timing_degraded_reason || reason;
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

  const finalizeStimulusRecords = (offsetTime: number) =>
    stimulusRecords.map((record) => {
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

  /**
   * P0.5 (iteración 5): snapshot O(1) para la PHASE A lógica. Sólo lee
   * contadores online, origen, último frame y anclas de estímulos — jamás
   * recorre el frame log completo ni serializa.
   */
  const getCriticalSnapshot = (offsetTime = performance.now()) => {
    const actualDuration =
      trialTimeOrigin === null ? null : offsetTime - trialTimeOrigin;
    const baselineFrameMs = onlineBaselineEstimate();
    return {
      trialTimeOrigin,
      scheduledTrialTimeOrigin,
      trialTimeOriginSource,
      onsetTime: trialTimeOrigin,
      offsetTime,
      actualDuration,
      latestFrameTime,
      latestCommittedFrameTime,
      framePeriodEstimateMs: round3(trialContext.getFrameIntervalEstimate()),
      framePredictionErrorMs: null,
      framePredictorSamples: null,
      frameCount: onlineFrameCount,
      longFrameCount: onlineLongFrameCount,
      droppedFrameCount: onlineDroppedFrameCount,
      maxFrameInterval: onlineFrameMax,
      meanFrameInterval:
        onlineFrameCount > 0
          ? onlineFrameDurationSum / onlineFrameCount
          : null,
      frameIntervalEstimate: baselineFrameMs,
      longFrameThreshold,
      frameIntervals: [],
      frameLog: [],
      transitionTelemetry: [...trialContext.getTransitionTelemetry()],
      stimulusRecords: finalizeStimulusRecords(offsetTime),
    };
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
    const finalizedStimulusRecords = finalizeStimulusRecords(offsetTime);
    const frameClock = trialContext.getFrameClock();

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
        typeof frameClock.lastPredictionError === "number"
          ? round3(frameClock.lastPredictionError)
          : null,
      framePredictorSamples: frameClock.acceptedSamples ?? null,
      frameCount: intervals.length,
      longFrameCount: longFrames.length,
      droppedFrameCount,
      maxFrameInterval,
      meanFrameInterval,
      frameIntervalEstimate: baselineFrameMs,
      longFrameThreshold,
      frameIntervals: intervals,
      frameLog: recordFrameTiming ? frameIntervals : [],
      transitionTelemetry: [...trialContext.getTransitionTelemetry()],
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
    stop,
    onStart,
    onFrameCommit,
    queuePostCommit,
    requestBoundary,
    replaceBoundary,
    queuePostCritical,
    setNextAudioDeadline,
    scheduleAt,
    scheduleVisualTransition,
    flushVisualTransactions,
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
    markTimingDegraded,
    getTimingDegradedReason: () => timingDegradedReason,
    getSummary,
    getCriticalSnapshot,
    isGlobalFrameEngine: () => true,
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
  if (!timing && (stimulusOnset !== null || stimulusDuration !== null)) {
    throw new Error(
      "Scheduled stimulus visibility requires an injected PrecisionTiming authority.",
    );
  }
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
    }
  }

  return () => {
    for (const cancel of cancellations) cancel();
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
