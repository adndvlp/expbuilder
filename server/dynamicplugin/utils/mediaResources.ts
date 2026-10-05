import type { MediaPreparationRuntime } from "../../../client/src/pages/ExperimentBuilder/modules/experiment-runtime/mediaPreparationTypes";

import { assetLoadQueue } from "./AssetLoadQueue";
import { BitmapCache } from "./BitmapCache";
import { loadBitmap } from "./loadBitmap";
import { preloadImages } from "./bitmapResources";
import type { MediaAssets } from "./mediaAssets";

const htmlImages = new BitmapCache((url, signal, timeoutMs, priority) =>
  assetLoadQueue.run(
    `html:${url}`,
    () => loadBitmap(url, signal, timeoutMs, false),
    signal,
    priority,
  ),
);
type MediaLoadRuntime = {
  pluginAPI: Partial<
    Pick<
      MediaPreparationRuntime["pluginAPI"],
      "preloadAudio" | "preloadVideo" | "getVideoBuffer" | "expBuilderMedia"
    >
  >;
};

type MediaEntry = {
  ready: Promise<void>;
  controller: AbortController;
  users: number;
  settled: boolean;
};
const registries = new WeakMap<object, Map<string, MediaEntry>>();

export function retainHtmlImages(
  urls: string[],
  timeoutMs = 10000,
  priority = 0,
) {
  const leases = [...new Set(urls.filter(Boolean))].map((url) => {
    const lease = htmlImages.acquire(url, timeoutMs, priority);
    assetLoadQueue.promote(`html:${url}`, priority);
    return lease;
  });
  return {
    ready: Promise.all(leases.map((lease) => lease.ready)).then(
      () => undefined,
    ),
    release: () => leases.forEach((lease) => lease.release()),
  };
}

function prepareJsPsychMedia(
  jsPsych: MediaLoadRuntime,
  type: "audio" | "video",
  urls: string[],
  timeoutMs: number,
  priority: number,
  signal?: AbortSignal,
) {
  let registry = registries.get(jsPsych);
  if (!registry) registries.set(jsPsych, (registry = new Map()));
  const entries: MediaEntry[] = [];
  const ready = Promise.all(
    [...new Set(urls.filter(Boolean))].map((url) => {
      const key = `${type}:${url}`;
      assetLoadQueue.promote(key, priority);
      let entry = registry!.get(key);
      if (!entry) {
        const current: MediaEntry = {
          ready: null!,
          controller: new AbortController(),
          users: 0,
          settled: false,
        };
        current.ready = assetLoadQueue.run(
          key,
          () =>
            new Promise<void>((resolve, reject) => {
              let settled = false;
              const finish = (error?: unknown) => {
                if (settled) return;
                settled = true;
                window.clearTimeout(timer);
                if (error) reject(error);
                else resolve();
              };
              const timer = window.setTimeout(
                () => finish(new Error(`${type} preload timed out: ${url}`)),
                timeoutMs,
              );
              try {
                if (type === "video" && jsPsych.pluginAPI.getVideoBuffer?.(url))
                  finish();
                else {
                  const preload =
                    jsPsych.pluginAPI[
                      type === "audio" ? "preloadAudio" : "preloadVideo"
                    ];
                  if (!preload) throw new Error(`Missing ${type} preload API`);
                  preload.call(
                    jsPsych.pluginAPI,
                    [url],
                    () => finish(),
                    () => {},
                    (error: unknown) =>
                      finish(
                        error || new Error(`${type} preload failed: ${url}`),
                      ),
                  );
                }
              } catch (error) {
                finish(error);
              }
            }),
          current.controller.signal,
          priority,
        );
        entry = current;
        registry!.set(key, current);
        void current.ready.then(
          () => {
            current.settled = true;
            if (
              jsPsych.pluginAPI.expBuilderMedia &&
              registry!.get(key) === current
            )
              registry!.delete(key);
          },
          () => {
            current.settled = true;
            if (registry!.get(key) === current) registry!.delete(key);
          },
        );
      }
      entry.users++;
      entries.push(entry);
      return entry.ready;
    }),
  ).then(() => undefined);
  let released = false;
  const release = () => {
    if (released) return;
    released = true;
    for (const entry of entries) {
      entry.users--;
      if (entry.users === 0 && !entry.settled) entry.controller.abort();
    }
  };
  signal?.addEventListener("abort", release, { once: true });
  if (signal?.aborted) release();
  return ready.finally(() => {
    signal?.removeEventListener("abort", release);
    release();
  });
}

export function prepareMedia(
  jsPsych: MediaLoadRuntime,
  assets: Partial<MediaAssets>,
  timeoutMs = 10000,
  signal?: AbortSignal,
  priority = 0,
) {
  if (signal?.aborted)
    return Promise.reject(
      new DOMException("Asset preparation cancelled", "AbortError"),
    );
  const html = retainHtmlImages(assets.htmlImages || [], timeoutMs, priority);
  const release = () => html.release();
  signal?.addEventListener("abort", release, { once: true });
  if (signal?.aborted) release();
  return Promise.all([
    preloadImages(assets.images || [], timeoutMs, signal, priority),
    html.ready,
    prepareJsPsychMedia(
      jsPsych,
      "audio",
      assets.audio || [],
      timeoutMs,
      priority,
      signal,
    ),
    prepareJsPsychMedia(
      jsPsych,
      "video",
      assets.video || [],
      timeoutMs,
      priority,
      signal,
    ),
  ])
    .then(() => undefined)
    .finally(() => {
      signal?.removeEventListener("abort", release);
      release();
    });
}
