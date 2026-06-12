type FrameTimingOptions = {
  recordFrameTiming?: boolean;
  longFrameThreshold?: number;
  expectedFrameMs?: number;
};

type ScheduledFrameEvent = {
  at: number;
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
  render_backend: string | null;
};

export type AssetPreloadList = {
  images: string[];
  audio: string[];
  video: string[];
};

export type CanvasBitmapSource = ImageBitmap | HTMLImageElement;

const DEFAULT_FRAME_MS = 1000 / 60;
const MIN_FRAME_INTERVAL_MS = 0.25;
const round3 = (value: number): number => Math.round(value * 1000) / 1000;
const imagePreloadCache = new Map<string, Promise<void>>();
const bitmapPreloadCache = new Map<string, Promise<CanvasBitmapSource>>();
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

  let onsetTime: number | null = null;
  let lastFrameTime: number | null = null;
  let latestFrameTime: number | null = null;
  let frameIntervalEstimate = fallbackFrameMs;
  let rafHandle: number | null = null;
  let running = false;

  const getOnsetTime = () => onsetTime;

  const getElapsed = (timestamp = performance.now()): number | null => {
    if (onsetTime === null) return null;
    return timestamp - onsetTime;
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
    if (onsetTime === null) return false;
    const targetTime = onsetTime + event.at;
    const frameMs = getFrameIntervalEstimate();
    const errorNow = Math.abs(timestamp - targetTime);
    const errorNext = Math.abs(timestamp + frameMs - targetTime);
    return errorNow <= errorNext;
  };

  const runDueEvents = (timestamp: number) => {
    if (onsetTime === null) return;
    const elapsed = timestamp - onsetTime;
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
  };

  const tick = (timestamp: number) => {
    if (!running || onsetTime === null) return;

    latestFrameTime = timestamp;
    if (lastFrameTime !== null) {
      const duration = timestamp - lastFrameTime;
      updateFrameEstimate(duration);
      if (recordFrameTiming && duration > MIN_FRAME_INTERVAL_MS) {
        frameIntervals.push({
          t: round3(timestamp - onsetTime),
          duration: round3(duration),
        });
      }
    }
    lastFrameTime = timestamp;
    runDueEvents(timestamp);
    runFrameCommitCallbacks(timestamp);
    rafHandle = requestAnimationFrame(tick);
  };

  const start = () => {
    if (onsetTime !== null || rafHandle !== null) return;
    rafHandle = requestAnimationFrame((timestamp) => {
      onsetTime = timestamp;
      lastFrameTime = timestamp;
      latestFrameTime = timestamp;
      running = true;
      for (const callback of [...startCallbacks]) {
        callback(timestamp);
      }
      runDueEvents(timestamp);
      runFrameCommitCallbacks(timestamp);
      rafHandle = requestAnimationFrame(tick);
    });
  };

  const stop = () => {
    running = false;
    if (rafHandle !== null) {
      cancelAnimationFrame(rafHandle);
      rafHandle = null;
    }
  };

  const onStart = (callback: (timestamp: number) => void) => {
    if (onsetTime !== null) {
      callback(onsetTime);
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
  ) => {
    const at = Math.max(0, Number(delayMs ?? 0));
    const event: ScheduledFrameEvent = { at, callback, cancelled: false };
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
  ) => {
    const desired_onset = desiredOnset ?? 0;
    const record: StimulusTimingRecord = {
      component_id: componentId,
      name,
      desired_onset,
      desired_duration: desiredDuration,
      desired_offset:
        desiredDuration === null ? null : desired_onset + desiredDuration,
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
      render_backend: null,
    };
    stimulusRecords.push(record);

    return {
      markOnset(timestamp: number, commitInfo?: any) {
        if (onsetTime === null || record.actual_onset !== null) return;
        const onsetTimestamp =
          typeof commitInfo?.timestamp === "number"
            ? commitInfo.timestamp
            : timestamp;
        record.actual_onset_abs = round3(onsetTimestamp);
        record.actual_onset = round3(onsetTimestamp - onsetTime);
        record.onset_error = round3(record.actual_onset - record.desired_onset);
        if (commitInfo) {
          record.onset_commit_index = commitInfo.commitIndex ?? null;
          record.onset_commit_duration =
            typeof commitInfo.commitDuration === "number"
              ? round3(commitInfo.commitDuration)
              : null;
          record.render_backend = commitInfo.renderBackend ?? record.render_backend;
        }
      },
      markOffset(timestamp: number, commitInfo?: any) {
        if (
          onsetTime === null ||
          record.actual_onset === null ||
          record.actual_offset !== null
        ) {
          return;
        }
        const offsetTimestamp =
          typeof commitInfo?.timestamp === "number"
            ? commitInfo.timestamp
            : timestamp;
        record.actual_offset_abs = round3(offsetTimestamp);
        record.actual_offset = round3(offsetTimestamp - onsetTime);
        record.actual_duration = round3(
          record.actual_offset - record.actual_onset,
        );
        record.offset_error =
          record.desired_offset === null
            ? null
            : round3(record.actual_offset - record.desired_offset);
        record.duration_error =
          record.desired_duration === null
            ? null
            : round3(record.actual_duration - record.desired_duration);
        if (commitInfo) {
          record.offset_commit_index = commitInfo.commitIndex ?? null;
          record.offset_commit_duration =
            typeof commitInfo.commitDuration === "number"
              ? round3(commitInfo.commitDuration)
              : null;
          record.render_backend = commitInfo.renderBackend ?? record.render_backend;
        }
      },
      record,
    };
  };

  const getEventTime = (event: Event): number => {
    const now = performance.now();
    const eventTime = event.timeStamp;
    if (
      typeof eventTime === "number" &&
      eventTime > 0 &&
      Math.abs(now - eventTime) < 100000
    ) {
      return eventTime;
    }
    return now;
  };

  const getSummary = (offsetTime = performance.now()) => {
    const actualDuration = onsetTime === null ? null : offsetTime - onsetTime;
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
        onsetTime !== null &&
        next.actual_onset !== null &&
        next.actual_offset === null
      ) {
        next.actual_offset_abs = round3(offsetTime);
        next.actual_offset = round3(offsetTime - onsetTime);
        next.actual_duration = round3(next.actual_offset - next.actual_onset);
        next.offset_error =
          next.desired_offset === null
            ? null
            : round3(next.actual_offset - next.desired_offset);
        next.duration_error =
          next.desired_duration === null
            ? null
            : round3(next.actual_duration - next.desired_duration);
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
      onsetTime,
      offsetTime,
      actualDuration,
      latestFrameTime,
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
    stop,
    onStart,
    onFrameCommit,
    scheduleAt,
    registerStimulus,
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
        timing.scheduleAt(stimulusOnset, (timestamp) => {
          element.style.visibility = "visible";
          stimulusTiming?.markOnset(timestamp);
        }),
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
        timing.scheduleAt(hideAt, (timestamp) => {
          element.style.visibility = "hidden";
          stimulusTiming?.markOffset(timestamp);
        }),
      );
    } else {
      cancellations.push(scheduleFrameEvent(hideAt, () => {
        element.style.visibility = "hidden";
      }));
    }
  }

  return () => {
    for (const cancel of cancellations) cancel();
  };
}

export function scheduleFrameEvent(
  delayMs: number | null | undefined,
  callback: (timestamp: number, elapsed: number) => void,
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
  const endTime = event && timing ? timing.getEventTime(event) : performance.now();
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
              resolve(await window.createImageBitmap(image));
              return;
            } catch {
              // Fall back to the decoded image element when bitmap creation
              // is unsupported for this image type.
            }
          }

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
  return Promise.all([
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
  ]).then(() => undefined);
}
