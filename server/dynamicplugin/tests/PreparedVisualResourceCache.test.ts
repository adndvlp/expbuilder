import { describe, expect, it, vi } from "vitest";
import { PreparedVisualResourceCache } from "../utils/PreparedVisualResourceCache";

describe("PreparedVisualResourceCache", () => {
  it("keeps 10,000 unique Image/Text identities bounded by entries and bytes", () => {
    const dispose = vi.fn();
    const cache = new PreparedVisualResourceCache<{ kind: "image" | "text" }>(
      { maxEntries: 16, maxEstimatedBytes: 1_024 },
      dispose,
    );

    for (let index = 0; index < 10_000; index += 1) {
      cache.set(
        `${index % 2 === 0 ? "image" : "text"}:${index}`,
        { kind: index % 2 === 0 ? "image" : "text" },
        128,
      );
    }

    expect(cache.getDiagnostics()).toMatchObject({
      entries: 8,
      estimatedBytes: 1_024,
      evictions: 9_992,
      pinnedEntries: 0,
    });
    expect(dispose).toHaveBeenCalledTimes(9_992);
  });

  it("never evicts active, armed-successor or lookahead pins", () => {
    const cache = new PreparedVisualResourceCache<string>({
      maxEntries: 2,
      maxEstimatedBytes: 200,
    });
    cache.set("active", "active", 100);
    cache.set("armed", "armed", 100);
    const releaseActive = cache.pin("active")!;
    const releaseArmed = cache.pin("armed")!;

    cache.set("lookahead", "lookahead", 100);
    const releaseLookahead = cache.pin("lookahead")!;

    expect(cache.peek("active")).toBe("active");
    expect(cache.peek("armed")).toBe("armed");
    expect(cache.peek("lookahead")).toBe("lookahead");
    expect(cache.getDiagnostics().pinnedEntries).toBe(3);

    releaseActive();
    expect(cache.peek("active")).toBeUndefined();
    expect(cache.peek("armed")).toBe("armed");
    expect(cache.peek("lookahead")).toBe("lookahead");

    releaseArmed();
    releaseLookahead();
  });

  it("evicts only after the final reference pin is released", () => {
    const cache = new PreparedVisualResourceCache<string>({
      maxEntries: 1,
      maxEstimatedBytes: 100,
    });
    cache.set("A", "A", 100);
    const releaseFirst = cache.pin("A")!;
    const releaseSecond = cache.pin("A")!;
    cache.set("B", "B", 100);

    expect(cache.peek("A")).toBe("A");
    expect(cache.peek("B")).toBe("B");
    releaseFirst();
    expect(cache.peek("A")).toBe("A");
    expect(cache.peek("B")).toBeUndefined();
    releaseSecond();
    cache.set("B", "B", 100);
    expect(cache.peek("A")).toBeUndefined();
    expect(cache.peek("B")).toBe("B");
  });
});
