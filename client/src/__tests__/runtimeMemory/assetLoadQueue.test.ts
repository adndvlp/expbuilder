import { describe, expect, it } from "vitest";
import { AssetLoadQueue } from "../../../../server/dynamicplugin/utils/AssetLoadQueue";

function pending() {
  let resolve!: () => void;
  const ready = new Promise<void>((done) => {
    resolve = done;
  });
  return { ready, resolve };
}

describe("Shared asset load queue", () => {
  it("bounds concurrency and gives the current trial priority over speculation", async () => {
    const queue = new AssetLoadQueue(2);
    const first = pending();
    const second = pending();
    const order: string[] = [];
    const a = queue.run("a", () => {
      order.push("a");
      return first.ready;
    });
    const b = queue.run("b", () => {
      order.push("b");
      return second.ready;
    });
    const future = queue.run(
      "future",
      async () => {
        order.push("future");
      },
      undefined,
      1,
    );
    const current = queue.run("current", async () => {
      order.push("current");
    });
    expect(order).toEqual(["a", "b"]);
    first.resolve();
    await a;
    await current;
    expect(order.slice(0, 3)).toEqual(["a", "b", "current"]);
    second.resolve();
    await Promise.all([b, future]);
  });

  it("cancels obsolete queued work and still drains after failures", async () => {
    const queue = new AssetLoadQueue(1);
    const busy = pending();
    const a = queue.run("busy", () => busy.ready);
    const controller = new AbortController();
    let obsoleteStarted = false;
    const obsolete = queue.run(
      "obsolete",
      async () => {
        obsoleteStarted = true;
      },
      controller.signal,
    );
    const rejection = expect(obsolete).rejects.toMatchObject({
      name: "AbortError",
    });
    controller.abort();
    await rejection;
    const failed = queue.run("failed", () => {
      throw new Error("broken");
    });
    const failure = expect(failed).rejects.toThrow("broken");
    const next = queue.run("next", async () => "ready");
    busy.resolve();
    await Promise.all([a, failure]);
    expect(await next).toBe("ready");
    expect(obsoleteStarted).toBe(false);
  });

  it("promotes a shared queued resource needed by the current trial", async () => {
    const queue = new AssetLoadQueue(1);
    const busy = pending();
    const a = queue.run("busy", () => busy.ready);
    const order: string[] = [];
    const first = queue.run(
      "first",
      async () => {
        order.push("first");
      },
      undefined,
      1,
    );
    const shared = queue.run(
      "shared",
      async () => {
        order.push("shared");
      },
      undefined,
      1,
    );
    queue.promote("shared");
    busy.resolve();
    await Promise.all([a, first, shared]);
    expect(order).toEqual(["shared", "first"]);
  });
});
