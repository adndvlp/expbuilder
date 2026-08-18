import { readEventTimestamp } from "./EventTiming";
import { preloadAudioBuffer } from "./AudioTiming";

export type TrialTimeOriginSource = "fresh_raf" | "visual_handoff" | "host_coordinator";

export type DeadlinePolicy = "nearest" | "not_before";

type FrameTimingOptions = {
  recordFrameTiming?: boolean;
  longFrameThreshold?: number;
  expectedFrameMs?: number;
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

export function resolveTimingMs(raw: any, fallback: number | null = null): number | null {
  if (raw === null || raw === undefined) return fallback;
  if (typeof raw === "object" && "value" in raw) {
    return raw.value === null || raw.value === undefined ? fallback : Number(raw.value);
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
  const recentFrameIntervals: number[] = [];

  let trialTimeOrigin: number | null = null;
  let trialTimeOriginSource: TrialTimeOriginSource | null = null;
  let lastFrameTime: number | null = null;
  let latestFrameTime: number | null = null;
  let latestCommittedFrameTime: number | null = null;
  let frameIntervalEstimate = fallbackFrameMs;
  let rafHandle: number | null = null;
  let running = false;

  const getTrialTimeOrigin = () => trialTimeOrigin;
  const getTrialTimeOriginSource = () => trialTimeOriginSource;

  /** Deprecated V1 compatibility alias of getTrialTimeOrigin(). */
  const getOnsetTime = () => trialTimeOrigin;

  const getElapsed = (timestamp = performance.now()): number | null => {
    if (trialTimeOrigin === null) return null;
    return timestamp - trialTimeOrigin;
  };

  const updateFrameEstimate = (duration: number) => {
    if (!Number.isFinite(duration) || duration <= MIN_FRAME_INTERVAL_MS) return;
    recentFrameIntervals.push(duration);
    if (recentFrameIntervals.length > 10) {
      recentFrameIntervals.shift();
    }
    const sorted = [...recentFrameIntervals].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    frameIntervalEstimate =
      sorted.length % 2 === 1
        ? sorted[middle]
        : (sorted[middle - 1] + sorted[middle]) / 2;
  };

  const getFrameIntervalEstimate = () =>
    Math.max(1, frameIntervalEstimate || fallbackFrameMs);

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
      updateFrameEstimate(duration);
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

  const startAt = (timestamp: number, source: TrialTimeOriginSource) => {
    if (trialTimeOrigin !== null || rafHandle !== null) return;
    trialTimeOrigin = timestamp;
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
    if (trialTimeOrigin !== null || rafHandle !== null) return;
    rafHandle = requestAnimationFrame((timestamp) => {
      rafHandle = null;
      startAt(timestamp, "fresh_raf");
    });
  };

  const stop = () => {
    running = false;
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

    const applyCommitInfo = (
      phase: "onset" | "offset",
      commitInfo: any,
    ) => {
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
        record.render_backend = commitInfo.renderBackend ?? record.render_backend;
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
        record.render_backend = commitInfo.renderBackend ?? record.render_backend;
      }
      return frameTimestamp;
    };

    return {
      markOnset(timestamp: number, commitInfo?: any) {
        if (trialTimeOrigin === null || record.frame_onset !== null) return;
        const frameTimestamp = applyCommitInfo("onset", commitInfo);
        const onsetTimestamp =
          typeof frameTimestamp === "number" ? frameTimestamp : timestamp;
        record.frame_onset_abs = round3(onsetTimestamp);
        record.frame_onset = round3(onsetTimestamp - trialTimeOrigin);
        record.onset_error = round3(record.frame_onset - record.desired_onset);
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
        record.frame_duration = round3(record.frame_offset - record.frame_onset);
        record.offset_error =
          record.desired_offset === null
            ? null
            : round3(record.frame_offset - record.desired_offset);
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
  };

  const getEventTime = (event: Event): number => {
    return readEventTimestamp(event).responseTime;
  };

  const getSummary = (offsetTime = performance.now()) => {
    const actualDuration =
      trialTimeOrigin === null ? null : offsetTime - trialTimeOrigin;
    const intervals = recordFrameTiming ? frameIntervals.map((frame) => frame.duration) : [];
    const longFrames = intervals.filter((duration) => duration > longFrameThreshold);
    const baselineFrameMs = estimateBaselineFrameMs(intervals);
    const droppedFrameCount = intervals.reduce((sum, duration) => {
      return sum + Math.max(0, Math.round(duration / baselineFrameMs) - 1);
    }, 0);
    const maxFrameInterval = intervals.length > 0 ? Math.max(...intervals) : null;
    const meanFrameInterval =
      intervals.length > 0
        ? intervals.reduce((sum, duration) => sum + duration, 0) / intervals.length
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
        return finalizedStimulusRecords.find((record) => record.name === name) ?? null;
      }
      return null;
    };

    return {
      trialTimeOrigin,
      trialTimeOriginSource,
      onsetTime: trialTimeOrigin,
      offsetTime,
      actualDuration,
      latestFrameTime,
      latestCommittedFrameTime,
      frameCount: intervals.length,
      longFrameCount: longFrames.length,
      droppedFrameCount,
      maxFrameInterval,
      meanFrameInterval,
      frameIntervalEstimate: baselineFrameMs,
      longFrameThreshold,
      frameIntervals: intervals,
      frameLog: recordFrameTiming ? frameIntervals : [],
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
    return null;
  };

  return {
    start,
    startAt,
    stop,
    onStart,
    onFrameCommit,
    queuePostCommit,
    scheduleAt,
    registerStimulus,
    getTrialTimeOrigin,
    getTrialTimeOriginSource,
    getOnsetTime,
    getElapsed,
    getFrameIntervalEstimate,
    getEventTime,
    findStimulusRecord,
    getSummary,
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
      cancellations.push(scheduleFrameEvent(stimulusOnset, () => {
        element.style.visibility = "visible";
      }));
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

export function setResponseStartTime(target: any, timing?: ReturnType<typeof createPrecisionTiming>) {
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

export function preloadImages(urls: string[], timeoutMs = 10000): Promise<void> {
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
              image.decode().then(finish).catch(() => undefined);
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
          image.decode().then(resolveWithImage).catch(() => undefined);
        }
      }),
    );
  }

  return bitmapPreloadCache.get(url)!;
}

export function getPreloadedBitmap(url: string): CanvasBitmapSource | null {
  return bitmapSourceCache.get(url) ?? null;
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
