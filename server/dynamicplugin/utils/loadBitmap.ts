import { bitmapCancelled, type CanvasBitmapSource } from "./BitmapCache";

export function loadBitmap(
  url: string,
  signal: AbortSignal,
  timeoutMs: number,
  convertToBitmap = true,
): Promise<CanvasBitmapSource> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    let settled = false;
    let converting = false;
    const cleanup = () => {
      window.clearTimeout(timeout);
      image.onload = null;
      image.onerror = null;
      signal.removeEventListener("abort", abort);
    };
    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      cleanup();
      image.removeAttribute("src");
      reject(error);
    };
    const abort = () => fail(bitmapCancelled());
    const timeout = window.setTimeout(
      () => fail(new Error(`Image preload timed out: ${url}`)),
      timeoutMs,
    );
    const complete = (source: CanvasBitmapSource) => {
      if (settled) {
        if ("close" in source) source.close();
        return;
      }
      settled = true;
      cleanup();
      if (source !== image) image.removeAttribute("src");
      resolve(source);
    };
    const prepare = async () => {
      if (settled || converting) return;
      if (
        !image.complete ||
        image.naturalWidth === 0 ||
        image.naturalHeight === 0
      )
        return;
      converting = true;
      if (convertToBitmap && typeof window.createImageBitmap === "function") {
        try {
          complete(await window.createImageBitmap(image));
          return;
        } catch {
          // A decoded image remains usable where bitmap conversion is unsupported.
        }
      }
      complete(image);
    };
    signal.addEventListener("abort", abort, { once: true });
    image.onload = () => void prepare();
    image.onerror = () => fail(new Error(`Image preload failed: ${url}`));
    if (signal.aborted) {
      abort();
      return;
    }
    image.src = url;
    if (image.complete && image.naturalWidth !== 0) void prepare();
    else if (typeof image.decode === "function") {
      void image
        .decode()
        .then(prepare)
        .catch(() => {});
    }
  });
}
