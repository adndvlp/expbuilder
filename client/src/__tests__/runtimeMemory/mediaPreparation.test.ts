import { afterEach, describe, expect, it, vi } from "vitest";
import { createStandaloneMediaServices } from "../../pages/ExperimentBuilder/modules/experiment-runtime/standaloneMediaServices";
import { createMediaPreparation } from "../../pages/ExperimentBuilder/modules/experiment-runtime/mediaPreparation";
import { prepareMedia } from "../../../../server/dynamicplugin/utils/mediaResources";
import { controlledImages } from "./testHarness/images";

function harness(asyncTrial = false) {
  const present = vi.fn();
  const onLoad = vi.fn();
  const onFinish = vi.fn();
  class Plugin {
    static info = {
      name: "image-test",
      parameters: { stimulus: {}, prompt: {} },
    };
    constructor(_runtime?: unknown) {
      void _runtime;
    }
    trial(_display: HTMLElement, trial: unknown, load: () => void) {
      present(trial);
      if (asyncTrial) {
        load();
        return Promise.resolve({ answer: 7 });
      }
    }
    simulate(trial: unknown, mode: string) {
      present(trial, mode);
    }
  }
  const node = { type: Plugin, on_finish: onFinish };
  const api = {
    getAutoPreloadList: vi.fn((trials: { stimulus?: unknown }[]) => ({
      images:
        typeof trials[0].stimulus === "string" &&
        !trials[0].stimulus.includes("<")
          ? [trials[0].stimulus]
          : [],
      audio: [],
      video: [],
    })),
    preloadAudio: vi.fn((_urls, done) => done()),
    preloadVideo: vi.fn((_urls, done) => done()),
  };
  const jsPsych = { getCurrentTrial: () => node, pluginAPI: api };
  return { Plugin, node, api, jsPsych, onLoad, onFinish, present };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("Preparation around standard plugin execution", () => {
  it("prepares declared function dependencies without invoking the function", async () => {
    const images = controlledImages();
    const h = harness();
    let calls = 0;
    const stimulus = () => {
      calls++;
      return "manual.png";
    };
    const prepare = createMediaPreparation(h.jsPsych, [
      { url: "manual.png", type: "img" },
    ]);
    prepare.install([h.node]);
    const running = new h.node.type(h.jsPsych).trial(
      document.createElement("div"),
      { type: h.node.type, stimulus },
      h.onLoad,
    );
    await vi.waitFor(() => expect(images).toHaveLength(1));
    expect(images[0].src).toBe("manual.png");
    expect(calls).toBe(0);
    images[0].load();
    await vi.waitFor(() => expect(h.present).toHaveBeenCalledOnce());
    await h.node.on_finish({});
    await running;
    expect(calls).toBe(0);
  });
  it("does not present or record a trial when its media preparation fails", async () => {
    const images = controlledImages();
    const h = harness();
    const prepare = createMediaPreparation(h.jsPsych, []);
    prepare.install([h.node]);
    const running = new h.node.type(h.jsPsych).trial(
      document.createElement("div"),
      { type: h.node.type, stimulus: "failed" },
      h.onLoad,
    );
    const rejection = expect(running).rejects.toThrow("Image preload failed");
    await vi.waitFor(() => expect(images).toHaveLength(1));
    images[0].fail();
    await rejection;
    expect(h.present).not.toHaveBeenCalled();
    expect(h.onLoad).not.toHaveBeenCalled();
    expect(h.onFinish).not.toHaveBeenCalled();
    expect(images[0].src).toBe("");
  });
  it("downloads only resolved current media and keeps images until the synchronous trial finishes", async () => {
    const images = controlledImages();
    const h = harness();
    const prepare = createMediaPreparation(h.jsPsych, [
      { url: "unused", type: "img" },
    ]);
    prepare.install([h.node]);
    expect(images).toHaveLength(0);
    const plugin = new h.node.type(h.jsPsych);
    const resolved = {
      type: h.node.type,
      stimulus: "csv-row-2",
      prompt: '<img src="embedded?x=1&amp;y=2">',
    };
    const running = plugin.trial(
      document.createElement("div"),
      resolved,
      h.onLoad,
    );
    await vi.waitFor(() => expect(images).toHaveLength(2));
    expect(images.map((image) => image.src)).toEqual([
      "csv-row-2",
      "embedded?x=1&y=2",
    ]);
    images[0].load();
    expect(h.present).not.toHaveBeenCalled();
    images[1].load();
    await vi.waitFor(() => expect(h.present).toHaveBeenCalledWith(resolved));
    expect(h.onLoad).toHaveBeenCalledOnce();
    expect(images[0].src).toBe("csv-row-2");
    await h.node.on_finish({ result: 1 });
    await running;
    expect(h.onFinish).toHaveBeenCalledWith({ result: 1 });
    expect(images.every((image) => image.src === "")).toBe(true);
  });

  it("preserves asynchronous plugin results and on_load without an extra finish event", async () => {
    controlledImages();
    const h = harness(true);
    const prepare = createMediaPreparation(h.jsPsych, []);
    prepare.install([h.node]);
    const plugin = new h.node.type(h.jsPsych);
    expect(
      await plugin.trial(
        document.createElement("div"),
        { type: h.node.type },
        h.onLoad,
      ),
    ).toEqual({ answer: 7 });
    expect(h.present).toHaveBeenCalledOnce();
    expect(h.onLoad).toHaveBeenCalledOnce();
    expect(h.onFinish).not.toHaveBeenCalled();
  });

  it("serializes a self-contained kernel and leaves data-only simulation free of media loads", () => {
    const images = controlledImages();
    const h = harness();
    const serialized = new Function(
      `return (${createMediaPreparation.toString()})`,
    )();
    const factory = new Function(
      `return (${createStandaloneMediaServices.toString()})`,
    )();
    const prepare = serialized(h.jsPsych, [], undefined, factory);
    prepare.install([h.node]);
    const plugin = new h.node.type(h.jsPsych);
    plugin.simulate({ stimulus: "not-loaded" }, "data-only", {}, h.onLoad);
    expect(h.present).toHaveBeenCalledOnce();
    expect(images).toHaveLength(0);
    expect(h.api.getAutoPreloadList).not.toHaveBeenCalled();
  });

  it("does not present a retired trial after its preparation completes", async () => {
    const images = controlledImages();
    const h = harness();
    const prepare = createMediaPreparation(h.jsPsych, []);
    prepare.install([h.node]);
    const running = new h.node.type(h.jsPsych).trial(
      document.createElement("div"),
      { type: h.node.type, stimulus: "late" },
      h.onLoad,
    );
    await vi.waitFor(() => expect(images).toHaveLength(1));
    prepare.dispose();
    await running;
    expect(h.present).not.toHaveBeenCalled();
    expect(h.onLoad).not.toHaveBeenCalled();
    expect(images[0].src).toBe("");
  });

  it("keeps explicit preload trials and Dynamic trials with their original plugin", () => {
    const h = harness();
    const explicit = { type: { info: { name: "preload" } } };
    const dynamic = { type: { info: { name: "plugin-dynamic" } } };
    const types = [explicit.type, dynamic.type];
    createMediaPreparation(h.jsPsych, []).install([explicit, dynamic]);
    expect([explicit.type, dynamic.type]).toEqual(types);
  });
});

describe("Audio/video preparation shared with Dynamic", () => {
  it("shares in-flight and completed requests, preserving full URLs and jsPsych instance isolation", async () => {
    const callbacks: (() => void)[] = [];
    const preload = vi.fn((_urls, done) => callbacks.push(done));
    const jsPsych = {
      pluginAPI: { preloadAudio: preload, preloadVideo: preload },
    };
    const assets = {
      images: [],
      audio: ["sound?token=one", "sound?token=one"],
      video: ["clip"],
    };
    const first = prepareMedia(jsPsych, assets);
    const second = prepareMedia(jsPsych, assets);
    expect(preload).toHaveBeenCalledTimes(2);
    for (const finish of callbacks) finish();
    await Promise.all([first, second]);
    await prepareMedia(jsPsych, assets);
    expect(preload).toHaveBeenCalledTimes(2);
    const another = {
      pluginAPI: {
        preloadAudio: vi.fn((_urls, done) => done()),
        preloadVideo: vi.fn((_urls, done) => done()),
      },
    };
    await prepareMedia(another, assets);
    expect(another.pluginAPI.preloadVideo).toHaveBeenCalledOnce();
  });

  it("retries failed preparations and never records an error as success", async () => {
    const preloadAudio = vi.fn((_urls, done, _load, fail) =>
      fail(new Error("failed")),
    );
    const jsPsych = { pluginAPI: { preloadAudio } };
    await expect(prepareMedia(jsPsych, { audio: ["sound"] })).rejects.toThrow(
      "failed",
    );
    preloadAudio.mockImplementation((_urls, done) => done());
    await prepareMedia(jsPsych, { audio: ["sound"] });
    expect(preloadAudio).toHaveBeenCalledTimes(2);
  });

  it("reuses a video prepared by an explicit jsPsych preload", async () => {
    const preloadVideo = vi.fn();
    const jsPsych = {
      pluginAPI: { preloadVideo, getVideoBuffer: () => "blob:already-loaded" },
    };
    await prepareMedia(jsPsych, { video: ["clip"] });
    expect(preloadVideo).not.toHaveBeenCalled();
  });
});
