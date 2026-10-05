import { afterEach, describe, expect, it, vi } from "vitest";
import { installManagedMediaAPI } from "../../pages/ExperimentBuilder/modules/experiment-runtime/managedMediaAPI";
import { createStandaloneMediaServices } from "../../pages/ExperimentBuilder/modules/experiment-runtime/standaloneMediaServices";
import { prepareMedia } from "../../../../server/dynamicplugin/utils/mediaResources";

function harness(load = async () => {}) {
  const players: {
    dispose: ReturnType<typeof vi.fn>;
    load: ReturnType<typeof vi.fn>;
  }[] = [];
  const factory = vi.fn(() => {
    const player = {
      load: vi.fn(load),
      dispose: vi.fn(),
      play: vi.fn(),
      stop: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    players.push(player);
    return player;
  });
  const api = {
    getAutoPreloadList: () => ({ images: [], audio: [], video: [] }),
    preloadAudio: vi.fn(),
    preloadVideo: vi.fn(),
    getAudioPlayer: vi.fn(),
    getVideoBuffer: vi.fn(),
    cancelPreloads: vi.fn(),
    audioContext: () => null,
  };
  const jsPsych = { getCurrentTrial: () => ({}), pluginAPI: api };
  const manager = installManagedMediaAPI(jsPsych, factory);
  return { jsPsych, api, manager, players, factory };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("Managed jsPsych media ownership", () => {
  it("cancels unowned preloads while preserving callbacks required by another owner", async () => {
    let finish!: () => void;
    const h = harness(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const owner = h.manager.reserve({ audio: ["shared"] });
    const current = prepareMedia(h.jsPsych, { audio: ["shared"] });
    h.api.cancelPreloads();
    expect(h.players[0].dispose).not.toHaveBeenCalled();
    finish();
    await current;
    owner();
    expect(h.players[0].dispose).toHaveBeenCalledOnce();
    const complete = vi.fn();
    h.api.preloadAudio(["manual-pending"], complete);
    h.api.cancelPreloads();
    expect(h.players[1].dispose).toHaveBeenCalledOnce();
    finish();
    await vi.waitFor(() => expect(h.manager.stats().pending).toBe(0));
    expect(complete).not.toHaveBeenCalled();
  });

  it("retries failed audio with a fresh player and invalidates its failed preparation", async () => {
    let attempts = 0;
    const h = harness(async () => {
      if (++attempts === 1) throw new Error("bad audio");
    });
    const first = h.manager.reserve({ audio: ["retry"] });
    await expect(prepareMedia(h.jsPsych, { audio: ["retry"] })).rejects.toThrow(
      "bad audio",
    );
    first();
    const second = h.manager.reserve({ audio: ["retry"] });
    await prepareMedia(h.jsPsych, { audio: ["retry"] });
    expect(h.players[0].dispose).toHaveBeenCalledOnce();
    expect(h.players[1].dispose).not.toHaveBeenCalled();
    second();
    expect(h.manager.stats().audio).toBe(0);
  });
  it("shares audio across active owners and prepares it again after the last release", async () => {
    const h = harness();
    const first = h.manager.reserve({ audio: ["sound?token=one"] });
    const second = h.manager.reserve({ audio: ["sound?token=one"] });
    await Promise.all([
      prepareMedia(h.jsPsych, { audio: ["sound?token=one"] }),
      prepareMedia(h.jsPsych, { audio: ["sound?token=one"] }),
    ]);
    expect(h.factory).toHaveBeenCalledOnce();
    first();
    first();
    expect(h.players[0].dispose).not.toHaveBeenCalled();
    second();
    expect(h.players[0].dispose).toHaveBeenCalledOnce();
    expect(h.manager.stats()).toEqual({
      audio: 0,
      video: 0,
      users: 0,
      pending: 0,
    });
    const seventh = h.manager.reserve({ audio: ["sound?token=one"] });
    await prepareMedia(h.jsPsych, { audio: ["sound?token=one"] });
    expect(h.factory).toHaveBeenCalledTimes(2);
    seventh();
  });

  it("revokes only owned video URLs and preserves full signed URLs during reacquisition", async () => {
    const fetcher = vi.fn(async () => ({
      ok: true,
      blob: async () => new Blob(["video"]),
    }));
    vi.stubGlobal("fetch", fetcher);
    const create = vi
      .spyOn(URL, "createObjectURL")
      .mockReturnValueOnce("blob:one")
      .mockReturnValueOnce("blob:two");
    const revoke = vi
      .spyOn(URL, "revokeObjectURL")
      .mockImplementation(() => {});
    const h = harness();
    const url = "clip.webm?signature=one&token=two";
    const future = h.manager.reserve({ video: [url] });
    const current = h.manager.reserve({ video: [url] });
    await prepareMedia(h.jsPsych, { video: [url] });
    expect(h.api.getVideoBuffer(url)).toBe("blob:one");
    future();
    expect(revoke).not.toHaveBeenCalled();
    current();
    expect(revoke).toHaveBeenCalledWith("blob:one");
    const next = h.manager.reserve({ video: [url, "blob:external"] });
    await prepareMedia(h.jsPsych, { video: [url, "blob:external"] });
    expect(h.api.getVideoBuffer(url)).toBe("blob:two");
    expect(h.api.getVideoBuffer("blob:external")).toBe("blob:external");
    next();
    expect(fetcher.mock.calls.map(([requested]) => requested)).toEqual([
      url,
      url,
    ]);
    expect(create).toHaveBeenCalledTimes(2);
    expect(revoke.mock.calls).toEqual([["blob:one"], ["blob:two"]]);
  });

  it("discards a video completing after retirement without creating or reviving a Blob URL", async () => {
    let finish!: (value: { ok: boolean; blob(): Promise<Blob> }) => void;
    vi.stubGlobal(
      "fetch",
      vi.fn(
        () =>
          new Promise((resolve) => {
            finish = resolve;
          }),
      ),
    );
    const create = vi.spyOn(URL, "createObjectURL");
    const h = harness();
    const release = h.manager.reserve({ video: ["obsolete"] });
    const running = prepareMedia(h.jsPsych, { video: ["obsolete"] });
    const rejected = expect(running).rejects.toMatchObject({
      error: { name: "AbortError" },
    });
    release();
    finish({ ok: true, blob: async () => new Blob(["late"]) });
    await rejected;
    expect(create).not.toHaveBeenCalled();
    expect(h.manager.stats().video).toBe(0);
  });

  it("keeps manual preload blocks until use and replaces unused blocks without closing active audio", async () => {
    const h = harness();
    await new Promise<void>((resolve) =>
      h.api.preloadAudio(["used", "unused"], resolve),
    );
    expect(h.manager.stats().audio).toBe(2);
    const active = h.manager.reserve({ audio: ["used"] }, true);
    const player = await h.api.getAudioPlayer("used");
    h.manager.beginManualPreload();
    expect(h.manager.stats().audio).toBe(1);
    expect(player.dispose).not.toHaveBeenCalled();
    active();
    expect(player.dispose).toHaveBeenCalledOnce();
    expect(h.players.every((p) => p.dispose.mock.calls.length === 1)).toBe(
      true,
    );
  });

  it("tracks resources accessed by opaque callbacks and leaves recording APIs intact", async () => {
    const h = harness();
    const recorder = {};
    const recordingAPI = { getCameraRecorder: () => recorder };
    Object.assign(h.api, recordingAPI);
    const release = h.manager.reserve({}, true);
    const player = await h.api.getAudioPlayer("callback-only");
    expect(h.manager.stats().users).toBe(1);
    release();
    expect(player.dispose).toHaveBeenCalledOnce();
    expect(h.api).toMatchObject(recordingAPI);
    expect(installManagedMediaAPI(h.jsPsych, h.factory)).toBe(h.manager);
  });

  it("invalidates the standalone preparation registry after releasing its source", async () => {
    const h = harness();
    const services = createStandaloneMediaServices(h.jsPsych, []);
    const assets = { images: [], audio: ["revisited"], video: [] };
    for (let trial = 0; trial < 2; trial++) {
      const release = h.manager.reserve(assets);
      await services.prepareAV(assets, 1000);
      release();
    }
    expect(h.factory).toHaveBeenCalledTimes(2);
    expect(h.players.every((p) => p.dispose.mock.calls.length === 1)).toBe(
      true,
    );
  });

  it("unloads even detached media elements and performs final disposal once", async () => {
    const pause = vi
      .spyOn(HTMLMediaElement.prototype, "pause")
      .mockImplementation(() => {});
    const reload = vi
      .spyOn(HTMLMediaElement.prototype, "load")
      .mockImplementation(() => {});
    const h = harness();
    const container = document.createElement("div");
    const release = h.manager.trackElements(container);
    container.innerHTML = '<video src="blob:video"><source src="clip"></video>';
    const video = container.querySelector("video")!;
    container.innerHTML = "";
    h.manager.dispose();
    release();
    h.manager.dispose();
    expect(pause).toHaveBeenCalledOnce();
    expect(reload).toHaveBeenCalledOnce();
    expect(video.hasAttribute("src")).toBe(false);
    expect(video.querySelector("source")!.hasAttribute("src")).toBe(false);
    await expect(h.api.getAudioPlayer("late-callback")).rejects.toMatchObject({
      name: "AbortError",
    });
    expect(h.manager.stats().audio).toBe(0);
    const fresh = installManagedMediaAPI(h.jsPsych, h.factory);
    expect(fresh).not.toBe(h.manager);
    expect(fresh.isDisposed()).toBe(false);
    fresh.dispose();
  });
});
