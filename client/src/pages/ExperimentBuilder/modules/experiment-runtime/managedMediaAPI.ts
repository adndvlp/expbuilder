import type { MediaPreparationRuntime } from "./mediaPreparationTypes";
import type {
  AudioPlayerFactory,
  ManagedAudioPlayer,
  ManagedMediaAPI,
  ManagedMediaAssets,
} from "./managedMediaTypes";

// Explicit pluginAPI integration, installed before any preload. No private SDK fields.
// The function and its audio factory are serialized into local and public artifacts.
export function installManagedMediaAPI(
  jsPsych: MediaPreparationRuntime,
  createPlayer: AudioPlayerFactory,
): ManagedMediaAPI {
  if (
    jsPsych.pluginAPI.expBuilderMedia &&
    !jsPsych.pluginAPI.expBuilderMedia.isDisposed()
  )
    return jsPsych.pluginAPI.expBuilderMedia;
  type Entry = {
    type: "audio" | "video";
    url: string;
    users: number;
    manual: boolean;
    ready?: Promise<unknown>;
    player?: ManagedAudioPlayer;
    blob?: string;
    controller: AbortController;
    retired: boolean;
    loaded: boolean;
  };
  const entries = new Map<string, Entry>();
  const batches = new Set<(force?: boolean) => void>();
  const elementOwners = new Set<() => void>();
  let scope: Set<Entry> | undefined;
  let disposed = false;
  const keyOf = (type: string, url: string) => `${type}:${url}`;
  const retire = (entry: Entry) => {
    if (entry.retired) return;
    entry.retired = true;
    if (entries.get(keyOf(entry.type, entry.url)) === entry)
      entries.delete(keyOf(entry.type, entry.url));
    entry.controller.abort();
    entry.player?.dispose();
    if (entry.blob) URL.revokeObjectURL(entry.blob);
    entry.player = undefined;
    entry.blob = undefined;
    entry.ready = undefined;
  };
  const get = (type: "audio" | "video", url: string) => {
    if (disposed) throw new DOMException("Media runtime retired", "AbortError");
    const key = keyOf(type, url);
    let entry = entries.get(key);
    if (!entry) {
      entry = {
        type,
        url,
        users: 0,
        manual: true,
        controller: new AbortController(),
        retired: false,
        loaded: false,
      };
      entries.set(key, entry);
    }
    return entry;
  };
  const protect = (entry: Entry, owner: Set<Entry>) => {
    entry.manual = false;
    if (!owner.has(entry)) {
      owner.add(entry);
      entry.users++;
    }
  };
  const load = (entry: Entry) => {
    if (entry.ready) return entry.ready;
    entry.ready =
      entry.type === "audio"
        ? (async () => {
            entry.player = createPlayer(
              entry.url,
              jsPsych.pluginAPI.audioContext?.() || null,
            );
            await entry.player.load();
            if (entry.retired)
              throw new DOMException("Media retired", "AbortError");
            return entry.player;
          })()
        : (async () => {
            if (entry.url.startsWith("blob:")) return entry.url;
            const response = await fetch(entry.url, {
              signal: entry.controller.signal,
            });
            if (!response.ok)
              throw new Error(
                `Video load failed (${response.status}): ${entry.url}`,
              );
            const blob = await response.blob();
            if (entry.retired)
              throw new DOMException("Media retired", "AbortError");
            entry.blob = URL.createObjectURL(blob);
            return entry.blob;
          })();
    void entry.ready.then(
      () => {
        entry.loaded = true;
      },
      () => retire(entry),
    );
    return entry.ready;
  };
  const preload = (
    type: "audio" | "video",
    files: string[],
    complete = () => {},
    loaded: (url: string) => void = () => {},
    failed: (error: unknown) => void = () => {},
  ) => {
    if (disposed) {
      failed(new DOMException("Media runtime retired", "AbortError"));
      return;
    }
    const requested = [...new Set(files.flat().filter(Boolean))].map((url) =>
      get(type, url),
    );
    if (!requested.length) {
      complete();
      return;
    }
    let cancelled = false;
    const cancel = (force = false) => {
      if (!force && requested.every((entry) => entry.users > 0)) return;
      cancelled = true;
      batches.delete(cancel);
      for (const entry of requested)
        if (!entry.users && !entry.loaded) retire(entry);
    };
    batches.add(cancel);
    let remaining = requested.length;
    let errors = false;
    for (const entry of requested) {
      void load(entry)
        .then(
          () => {
            if (!cancelled) loaded(entry.url);
          },
          (error) => {
            errors = true;
            if (!cancelled)
              failed(type === "audio" ? error : { source: entry.url, error });
          },
        )
        .then(() => {
          if (--remaining === 0) {
            batches.delete(cancel);
            if (!cancelled && !errors) complete();
          }
        });
    }
  };
  const managed: ManagedMediaAPI = {
    reserve: (assets: ManagedMediaAssets, active = false) => {
      if (disposed) return () => {};
      const owner = new Set<Entry>();
      for (const type of ["audio", "video"] as const)
        for (const url of new Set(assets[type] || []))
          if (url) protect(get(type, url), owner);
      if (active) scope = owner;
      let released = false;
      return () => {
        if (released) return;
        released = true;
        if (scope === owner) scope = undefined;
        for (const entry of owner)
          if (--entry.users === 0 && !entry.manual) retire(entry);
        owner.clear();
      };
    },
    trackElements: (container) => {
      if (disposed) return () => {};
      const elements = new Set<HTMLMediaElement>();
      const capture = (node: Node) => {
        if (!(node instanceof Element)) return;
        if (node instanceof HTMLMediaElement) elements.add(node);
        for (const element of node.querySelectorAll<HTMLMediaElement>(
          "audio,video",
        ))
          elements.add(element);
      };
      const captureRecords = (records: MutationRecord[]) => {
        for (const record of records)
          for (const node of [...record.addedNodes, ...record.removedNodes])
            capture(node);
      };
      capture(container);
      const observer = new MutationObserver(captureRecords);
      observer.observe(container, { childList: true, subtree: true });
      let released = false;
      const release = () => {
        if (released) return;
        released = true;
        captureRecords(observer.takeRecords());
        observer.disconnect();
        elementOwners.delete(release);
        for (const element of elements) {
          element.onended =
            element.onloadeddata =
            element.onplaying =
            element.onseeked =
              null;
          element.pause();
          element.srcObject = null;
          element.removeAttribute("src");
          for (const source of element.querySelectorAll("source"))
            source.removeAttribute("src");
          element.load();
        }
        elements.clear();
      };
      elementOwners.add(release);
      return release;
    },
    beginManualPreload: () => {
      for (const entry of entries.values()) if (!entry.users) retire(entry);
    },
    has: (type, url) => entries.has(keyOf(type, url)),
    isDisposed: () => disposed,
    dispose: () => {
      if (disposed) return;
      disposed = true;
      for (const cancel of batches) cancel(true);
      for (const release of elementOwners) release();
      for (const entry of entries.values()) retire(entry);
      scope = undefined;
    },
    stats: () => ({
      audio: [...entries.values()].filter((e) => e.type === "audio").length,
      video: [...entries.values()].filter((e) => e.type === "video").length,
      users: [...entries.values()].reduce((sum, e) => sum + e.users, 0),
      pending: batches.size,
    }),
  };
  const cancelOriginal = jsPsych.pluginAPI.cancelPreloads?.bind(
    jsPsych.pluginAPI,
  );
  Object.assign(jsPsych.pluginAPI, {
    expBuilderMedia: managed,
    getAudioPlayer: async (url: string) => {
      const entry = get("audio", url);
      if (scope) protect(entry, scope);
      return await load(entry);
    },
    getVideoBuffer: (url: string) => {
      if (disposed) return;
      if (url.startsWith("blob:")) return url; // External URLs keep their original owner.
      const entry = scope
        ? get("video", url)
        : entries.get(keyOf("video", url));
      if (entry && scope) protect(entry, scope);
      return entry?.blob;
    },
    preloadAudio: (
      ...args: Parameters<MediaPreparationRuntime["pluginAPI"]["preloadAudio"]>
    ) => preload("audio", ...args),
    preloadVideo: (
      ...args: Parameters<MediaPreparationRuntime["pluginAPI"]["preloadVideo"]>
    ) => preload("video", ...args),
    cancelPreloads: () => {
      for (const cancel of batches) cancel();
      cancelOriginal?.();
    },
  });
  return managed;
}
