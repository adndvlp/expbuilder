import { BitmapCache } from "./BitmapCache";
import { loadBitmap } from "./loadBitmap";

export type { BitmapLease, CanvasBitmapSource } from "./BitmapCache";

const cache = new BitmapCache(loadBitmap);

export const acquireBitmap = (url: string, timeoutMs = 10000) =>
  cache.acquire(url, timeoutMs);
export const retainBitmapSource = (source: CanvasImageSource) =>
  cache.retainSource(source);
export const getBitmapCacheSnapshot = () => cache.snapshot();

export function retainBitmapAssets(urls: string[], timeoutMs = 10000) {
  const leases = [...new Set(urls.filter(Boolean))].map((url) =>
    acquireBitmap(url, timeoutMs),
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
) {
  const leases = [...new Set(urls.filter(Boolean))].map((url) =>
    acquireBitmap(url, timeoutMs),
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
