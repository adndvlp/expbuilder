import type { ManagedAudioPlayer } from "./managedMediaTypes";

// Serialized into artifacts; uses the session AudioContext owned by jsPsych.
export function createManagedAudioPlayer(
  url: string,
  context: AudioContext | null,
): ManagedAudioPlayer {
  const controller = new AbortController();
  let audio: HTMLAudioElement | null = null;
  let buffer: AudioBuffer | null = null;
  let source: AudioBufferSourceNode | null = null;
  let started = false;
  let disposed = false;
  let playGeneration = 0;
  let ready: Promise<void> | undefined;
  let cancelLoad: (() => void) | undefined;
  const listeners = new Map<string, Set<EventListenerOrEventListenerObject>>();
  const cancelled = () => new DOMException("Audio retired", "AbortError");
  const disconnect = () => {
    if (!source) return;
    for (const [type, callbacks] of listeners)
      for (const callback of callbacks)
        source.removeEventListener(type, callback);
    if (started) {
      try {
        source.stop();
      } catch {
        /* Already ended. */
      }
    }
    source.disconnect();
    source.buffer = null;
    source = null;
    started = false;
  };
  const node = () => {
    if (!source) {
      if (!context || !buffer) throw new Error(`Audio not prepared: ${url}`);
      source = context.createBufferSource();
      source.buffer = buffer;
      source.connect(context.destination);
      for (const [type, callbacks] of listeners)
        for (const callback of callbacks)
          source.addEventListener(type, callback);
    }
    return source;
  };
  const load = () => {
    if (disposed) return Promise.reject(cancelled());
    if (ready) return ready;
    ready = context
      ? (async () => {
          const response = await fetch(url, { signal: controller.signal });
          if (!response.ok)
            throw new Error(`Audio load failed (${response.status}): ${url}`);
          const bytes = await response.arrayBuffer();
          if (disposed) throw cancelled();
          const decoded = await context.decodeAudioData(bytes);
          if (disposed) throw cancelled();
          buffer = decoded;
        })()
      : new Promise<void>((resolve, reject) => {
          audio = new Audio();
          const element = audio;
          const cleanup = () => {
            element.removeEventListener("canplaythrough", loaded);
            element.removeEventListener("error", failed);
            element.removeEventListener("abort", failed);
            cancelLoad = undefined;
          };
          const loaded = () => {
            cleanup();
            resolve();
          };
          const failed = () => {
            cleanup();
            reject(new Error(`Audio load failed: ${url}`));
          };
          cancelLoad = () => {
            cleanup();
            reject(cancelled());
          };
          element.addEventListener("canplaythrough", loaded);
          element.addEventListener("error", failed);
          element.addEventListener("abort", failed);
          element.preload = "auto";
          element.src = url;
          element.load();
        });
    return ready;
  };
  return {
    load,
    play: () => {
      if (disposed) return;
      if (audio) {
        const generation = ++playGeneration;
        return audio.play().catch((error) => {
          if (!disposed && generation === playGeneration) throw error;
        });
      }
      node().start();
      started = true;
    },
    stop: () => {
      playGeneration++;
      if (audio) {
        audio.pause();
        audio.currentTime = 0;
      } else disconnect();
    },
    addEventListener: (type, callback) => {
      if (disposed) return;
      let callbacks = listeners.get(type);
      if (!callbacks) listeners.set(type, (callbacks = new Set()));
      if (callbacks.has(callback)) return;
      callbacks.add(callback);
      if (audio) audio.addEventListener(type, callback);
      else node().addEventListener(type, callback);
    },
    removeEventListener: (type, callback) => {
      listeners.get(type)?.delete(callback);
      (audio || source)?.removeEventListener(type, callback);
    },
    dispose: () => {
      if (disposed) return;
      disposed = true;
      controller.abort();
      cancelLoad?.();
      disconnect();
      if (audio) {
        for (const [type, callbacks] of listeners)
          for (const callback of callbacks)
            audio.removeEventListener(type, callback);
        audio.pause();
        audio.removeAttribute("src");
        audio.load();
      }
      audio = null;
      buffer = null;
      ready = undefined;
      listeners.clear();
    },
  };
}
