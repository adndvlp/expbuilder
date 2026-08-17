export type AudioClockSnapshot = {
  /** AudioContext-domain clock time in seconds. */
  contextTime: number;
  /** performance.now() domain time in milliseconds. */
  performanceTime: number;
  /** Reported output base latency in seconds (0 when unknown). */
  baseLatency: number;
  source: "getOutputTimestamp" | "currentTime_performanceNow";
};

/**
 * Samples a WebAudio/performance clock bridge.
 *
 * When `context.getOutputTimestamp()` exists and returns finite values it is
 * used; otherwise the fallback pairs `context.currentTime` with a
 * `performance.now()` sample. baseLatency compensation is a nominal value,
 * not a measurement of acoustic output latency.
 */
export function sampleAudioClock(context: AudioContext): AudioClockSnapshot {
  const now = performance.now();
  const baseLatency =
    typeof (context as any).baseLatency === "number" &&
    Number.isFinite((context as any).baseLatency)
      ? (context as any).baseLatency
      : 0;

  const getOutputTimestamp = (context as any).getOutputTimestamp as
    | (() => {
        contextTime: number;
        performanceTime: number;
      })
    | undefined;
  if (typeof getOutputTimestamp === "function") {
    try {
      const output = getOutputTimestamp.call(context);
      if (
        output &&
        typeof output.contextTime === "number" &&
        Number.isFinite(output.contextTime) &&
        typeof output.performanceTime === "number" &&
        Number.isFinite(output.performanceTime)
      ) {
        return {
          contextTime: output.contextTime,
          performanceTime: output.performanceTime,
          baseLatency,
          source: "getOutputTimestamp",
        };
      }
    } catch {
      // Fall through to the currentTime + performance.now() pairing.
    }
  }

  return {
    contextTime: context.currentTime,
    performanceTime: now,
    baseLatency,
    source: "currentTime_performanceNow",
  };
}

/**
 * Translates a performance-domain target (ms) into AudioContext time (s)
 * using the audited lab.js-style mapping. baseLatency compensation is
 * nominal and must not be reported as measured acoustic latency.
 */
export function toContextTime(
  performanceTargetMs: number,
  snapshot: AudioClockSnapshot,
): number {
  return (
    (performanceTargetMs - snapshot.performanceTime) / 1000 +
    snapshot.contextTime -
    snapshot.baseLatency
  );
}

/**
 * Inverse mapping: AudioContext time (s) → performance-domain time (ms).
 */
export function toPerformanceTime(
  contextTargetSec: number,
  snapshot: AudioClockSnapshot,
): number {
  return (
    (contextTargetSec - snapshot.contextTime + snapshot.baseLatency) * 1000 +
    snapshot.performanceTime
  );
}

type DecodedBufferCacheEntry = {
  pending: Map<string, Promise<AudioBuffer | null>>;
  ready: Map<string, AudioBuffer>;
};

const decodedBufferCache = new WeakMap<
  AudioContext,
  DecodedBufferCacheEntry
>();

function getCacheEntry(context: AudioContext): DecodedBufferCacheEntry {
  let entry = decodedBufferCache.get(context);
  if (!entry) {
    entry = { pending: new Map(), ready: new Map() };
    decodedBufferCache.set(context, entry);
  }
  return entry;
}

/**
 * Fetches and decodes an audio buffer into the per-context cache before
 * presentation. Resolves with the decoded AudioBuffer, or with null when
 * the fetch/decode fails or times out, so callers can fall back without
 * crashing.
 */
export function preloadAudioBuffer(
  context: AudioContext,
  url: string,
  timeoutMs = 10000,
): Promise<AudioBuffer | null> {
  const entry = getCacheEntry(context);
  const ready = entry.ready.get(url);
  if (ready) return Promise.resolve(ready);
  const pending = entry.pending.get(url);
  if (pending) return pending;

  const promise = (async () => {
    let timer: number | null = null;
    let buffer: AudioBuffer | null = null;
    try {
      buffer = await Promise.race([
        (async () => {
          const response = await fetch(url);
          const arrayBuffer = await response.arrayBuffer();
          return context.decodeAudioData(arrayBuffer);
        })(),
        new Promise<null>((resolve) => {
          timer = window.setTimeout(() => resolve(null), timeoutMs);
        }),
      ]);
    } catch {
      buffer = null;
    }
    // A successful fetch/decode must not leave a live timeout callback.
    if (timer !== null) {
      window.clearTimeout(timer);
      timer = null;
    }
    entry.pending.delete(url);
    if (buffer) {
      entry.ready.set(url, buffer);
    }
    return buffer;
  })();

  entry.pending.set(url, promise);
  return promise;
}

/**
 * Synchronous lookup of an already-decoded audio buffer for this context.
 */
export function getPreloadedAudioBuffer(
  context: AudioContext,
  url: string,
): AudioBuffer | null {
  const entry = decodedBufferCache.get(context);
  return entry?.ready.get(url) ?? null;
}
