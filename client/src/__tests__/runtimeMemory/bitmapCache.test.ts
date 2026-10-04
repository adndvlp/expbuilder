import { describe, expect, it, vi } from "vitest";
import {
  BitmapCache,
  type CanvasBitmapSource,
} from "../../../../server/dynamicplugin/utils/BitmapCache";

const bitmap = () =>
  ({ width: 2, height: 2, close: vi.fn() }) as unknown as ImageBitmap;
function deferred() {
  let resolve!: (source: CanvasBitmapSource) => void;
  const promise = new Promise<CanvasBitmapSource>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe("Bitmap ownership and eviction", () => {
  it("loads a shared source once and closes it after its last user releases", async () => {
    const source = bitmap();
    const load = vi.fn(async () => source);
    const cache = new BitmapCache(load);
    const first = cache.acquire("/asset.png?version=1");
    const second = cache.acquire("/asset.png?version=1");
    await Promise.all([first.ready, second.ready]);
    const releaseStage = cache.retainSource(source);
    first.release();
    second.release();
    expect(source.close).not.toHaveBeenCalled();
    expect(cache.snapshot()).toMatchObject({ entries: 1, users: 1 });
    releaseStage();
    releaseStage();
    first.release();
    expect(source.close).toHaveBeenCalledTimes(1);
    expect(cache.snapshot()).toMatchObject({
      entries: 0,
      pending: 0,
      estimatedBytes: 0,
    });
    expect(load).toHaveBeenCalledTimes(1);
    expect(first.source).toBeNull();
  });

  it("keeps the full URL as the cache key", async () => {
    const load = vi.fn(async () => bitmap());
    const cache = new BitmapCache(load);
    const leases = [
      cache.acquire("/image?version=1"),
      cache.acquire("/image?version=2"),
    ];
    await Promise.all(leases.map((lease) => lease.ready));
    expect(load).toHaveBeenCalledTimes(2);
    for (const lease of leases) lease.release();
  });

  it("reuses a source throughout a protected prefetch window", async () => {
    const source = bitmap();
    const load = vi.fn(async () => source);
    const cache = new BitmapCache(load);
    const window = cache.acquire("same");
    await window.ready;
    for (let index = 0; index < 30; index++) {
      const trial = cache.acquire("same");
      expect(await trial.ready).toBe(source);
      trial.release();
    }
    expect(load).toHaveBeenCalledTimes(1);
    expect(source.close).not.toHaveBeenCalled();
    window.release();
    expect(source.close).toHaveBeenCalledTimes(1);
  });

  it("releases distinct trial sources while protecting the previous frame", async () => {
    const cache = new BitmapCache(async () => bitmap());
    let releasePrevious = () => {};
    for (let index = 0; index < 30; index++) {
      const trial = cache.acquire(`image-${index}`);
      const source = (await trial.ready) as ImageBitmap;
      const releaseStage = cache.retainSource(source);
      trial.release();
      expect(cache.snapshot().entries).toBeLessThanOrEqual(2);
      expect(source.close).not.toHaveBeenCalled();
      releasePrevious();
      expect(cache.snapshot().entries).toBe(1);
      releasePrevious = releaseStage;
    }
    releasePrevious();
    expect(cache.snapshot().entries).toBe(0);
  });

  it("evicts idle sources in LRU order within a byte capacity", async () => {
    const cache = new BitmapCache(async () => bitmap(), 32);
    const a = cache.acquire("a");
    const b = cache.acquire("b");
    const aSource = (await a.ready) as ImageBitmap;
    const bSource = (await b.ready) as ImageBitmap;
    a.release();
    b.release();
    const recentlyUsed = cache.acquire("a");
    recentlyUsed.release();
    const c = cache.acquire("c");
    await c.ready;
    c.release();
    expect(bSource.close).toHaveBeenCalledTimes(1);
    expect(aSource.close).not.toHaveBeenCalled();
    expect(cache.snapshot()).toMatchObject({ entries: 2, idleBytes: 32 });
  });

  it("never evicts an active source that exceeds the idle capacity", async () => {
    const source = bitmap();
    const cache = new BitmapCache(async () => source, 1);
    const active = cache.acquire("large");
    await active.ready;
    expect(cache.snapshot()).toMatchObject({
      estimatedBytes: 16,
      idleBytes: 0,
    });
    expect(source.close).not.toHaveBeenCalled();
    active.release();
    expect(source.close).toHaveBeenCalledTimes(1);
  });

  it("invalidates a cancelled generation without repopulating a replacement", async () => {
    const old = deferred();
    const replacement = bitmap();
    const load = vi
      .fn<() => Promise<CanvasBitmapSource>>()
      .mockReturnValueOnce(old.promise)
      .mockResolvedValueOnce(replacement);
    const cache = new BitmapCache(load);
    const retired = cache.acquire("image");
    await Promise.resolve();
    retired.release();
    const current = cache.acquire("image");
    expect(await current.ready).toBe(replacement);
    const late = bitmap();
    old.resolve(late);
    await expect(retired.ready).rejects.toMatchObject({ name: "AbortError" });
    expect(late.close).toHaveBeenCalledTimes(1);
    expect(current.source).toBe(replacement);
    expect(replacement.close).not.toHaveBeenCalled();
    current.release();
    expect(cache.snapshot().entries).toBe(0);
  });

  it("retries failed loads and later requests for an evicted source", async () => {
    const load = vi
      .fn<() => Promise<CanvasBitmapSource>>()
      .mockRejectedValueOnce(new Error("failed"))
      .mockImplementation(async () => bitmap());
    const cache = new BitmapCache(load);
    const failed = cache.acquire("image");
    await expect(failed.ready).rejects.toThrow("failed");
    expect(cache.snapshot().entries).toBe(0);
    const retry = cache.acquire("image");
    const source = await retry.ready;
    failed.release();
    expect(retry.source).toBe(source);
    retry.release();
    const revisit = cache.acquire("image");
    expect(await revisit.ready).not.toBe(source);
    expect(load).toHaveBeenCalledTimes(3);
    revisit.release();
  });

  it("does not close sources owned by another subsystem", () => {
    const external = bitmap();
    const cache = new BitmapCache(async () => bitmap());
    cache.retainSource(external)();
    expect(external.close).not.toHaveBeenCalled();
  });

  it("releases the fallback image source", async () => {
    const source = document.createElement("img");
    source.src = "/fallback.png";
    const cache = new BitmapCache(async () => source);
    const lease = cache.acquire("fallback");
    await lease.ready;
    lease.release();
    expect(source.hasAttribute("src")).toBe(false);
    expect(cache.snapshot().entries).toBe(0);
  });
});
