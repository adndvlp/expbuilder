import { BitmapCache } from "./BitmapCache";
import { loadBitmap } from "./loadBitmap";
import { assetLoadQueue } from "./AssetLoadQueue";

export type { BitmapLease, CanvasBitmapSource } from "./BitmapCache";

const cache = new BitmapCache((url, signal, timeoutMs, priority) =>
  assetLoadQueue.run(
    `bitmap:${url}`,
    () => loadBitmap(url, signal, timeoutMs),
    signal,
    priority,
  ),
);

export const acquireBitmap = (url: string, timeoutMs = 10000, priority = 0) => {
  const lease = cache.acquire(url, timeoutMs, priority);
  assetLoadQueue.promote(`bitmap:${url}`, priority);
  return lease;
};
export const retainBitmapSource = (source: CanvasImageSource) =>
  cache.retainSource(source);
export const getBitmapCacheSnapshot = () => cache.snapshot();

export function retainBitmapAssets(
  urls: string[],
  timeoutMs = 10000,
  priority = 0,
) {
  const leases = [...new Set(urls.filter(Boolean))].map((url) =>
    acquireBitmap(url, timeoutMs, priority),
  );
  let released = false;
  return () => {
    if (released) return;
    released = true;
    for (const lease of leases) lease.release();
  };
}

export async function preloadImages(
  urls: string[],
  timeoutMs = 10000,
  signal?: AbortSignal,
  priority = 0,
) {
  const leases = [...new Set(urls.filter(Boolean))].map((url) =>
    acquireBitmap(url, timeoutMs, priority),
  );
  const release = () => {
    for (const lease of leases) lease.release();
  };
  signal?.addEventListener("abort", release, { once: true });
  if (signal?.aborted) release();
  try {
    await Promise.all(leases.map((lease) => lease.ready));
  } finally {
    signal?.removeEventListener("abort", release);
    release();
  }
}
