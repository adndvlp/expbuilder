import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadBitmap } from "../../../../server/dynamicplugin/utils/loadBitmap";
import { controlledImages, testBitmap } from "./testHarness/images";

describe("Decoded bitmap preparation", () => {
  let images: ReturnType<typeof controlledImages>;
  beforeEach(() => {
    images = controlledImages();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("uses one decoded image and removes its listeners and source after conversion", async () => {
    const bitmap = testBitmap();
    const convert = vi.fn(async () => bitmap);
    vi.stubGlobal("createImageBitmap", convert);
    const promise = loadBitmap("/image.png", new AbortController().signal, 100);
    images[0].load();
    expect(await promise).toBe(bitmap);
    expect(images).toHaveLength(1);
    expect(convert).toHaveBeenCalledTimes(1);
    expect(images[0].src).toBe("");
    expect(images[0].onload).toBeNull();
    expect(images[0].onerror).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
    expect(bitmap.close).not.toHaveBeenCalled();
  });

  it("preserves a valid fallback image when conversion is unsupported", async () => {
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn(async () => {
        throw new Error("unsupported");
      }),
    );
    const promise = loadBitmap("/image.svg", new AbortController().signal, 100);
    images[0].load();
    expect(await promise).toBe(images[0]);
    expect(images[0].src).toBe("/image.svg");
    expect(images[0].onload).toBeNull();
  });

  it("rejects an image failure instead of caching an invalid source", async () => {
    const promise = loadBitmap(
      "/missing.png",
      new AbortController().signal,
      100,
    );
    const rejected = expect(promise).rejects.toThrow("Image preload failed");
    images[0].fail();
    await rejected;
    expect(images[0].src).toBe("");
    expect(vi.getTimerCount()).toBe(0);
  });

  it("rejects a timeout and prevents a late image callback from converting", async () => {
    const convert = vi.fn(async () => testBitmap());
    vi.stubGlobal("createImageBitmap", convert);
    const promise = loadBitmap("/slow.png", new AbortController().signal, 100);
    const callback = images[0].onload!;
    const rejected = expect(promise).rejects.toThrow("timed out");
    await vi.advanceTimersByTimeAsync(100);
    await rejected;
    callback(new Event("load"));
    expect(convert).not.toHaveBeenCalled();
    expect(images[0].src).toBe("");
  });

  it.each(["abort", "timeout"] as const)(
    "closes a conversion completing after %s",
    async (reason) => {
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
      const promise = loadBitmap("/image.png", controller.signal, 100);
      const rejected = expect(promise).rejects.toThrow(
        reason === "abort" ? "cancelled" : "timed out",
      );
      images[0].load();
      if (reason === "abort") controller.abort();
      else await vi.advanceTimersByTimeAsync(100);
      await rejected;
      const late = testBitmap();
      finish(late);
      await Promise.resolve();
      expect(late.close).toHaveBeenCalledTimes(1);
      expect(images[0].onload).toBeNull();
      expect(vi.getTimerCount()).toBe(0);
    },
  );
});
