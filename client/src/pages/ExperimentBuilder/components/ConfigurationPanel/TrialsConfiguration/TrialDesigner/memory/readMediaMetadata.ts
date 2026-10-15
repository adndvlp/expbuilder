import type { MediaResource } from "./resourceInventory";
import type { MediaMetadata } from "./resourceEstimate";

function readBrowserDimensions(
  resource: MediaResource,
  signal: AbortSignal,
): Promise<MediaMetadata> {
  return new Promise((resolve, reject) => {
    const element =
      resource.kind === "image"
        ? new Image()
        : document.createElement(resource.kind === "audio" ? "audio" : "video");
    const event = resource.kind === "image" ? "load" : "loadedmetadata";
    const clean = () => {
      element.removeEventListener(event, ready);
      element.removeEventListener("error", failed);
      signal.removeEventListener("abort", aborted);
      element.removeAttribute("src");
      if (element instanceof HTMLMediaElement) element.load();
    };
    const ready = () => {
      const metadata: MediaMetadata =
        element instanceof HTMLImageElement
          ? { width: element.naturalWidth, height: element.naturalHeight }
          : element instanceof HTMLVideoElement
            ? {
                width: element.videoWidth,
                height: element.videoHeight,
                durationSeconds: element.duration,
              }
            : { durationSeconds: (element as HTMLAudioElement).duration };
      clean();
      resolve(metadata);
    };
    const failed = () => {
      clean();
      reject(new Error("Media metadata unavailable"));
    };
    const aborted = () => {
      clean();
      reject(new DOMException("Inspection cancelled", "AbortError"));
    };
    element.addEventListener(event, ready, { once: true });
    element.addEventListener("error", failed, { once: true });
    signal.addEventListener("abort", aborted, { once: true });
    if (signal.aborted) {
      aborted();
      return;
    }
    if (element instanceof HTMLMediaElement) element.preload = "metadata";
    element.src = resource.url;
  });
}

export async function readMediaMetadata(
  resource: MediaResource,
  experimentID: string | undefined,
  apiUrl: string,
  signal: AbortSignal,
): Promise<MediaMetadata> {
  const url = new URL(resource.url, window.location.href);
  if (experimentID) {
    const local = new URL(
      `${apiUrl}/${encodeURIComponent(experimentID)}/`,
      window.location.href,
    );
    const file = url.pathname.slice(local.pathname.length);
    if (
      url.origin === local.origin &&
      url.pathname.startsWith(local.pathname) &&
      /^(img|aud|vid)\//.test(file)
    ) {
      const endpoint = `${apiUrl}/api/media-memory-metadata/${encodeURIComponent(experimentID)}?${new URLSearchParams({ file })}`;
      const response = await fetch(endpoint, { signal, cache: "no-store" });
      if (!response.ok) throw new Error("Media metadata unavailable");
      return response.json();
    }
  }
  // Remote media is inspected by the browser; it is never fetched by the server.
  // Browsers do not expose audio channel count/sample rate from <audio> metadata.
  const dimensions = await readBrowserDimensions(resource, signal);
  if (signal.aborted)
    throw new DOMException("Inspection cancelled", "AbortError");
  try {
    const response = await fetch(resource.url, { method: "HEAD", signal });
    const header = response.headers.get("content-length");
    const sizeBytes = header === null ? undefined : Number(header);
    if (
      response.ok &&
      sizeBytes !== undefined &&
      Number.isFinite(sizeBytes) &&
      sizeBytes >= 0 &&
      !response.headers.has("content-encoding")
    )
      dimensions.sizeBytes = sizeBytes;
  } catch {
    /* Dimensions are still useful when HEAD/CORS is unavailable. */
  }
  return dimensions;
}
