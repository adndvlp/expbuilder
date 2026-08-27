import { beforeEach, describe, expect, it, vi } from "vitest";

const stageState = vi.hoisted(() => ({
  stage: null as any,
}));

const assetState = vi.hoisted(() => ({
  readySource: null as any,
  preloadBitmap: vi.fn(),
}));

vi.mock("../renderer/CanvasStage", () => ({
  getCanvasStage: () => stageState.stage,
}));

vi.mock("../utils/PrecisionTiming", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../utils/PrecisionTiming")>();
  return {
    ...actual,
    getReadyPreloadedBitmap: () => assetState.readySource,
    preloadBitmap: (...args: any[]) => assetState.preloadBitmap(...args),
  };
});

import ImageComponent from "../components/ImageComponent";

describe("persistent visual drawable lifecycle", () => {
  beforeEach(() => {
    assetState.readySource = { width: 100, height: 100 };
    assetState.preloadBitmap.mockReset();
    const pendingVisibilityCommits: Array<(info: any) => void> = [];
    const residentTextures = new Set<string>();
    stageState.stage = {
      width: 1024,
      height: 768,
      canvas: document.createElement("canvas"),
      preloadTexture: vi.fn((key: string) => residentTextures.add(key)),
      isTextureResident: vi.fn((key: string) => residentTextures.has(key)),
      registerSprite: vi.fn(() => vi.fn()),
      setDrawableVisibility: vi.fn(
        (_id: string, _visible: boolean, callback?: (info: any) => void) => {
          if (callback) pendingVisibilityCommits.push(callback);
        },
      ),
      pendingVisibilityCommits,
      residentTextures,
    };
  });

  const precisionConfig = (overrides: Record<string, any> = {}) => ({
    type: "ImageComponent",
    name: "target",
    stimulus: "target.png",
    stimulus_onset: null,
    stimulus_duration: 50,
    __precisionGlobalPath: true,
    __componentId: "target",
    __runtimeComponentId: "trial:target",
    __canvasStyles: { width: 1024, height: 768 },
    __renderBackend: "webgl-strict",
    __timing: {
      registerStimulus: vi.fn(() => ({
        markOnset: vi.fn(),
        markOffset: vi.fn(),
      })),
      onStart: vi.fn(() => vi.fn()),
      scheduleAt: vi.fn(() => vi.fn()),
    },
    ...overrides,
  });

  it("declares a cached image ready only after drawable and GPU preparation", async () => {
    const component = new ImageComponent({} as any);
    await component.prepare(document.body, precisionConfig());

    expect(assetState.preloadBitmap).not.toHaveBeenCalled();
    expect(stageState.stage.preloadTexture).toHaveBeenCalledTimes(1);
    expect(stageState.stage.registerSprite).toHaveBeenCalledTimes(1);
    expect(component.getPrecisionReadiness()).toMatchObject({
      ready: true,
      reason: "image_drawable_gpu_ready",
      fallbackReason: "",
    });
    expect(component.getPrecisionReadiness().resourceReadyAt).toEqual(
      expect.any(Number),
    );
    expect(component.getPrecisionReadiness().gpuReadyAt).toEqual(
      expect.any(Number),
    );
  });

  it("waits for a cold image before resolving precision prepare", async () => {
    assetState.readySource = null;
    let resolveDecode!: (source: any) => void;
    assetState.preloadBitmap.mockReturnValue(
      new Promise((resolve) => {
        resolveDecode = resolve;
      }),
    );
    const component = new ImageComponent({} as any);
    let settled = false;
    const preparation = component
      .prepare(document.body, precisionConfig())
      .then(() => {
        settled = true;
      });

    await Promise.resolve();
    expect(settled).toBe(false);
    expect(component.getPrecisionReadiness().ready).toBe(false);
    resolveDecode({ width: 120, height: 80 });
    await preparation;
    expect(component.getPrecisionReadiness().ready).toBe(true);
    expect(stageState.stage.registerSprite).toHaveBeenCalledTimes(1);
  });

  it("waits on a cache miss even when preload_assets=false", async () => {
    assetState.readySource = null;
    let resolveResource!: (source: any) => void;
    assetState.preloadBitmap.mockReturnValue(
      new Promise((resolve) => {
        resolveResource = resolve;
      }),
    );
    const component = new ImageComponent({} as any);
    const preparation = component.prepare(
      document.body,
      precisionConfig({ preload_assets: false }),
    );

    await Promise.resolve();
    expect(component.getPrecisionReadiness().ready).toBe(false);
    resolveResource({ width: 32, height: 32 });
    await preparation;
    expect(component.getPrecisionReadiness().ready).toBe(true);
  });

  it("does not report precision readiness while decode is delayed", async () => {
    assetState.readySource = null;
    let resolveDecode!: (source: any) => void;
    assetState.preloadBitmap.mockReturnValue(
      new Promise((resolve) => {
        resolveDecode = resolve;
      }),
    );
    const component = new ImageComponent({} as any);
    const preparation = component.prepare(document.body, precisionConfig());

    await Promise.resolve();
    expect(component.getPrecisionReadiness()).toMatchObject({
      ready: false,
      reason: "image_not_ready",
    });
    expect(stageState.stage.registerSprite).not.toHaveBeenCalled();
    resolveDecode({ width: 64, height: 64 });
    await preparation;
  });

  it("fails preparation explicitly when the image resource fails", async () => {
    assetState.readySource = null;
    assetState.preloadBitmap.mockRejectedValue(new Error("decode failed"));
    const component = new ImageComponent({} as any);

    await expect(
      component.prepare(document.body, precisionConfig()),
    ).rejects.toThrow("decode failed");
    expect(component.getPrecisionReadiness()).toMatchObject({
      ready: false,
      fallbackReason: "image_resource_load_or_decode_failed",
    });
    expect(stageState.stage.registerSprite).not.toHaveBeenCalled();
  });

  it("hides an outgoing image and records its offset on the shared boundary commit", () => {
    let startCallback!: (timestamp: number) => void;
    const markOnset = vi.fn();
    const markOffset = vi.fn();
    const timing = {
      registerStimulus: vi.fn(() => ({ markOnset, markOffset })),
      onStart: vi.fn((callback: (timestamp: number) => void) => {
        startCallback = callback;
        return vi.fn();
      }),
      scheduleAt: vi.fn(),
    };
    const component = new ImageComponent({} as any);
    stageState.stage.residentTextures.add("image:white.png");

    component.render(document.body, {
      type: "ImageComponent",
      name: "outgoing",
      stimulus: "white.png",
      stimulus_onset: null,
      stimulus_duration: 50,
      __deferOffsetToTrialBoundary: true,
      __componentId: "outgoing",
      __runtimeComponentId: "trial-a:outgoing",
      __canvasStyles: { width: 1024, height: 768 },
      __renderBackend: "webgl-strict",
      __timing: timing,
    });

    startCallback(0);
    component.deactivate({ timestamp: 50 });

    expect(
      stageState.stage.setDrawableVisibility.mock.calls.map(
        (call: any[]) => call[1],
      ),
    ).toEqual([true, false]);
    expect(markOffset).not.toHaveBeenCalled();

    const commitInfo = { frameTimestamp: 50, commitIndex: 4 };
    stageState.stage.pendingVisibilityCommits[1](commitInfo);
    expect(markOffset).toHaveBeenCalledWith(50, commitInfo);
  });
});
