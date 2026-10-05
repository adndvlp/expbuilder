import { afterEach, describe, expect, it, vi } from "vitest";
import { createManagedAudioPlayer } from "../../pages/ExperimentBuilder/modules/experiment-runtime/managedAudioPlayer";

function webAudio() {
  const nodes: (EventTarget & {
    buffer: unknown;
    start: ReturnType<typeof vi.fn>;
    stop: ReturnType<typeof vi.fn>;
    disconnect: ReturnType<typeof vi.fn>;
  })[] = [];
  const decoded = {} as AudioBuffer;
  const context = {
    destination: {},
    decodeAudioData: vi.fn(async () => decoded),
    createBufferSource: vi.fn(() => {
      const node = Object.assign(new EventTarget(), {
        buffer: null as unknown,
        start: vi.fn(),
        stop: vi.fn(),
        connect: vi.fn(),
        disconnect: vi.fn(),
      });
      nodes.push(node);
      return node;
    }),
  };
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(8),
    })),
  );
  return {
    context,
    decoded,
    nodes,
    nativeContext: context as unknown as AudioContext,
  };
}
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("Managed AudioPlayer compatibility and disposal", () => {
  it("handles playback interrupted by intentional retirement without hiding an active autoplay rejection", async () => {
    vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => {});
    vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
    let reject!: (error: Error) => void;
    vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(
      () =>
        new Promise((_resolve, fail) => {
          reject = fail;
        }),
    );
    const element = document.createElement("audio");
    vi.stubGlobal(
      "Audio",
      vi.fn(function () {
        return element;
      }),
    );
    const player = createManagedAudioPlayer("sound", null);
    const loaded = player.load();
    element.dispatchEvent(new Event("canplaythrough"));
    await loaded;
    const active = player.play();
    reject(new DOMException("Autoplay blocked", "NotAllowedError"));
    await expect(active).rejects.toMatchObject({ name: "NotAllowedError" });
    const retired = player.play();
    player.dispose();
    reject(new DOMException("Playback interrupted", "AbortError"));
    await expect(retired).resolves.toBeUndefined();
  });
  it("loads once without allocating unused sources, supports replay, and disconnects retired sources", async () => {
    const h = webAudio();
    const player = createManagedAudioPlayer(
      "audio?signature=one",
      h.nativeContext,
    );
    await Promise.all([player.load(), player.load()]);
    expect(fetch).toHaveBeenCalledOnce();
    expect(h.nodes).toHaveLength(0);
    const ended = vi.fn();
    player.addEventListener("ended", ended);
    player.play();
    h.nodes[0].dispatchEvent(new Event("ended"));
    expect(ended).toHaveBeenCalledOnce();
    player.stop();
    expect(h.nodes[0].buffer).toBeNull();
    expect(h.nodes[0].disconnect).toHaveBeenCalledOnce();
    player.removeEventListener("ended", ended);
    player.play();
    expect(h.nodes[1].buffer).toBe(h.decoded);
    player.dispose();
    player.dispose();
    player.play();
    h.nodes[1].dispatchEvent(new Event("ended"));
    expect(ended).toHaveBeenCalledOnce();
    expect(h.nodes[1].buffer).toBeNull();
    expect(h.nodes[1].disconnect).toHaveBeenCalledOnce();
    await expect(player.load()).rejects.toMatchObject({ name: "AbortError" });
  });

  it("drops audio decoded after disposal without creating a connected source", async () => {
    const h = webAudio();
    let finish!: (value: AudioBuffer) => void;
    h.context.decodeAudioData.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const player = createManagedAudioPlayer("late", h.nativeContext);
    const loading = player.load();
    const rejected = expect(loading).rejects.toMatchObject({
      name: "AbortError",
    });
    await vi.waitFor(() =>
      expect(h.context.decodeAudioData).toHaveBeenCalledOnce(),
    );
    player.dispose();
    finish(h.decoded);
    await rejected;
    expect(h.nodes).toHaveLength(0);
  });

  it("removes HTML audio sources and listeners after use without touching a session AudioContext", async () => {
    const load = vi
      .spyOn(HTMLMediaElement.prototype, "load")
      .mockImplementation(() => {});
    const pause = vi
      .spyOn(HTMLMediaElement.prototype, "pause")
      .mockImplementation(() => {});
    const play = vi
      .spyOn(HTMLMediaElement.prototype, "play")
      .mockResolvedValue();
    const element = document.createElement("audio");
    vi.stubGlobal(
      "Audio",
      vi.fn(function () {
        return element;
      }),
    );
    const player = createManagedAudioPlayer("sound.wav?token=one", null);
    const loading = player.load();
    element.dispatchEvent(new Event("canplaythrough"));
    await loading;
    const ended = vi.fn();
    player.addEventListener("ended", ended);
    await player.play();
    player.stop();
    player.dispose();
    player.dispose();
    element.dispatchEvent(new Event("ended"));
    expect(ended).not.toHaveBeenCalled();
    expect(play).toHaveBeenCalledOnce();
    expect(pause).toHaveBeenCalledTimes(2);
    expect(load).toHaveBeenCalledTimes(2);
    expect(element.hasAttribute("src")).toBe(false);
  });

  it("cancels an HTML audio load immediately and rejects failed HTTP responses", async () => {
    vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => {});
    vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
    const html = createManagedAudioPlayer("pending", null);
    const pending = html.load();
    const rejected = expect(pending).rejects.toMatchObject({
      name: "AbortError",
    });
    html.dispose();
    await rejected;
    const h = webAudio();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 404 })),
    );
    const player = createManagedAudioPlayer("missing", h.nativeContext);
    await expect(player.load()).rejects.toThrow("404");
    expect(h.context.decodeAudioData).not.toHaveBeenCalled();
    player.dispose();
  });
});
