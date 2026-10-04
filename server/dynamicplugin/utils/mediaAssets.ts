import type {
  MediaPreparationRuntime,
  RuntimeMediaTrial,
} from "../../../client/src/pages/ExperimentBuilder/modules/experiment-runtime/mediaPreparationTypes";

export type MediaAssets = {
  images: string[];
  htmlImages: string[];
  audio: string[];
  video: string[];
};
export type MediaFile = { url?: string; type?: string };

export const emptyMediaAssets = (): MediaAssets => ({
  images: [],
  htmlImages: [],
  audio: [],
  video: [],
});

export function mergeMediaAssets(...lists: Partial<MediaAssets>[]) {
  const result = emptyMediaAssets();
  for (const key of Object.keys(result) as (keyof MediaAssets)[])
    result[key] = [
      ...new Set(lists.flatMap((list) => list[key] || []).filter(Boolean)),
    ];
  return result;
}

// Read resolved values, including HTML and manually declared uploaded media.
// Never invoke parameter functions, callbacks or inspect future branch payloads.
function collectManualMedia(values: unknown[], library: MediaFile[]) {
  const assets = emptyMediaAssets();
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
            ? "htmlImages"
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
            owner === "IMG"
              ? "htmlImages"
              : owner === "AUDIO"
                ? "audio"
                : "video"
          ].push(src);
        }
        for (const element of root.querySelectorAll("video[poster]")) {
          const poster = element.getAttribute("poster");
          if (poster) assets.htmlImages.push(poster);
        }
      }
    } else if (value && typeof value === "object" && !seen.has(value)) {
      seen.add(value);
      for (const child of Object.values(value)) visit(child);
    }
  };
  for (const value of values) visit(value);
  return assets;
}

export function collectDynamicAssets(
  value: unknown,
  library: MediaFile[] = [],
) {
  const assets = emptyMediaAssets();
  if (!value || typeof value !== "object") return assets;
  const trial = value as Record<string, unknown>;
  const components = [
    ...(Array.isArray(trial.components) ? trial.components : []),
    ...(Array.isArray(trial.response_components)
      ? trial.response_components
      : []),
  ];
  for (const value of components) {
    if (!value || typeof value !== "object") continue;
    const config = value as Record<string, unknown>;
    if (
      config.type === "ButtonResponseComponent" &&
      Array.isArray(config.choices)
    ) {
      assets.htmlImages.push(
        ...config.choices.filter(
          (choice: unknown) =>
            typeof choice === "string" &&
            /^(?:data:image\/)|\.(?:png|jpe?g|gif|bmp|svg|webp)(?:[?#]|$)/i.test(
              choice,
            ),
        ),
      );
    }
    const stimulus =
      typeof config.stimulus === "string"
        ? [config.stimulus]
        : Array.isArray(config.stimulus)
          ? config.stimulus.filter((src: unknown) => typeof src === "string")
          : [];
    if (config.type === "ImageComponent") assets.images.push(...stimulus);
    if (config.type === "AudioComponent") assets.audio.push(...stimulus);
    if (config.type === "VideoComponent") assets.video.push(...stimulus);
    if (
      config.type === "SketchpadComponent" &&
      typeof config.background_image === "string"
    )
      assets.htmlImages.push(config.background_image);
  }
  const manual = collectManualMedia(components, library);
  // Canvas images already have a bitmap owner; don't also retain a DOM preload.
  manual.htmlImages = manual.htmlImages.filter(
    (url) => !assets.images.includes(url),
  );
  const declared = trial.media_assets as Partial<MediaAssets> | undefined;
  return mergeMediaAssets(assets, manual, {
    audio: declared?.audio,
    video: declared?.video,
    htmlImages: declared?.images,
  });
}

export function collectStandardAssets(
  jsPsych: MediaPreparationRuntime,
  trial: RuntimeMediaTrial,
  library: MediaFile[],
) {
  const automatic = jsPsych.pluginAPI.getAutoPreloadList([trial]);
  const keys = Object.keys(trial.type!.info.parameters);
  const manual = collectManualMedia(
    keys.map((key) => trial[key]),
    library,
  );
  return mergeMediaAssets(
    { ...automatic, images: [], htmlImages: automatic.images },
    manual,
    {
      ...((trial.media_assets as Partial<MediaAssets>) || {}),
      images: [],
      htmlImages: (trial.media_assets as Partial<MediaAssets>)?.images,
    },
  );
}

// Only static adjacent descriptions in the active scope can be anticipated.
// CSV rows, conditional entries and loop boundaries are prepared at execution.
type AnticipatedTrial = RuntimeMediaTrial & {
  __expbuilderMedia?: { sequential?: boolean; stable?: boolean };
  data?: { branches?: unknown[]; branchConditions?: unknown[] };
};

export function collectUpcomingDynamicAssets(
  jsPsych: { getCurrentTrial?(): unknown; getTimeline?(): unknown },
  trialCount: number,
  library: MediaFile[] = [],
) {
  const value = jsPsych.getCurrentTrial?.();
  const current =
    value && typeof value === "object" ? (value as AnticipatedTrial) : null;
  const root = jsPsych.getTimeline?.();
  if (!current || !Array.isArray(root)) return emptyMediaAssets();
  const sequential = (node: AnticipatedTrial) =>
    typeof node.__expbuilderMedia?.sequential === "boolean"
      ? node.__expbuilderMedia.sequential
      : !node.on_finish &&
        !node.data?.branches?.length &&
        !node.data?.branchConditions?.length;
  if (!sequential(current)) return emptyMediaAssets();
  const find = (nodes: AnticipatedTrial[]): AnticipatedTrial[] | null => {
    const index = nodes.indexOf(current);
    if (index >= 0) return nodes.slice(index + 1);
    for (const node of nodes) {
      if (!Array.isArray(node?.timeline)) continue;
      const found = find(node.timeline);
      if (found) return found;
    }
    return null;
  };
  const candidates = find(root) || [];
  const lists: MediaAssets[] = [];
  const isStatic = (value: unknown): boolean => {
    if (typeof value === "function") return false;
    if (!value || typeof value !== "object") return true;
    if (
      !Array.isArray(value) &&
      Object.getPrototypeOf(value) !== Object.prototype
    )
      return false;
    return Object.values(value).every(isStatic);
  };
  if (
    (current.on_start && current.__expbuilderMedia?.stable !== true) ||
    !isStatic(current.components) ||
    !isStatic(current.response_components)
  )
    return emptyMediaAssets();
  let remaining = Math.max(0, Math.floor(trialCount));
  for (const candidate of candidates.slice(0, remaining)) {
    if (
      candidate?.timeline ||
      candidate?.type?.info?.name !== "plugin-dynamic" ||
      (candidate.on_start && candidate.__expbuilderMedia?.stable !== true)
    )
      break;
    if (
      !isStatic(candidate.components) ||
      !isStatic(candidate.response_components)
    )
      break;
    if (
      ![candidate.components, candidate.response_components].every(
        (value) => value === undefined || Array.isArray(value),
      )
    )
      break;
    const assets = collectDynamicAssets(candidate, library);
    // Cap speculative resources as well as trials; a dense trial must not expand the window.
    if (
      Object.values(assets).reduce((n, urls) => n + urls.length, 0) > remaining
    )
      break;
    lists.push(assets);
    remaining -= Object.values(assets).reduce((n, urls) => n + urls.length, 0);
    if (!sequential(candidate)) break;
  }
  return mergeMediaAssets(...lists);
}
