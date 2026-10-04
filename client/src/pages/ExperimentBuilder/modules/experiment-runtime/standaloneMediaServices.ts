import type {
  PreparedAssets,
  RuntimeMediaTrial,
  MediaPreparationRuntime,
} from "./mediaPreparationTypes";

// Serialized with the coordinator when DynamicPlugin is absent.
export function createStandaloneMediaServices(
  jsPsych: MediaPreparationRuntime,
  library: { url?: string; type?: string }[],
) {
  const pending: (() => void)[] = [];
  let active = 0;
  const run = <T>(task: () => Promise<T>, signal?: AbortSignal) =>
    new Promise<T>((resolve, reject) => {
      const cancel = () => {
        const index = pending.indexOf(start);
        if (index < 0) return;
        pending.splice(index, 1);
        signal?.removeEventListener("abort", cancel);
        reject(new DOMException("Asset preparation cancelled", "AbortError"));
      };
      const start = () => {
        signal?.removeEventListener("abort", cancel);
        active++;
        Promise.resolve()
          .then(() => {
            if (signal?.aborted)
              throw new DOMException(
                "Asset preparation cancelled",
                "AbortError",
              );
            return task();
          })
          .then(resolve, reject)
          .finally(() => {
            active--;
            pending.shift()?.();
          });
      };
      if (signal?.aborted) {
        reject(new DOMException("Asset preparation cancelled", "AbortError"));
        return;
      }
      signal?.addEventListener("abort", cancel, { once: true });
      if (active < 2) start();
      else pending.push(start);
    });
  const loaded = new Map<string, Promise<void>>();
  const prepareAV = (
    assets: PreparedAssets,
    timeoutMs: number,
    signal?: AbortSignal,
  ) =>
    Promise.all(
      ["audio", "video"].flatMap((type) =>
        assets[type].map((url: string) => {
          const key = `${type}:${url}`;
          if (!loaded.has(key)) {
            const ready = run(
              () =>
                new Promise<void>((resolve, reject) => {
                  let settled = false;
                  const finish = (error?: unknown) => {
                    if (settled) return;
                    settled = true;
                    clearTimeout(timer);
                    if (error) reject(error);
                    else resolve();
                  };
                  const timer = setTimeout(
                    () => finish(new Error(`Media preload timed out: ${url}`)),
                    timeoutMs,
                  );
                  try {
                    if (
                      type === "video" &&
                      jsPsych.pluginAPI.getVideoBuffer?.(url)
                    )
                      finish();
                    else
                      jsPsych.pluginAPI[
                        type === "audio" ? "preloadAudio" : "preloadVideo"
                      ](
                        [url],
                        () => finish(),
                        () => {},
                        (error: unknown) =>
                          finish(
                            error || new Error(`Media preload failed: ${url}`),
                          ),
                      );
                  } catch (error) {
                    finish(error);
                  }
                }),
              signal,
            );
            loaded.set(key, ready);
            void ready.catch(() => {
              if (loaded.get(key) === ready) loaded.delete(key);
            });
          }
          return loaded.get(key);
        }),
      ),
    );
  const reserveImages = (urls: string[], timeoutMs: number) => {
    const releases: (() => void)[] = [];
    let released = false;
    const ready = Promise.all(
      urls.map((url) =>
        run(
          () =>
            new Promise<void>((resolve, reject) => {
              if (released) {
                resolve();
                return;
              }
              const image = new Image();
              let settled = false;
              const finish = (error?: Error) => {
                if (settled) return;
                settled = true;
                clearTimeout(timer);
                image.onload = image.onerror = null;
                if (error) reject(error);
                else resolve();
              };
              const timer = setTimeout(
                () => finish(new Error(`Image preload timed out: ${url}`)),
                timeoutMs,
              );
              releases.push(() => {
                finish();
                image.removeAttribute("src");
              });
              image.onload = () => finish();
              image.onerror = () =>
                finish(new Error(`Image preload failed: ${url}`));
              image.src = url;
              if (image.complete && image.naturalWidth) finish();
            }),
        ),
      ),
    );
    return {
      ready,
      release: () => {
        released = true;
        for (const release of releases) release();
        releases.length = 0;
      },
    };
  };
  const collect = (trial: RuntimeMediaTrial) => {
    const assets = jsPsych.pluginAPI.getAutoPreloadList([trial]);
    const seen = new Set<object>();
    const visit = (value: unknown) => {
      if (typeof value === "string" || typeof value === "function") {
        const functionSource =
          typeof value === "function"
            ? Function.prototype.toString.call(value)
            : null;
        for (const file of library) {
          if (
            !file.url ||
            (value !== file.url && !functionSource?.includes(file.url))
          )
            continue;
          const key =
            file.type === "img"
              ? "images"
              : file.type === "aud"
                ? "audio"
                : file.type === "vid"
                  ? "video"
                  : null;
          if (key) assets[key].push(file.url);
        }
        if (
          typeof value === "string" &&
          /<(?:img|audio|video|source)\b/i.test(value)
        ) {
          const template = document.createElement("template");
          template.innerHTML = value;
          const root = template.content;
          for (const element of root.querySelectorAll(
            "img[src], audio[src], video[src], audio source[src], video source[src]",
          )) {
            const src = element.getAttribute("src");
            if (!src) continue;
            const owner =
              element.tagName === "SOURCE"
                ? element.parentElement?.tagName
                : element.tagName;
            assets[
              owner === "IMG" ? "images" : owner === "AUDIO" ? "audio" : "video"
            ].push(src);
          }
          for (const element of root.querySelectorAll("video[poster]")) {
            const src = element.getAttribute("poster");
            if (src) assets.images.push(src);
          }
        }
      } else if (value && typeof value === "object" && !seen.has(value)) {
        seen.add(value);
        for (const child of Object.values(value)) visit(child);
      }
    };
    for (const key of Object.keys(trial.type!.info.parameters))
      visit(trial[key]);
    const declared = trial.media_assets as Partial<PreparedAssets> | undefined;
    for (const key of ["images", "audio", "video"])
      assets[key] = [
        ...new Set([
          ...assets[key],
          ...(Array.isArray(declared?.[key])
            ? declared[key].filter((url) => typeof url === "string")
            : []),
        ]),
      ];
    return assets;
  };
  return { collect, prepareAV, reserveImages };
}
