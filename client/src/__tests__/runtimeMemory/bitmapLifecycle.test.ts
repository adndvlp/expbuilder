import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ImageComponent from "../../../../server/dynamicplugin/components/ImageComponent";
import { getCanvasStages } from "../../../../server/dynamicplugin/renderer/CanvasStage";
import {
  acquireBitmap,
  getBitmapCacheSnapshot,
  preloadImages,
  retainBitmapAssets,
} from "../../../../server/dynamicplugin/utils/bitmapResources";
import { createGpuHarness } from "./testHarness/gpu";
import { controlledImages, testBitmap } from "./testHarness/images";

describe("Bitmap lifetime through real components and stages", () => {
  let gpu: ReturnType<typeof createGpuHarness>;
  let images: ReturnType<typeof controlledImages>;
  beforeEach(() => {
    gpu = createGpuHarness();
    images = controlledImages();
  });
  afterEach(() => {
    for (const stage of getCanvasStages(gpu.parent)) stage.destroy();
    expect(getBitmapCacheSnapshot().entries).toBe(0);
    document.body.replaceChildren();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("closes the previous bitmap after its replacement frame, and the last bitmap after disposal", async () => {
    const previous = testBitmap();
    const next = testBitmap();
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn().mockResolvedValueOnce(previous).mockResolvedValueOnce(next),
    );
    const stage = gpu.createStage();
    const firstLease = acquireBitmap("previous");
    await Promise.resolve();
    images[0].load();
    stage.preloadTexture("previous", await firstLease.ready);
    const remove = stage.registerSprite(gpu.sprite("previous", "previous"));
    stage.commit(1, true);
    firstLease.release();
    remove();
    stage.resetForTrial();
    expect(previous.close).not.toHaveBeenCalled();
    const nextLease = acquireBitmap("next");
    await Promise.resolve();
    images[1].load();
    stage.preloadTexture("next", await nextLease.ready);
    stage.registerSprite(gpu.sprite("next", "next"));
    expect(previous.close).not.toHaveBeenCalled();
    stage.commit(2, true);
    expect(previous.close).toHaveBeenCalledTimes(1);
    nextLease.release();
    expect(next.close).not.toHaveBeenCalled();
    stage.destroy();
    expect(next.close).toHaveBeenCalledTimes(1);
    expect(gpu.live.size).toBe(0);
  });

  it("cancels an obsolete preload window and closes its pending conversion", async () => {
    let finish!: (bitmap: ImageBitmap) => void;
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn(
        () =>
          new Promise<ImageBitmap>((resolve) => {
            finish = resolve;
          }),
      ),
    );
    const controller = new AbortController();
    const release = retainBitmapAssets(["obsolete"]);
    const ready = preloadImages(["obsolete"], 10000, controller.signal);
    const rejected = expect(ready).rejects.toMatchObject({
      name: "AbortError",
    });
    await Promise.resolve();
    images[0].load();
    release();
    controller.abort();
    await rejected;
    const late = testBitmap();
    finish(late);
    await Promise.resolve();
    expect(late.close).toHaveBeenCalledTimes(1);
    expect(getBitmapCacheSnapshot().entries).toBe(0);
  });

  it("cannot reanimate a destroyed image component when bitmap conversion finishes late", async () => {
    let finish!: (bitmap: ImageBitmap) => void;
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn(
        () =>
          new Promise<ImageBitmap>((resolve) => {
            finish = resolve;
          }),
      ),
    );
    const component = new ImageComponent({});
    component.render(gpu.parent, {
      name: "late",
      stimulus: "late",
      width: 10,
      __layoutContext: {
        getViewport: () => ({ width: 320, height: 240, dpr: 1 }),
      },
      __timing: { registerStimulus: () => null, onStart: () => {} },
    });
    await Promise.resolve();
    images[0].load();
    component.destroy();
    const late = testBitmap();
    finish(late);
    await vi.waitFor(() => expect(late.close).toHaveBeenCalledTimes(1));
    expect(gpu.gl.createTexture).toHaveBeenCalledTimes(1);
    expect(gpu.parent.querySelector(".dynamic-image-component")).toBeNull();
    expect(getBitmapCacheSnapshot().entries).toBe(0);
  });
});
