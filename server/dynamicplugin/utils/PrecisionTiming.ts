type FrameTimingOptions = {
  recordFrameTiming?: boolean;
  longFrameThreshold?: number;
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

type StimulusTimingRecord = {
  name: string;
  desired_onset: number;
  desired_duration: number | null;
  desired_offset: number | null;
  actual_onset: number | null;
  actual_offset: number | null;
  actual_duration: number | null;
  onset_error: number | null;
  duration_error: number | null;
};

export type AssetPreloadList = {
  images: string[];
  audio: string[];
  video: string[];
};

export type CanvasBitmapSource = ImageBitmap | HTMLImageElement;

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
  const scheduledEvents: ScheduledFrameEvent[] = [];
  const startCallbacks: Array<(timestamp: number) => void> = [];
  const frameIntervals: FrameInterval[] = [];
  const stimulusRecords: StimulusTimingRecord[] = [];

  let onsetTime: number | null = null;
  let lastFrameTime: number | null = null;
  let latestFrameTime: number | null = null;
  let rafHandle: number | null = null;
  let running = false;

  const getOnsetTime = () => onsetTime;

  const getElapsed = (timestamp = performance.now()): number | null => {
    if (onsetTime === null) return null;
    return timestamp - onsetTime;
  };

  const runDueEvents = (timestamp: number) => {
    if (onsetTime === null) return;
    const elapsed = timestamp - onsetTime;
    for (const event of scheduledEvents) {
      if (!event.cancelled && elapsed >= event.at) {
        event.cancelled = true;
        event.callback(timestamp, elapsed);
      }
    }
  };

  const tick = (timestamp: number) => {
    if (!running || onsetTime === null) return;

    latestFrameTime = timestamp;
    if (lastFrameTime !== null) {
      const duration = timestamp - lastFrameTime;
      if (recordFrameTiming) {
        frameIntervals.push({
          t: round3(timestamp - onsetTime),
          duration: round3(duration),
        });
      }
    }
    lastFrameTime = timestamp;
    runDueEvents(timestamp);
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

  const scheduleAt = (
    delayMs: number | null | undefined,
    callback: (timestamp: number, elapsed: number) => void,
  ) => {
    const at = Math.max(0, Number(delayMs ?? 0));
    const event: ScheduledFrameEvent = { at, callback, cancelled: false };
    scheduledEvents.push(event);
    return () => {
      event.cancelled = true;
    };
  };

  const registerStimulus = (
    name: string,
    desiredOnset: number | null,
    desiredDuration: number | null,
  ) => {
    const desired_onset = desiredOnset ?? 0;
    const record: StimulusTimingRecord = {
      name,
      desired_onset,
      desired_duration: desiredDuration,
      desired_offset:
        desiredDuration === null ? null : desired_onset + desiredDuration,
      actual_onset: null,
      actual_offset: null,
      actual_duration: null,
      onset_error: null,
      duration_error: null,
    };
    stimulusRecords.push(record);

    return {
      markOnset(timestamp: number) {
        if (onsetTime === null || record.actual_onset !== null) return;
        record.actual_onset = round3(timestamp - onsetTime);
        record.onset_error = round3(record.actual_onset - record.desired_onset);
      },
      markOffset(timestamp: number) {
        if (
          onsetTime === null ||
          record.actual_onset === null ||
          record.actual_offset !== null
        ) {
          return;
        }
        record.actual_offset = round3(timestamp - onsetTime);
        record.actual_duration = round3(
          record.actual_offset - record.actual_onset,
        );
        record.duration_error =
          record.desired_duration === null
            ? null
            : round3(record.actual_duration - record.desired_duration);
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
        next.actual_offset = round3(offsetTime - onsetTime);
        next.actual_duration = round3(next.actual_offset - next.actual_onset);
        next.duration_error =
          next.desired_duration === null
            ? null
            : round3(next.actual_duration - next.desired_duration);
      }
      return next;
    });

    return {
      onsetTime,
      offsetTime,
      actualDuration,
      latestFrameTime,
      frameCount: intervals.length,
      longFrameCount: longFrames.length,
      maxFrameInterval,
      meanFrameInterval,
      longFrameThreshold,
      frameIntervals: intervals,
      frameLog: recordFrameTiming ? frameIntervals : [],
      stimulusRecords: finalizedStimulusRecords,
    };
  };

  return {
    start,
    stop,
    onStart,
    scheduleAt,
    registerStimulus,
    getOnsetTime,
    getElapsed,
    getEventTime,
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
      const handle = window.setTimeout(() => {
        element.style.visibility = "visible";
      }, stimulusOnset);
      cancellations.push(() => window.clearTimeout(handle));
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
      const handle = window.setTimeout(() => {
        element.style.visibility = "hidden";
      }, hideAt);
      cancellations.push(() => window.clearTimeout(handle));
    }
  }

  return () => {
    for (const cancel of cancellations) cancel();
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
  return Math.round(endTime - startTime);
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
