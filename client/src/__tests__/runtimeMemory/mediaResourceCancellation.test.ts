import { afterEach, describe, expect, it, vi } from "vitest";
import { prepareMedia } from "../../../../server/dynamicplugin/utils/mediaResources";

afterEach(() => vi.useRealTimers());

describe("Obsolete media preparations", () => {
  it("retires queued audio without cancelling the public jsPsych preloads already running", async () => {
    const callbacks: (() => void)[] = [];
    const preloadAudio = vi.fn((_urls: string[], done: () => void) =>
      callbacks.push(done),
    );
    const jsPsych = { pluginAPI: { preloadAudio } };
    const controller = new AbortController();
    const batch = prepareMedia(
      jsPsych,
      { audio: ["one", "two", "obsolete"] },
      10000,
      controller.signal,
      1,
    );
    const rejection = expect(batch).rejects.toMatchObject({
      name: "AbortError",
    });
    expect(preloadAudio).toHaveBeenCalledTimes(2);
    controller.abort();
    await rejection;
    callbacks.forEach((done) => done());
    preloadAudio.mockImplementation((_urls, done) => {
      done();
      return 0;
    });
    await prepareMedia(jsPsych, { audio: ["current"] });
    expect(preloadAudio.mock.calls.map(([urls]) => urls)).toEqual([
      ["one"],
      ["two"],
      ["current"],
    ]);
  });

  it("keeps a queued shared resource required by the current trial", async () => {
    const callbacks: (() => void)[] = [];
    const preloadAudio = vi.fn((_urls: string[], done: () => void) =>
      callbacks.push(done),
    );
    const jsPsych = { pluginAPI: { preloadAudio } };
    const controller = new AbortController();
    const future = prepareMedia(
      jsPsych,
      { audio: ["one", "two", "shared"] },
      10000,
      controller.signal,
      1,
    );
    const current = prepareMedia(jsPsych, { audio: ["shared"] });
    controller.abort();
    callbacks[0]();
    callbacks[1]();
    await vi.waitFor(() => expect(preloadAudio).toHaveBeenCalledTimes(3));
    callbacks[2]();
    await Promise.all([future, current]);
    expect(
      preloadAudio.mock.calls.filter(([urls]) => urls[0] === "shared"),
    ).toHaveLength(1);
  });

  it("does not start a preparation with an already aborted signal", async () => {
    const controller = new AbortController();
    controller.abort();
    const preloadAudio = vi.fn();
    await expect(
      prepareMedia(
        { pluginAPI: { preloadAudio } },
        { audio: ["obsolete"] },
        10000,
        controller.signal,
      ),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(preloadAudio).not.toHaveBeenCalled();
  });

  it("retries a timed-out URL and ignores the previous attempt's late completion", async () => {
    vi.useFakeTimers();
    const callbacks: (() => void)[] = [];
    const preloadAudio = vi.fn((_urls: string[], done: () => void) =>
      callbacks.push(done),
    );
    const jsPsych = { pluginAPI: { preloadAudio } };
    const first = prepareMedia(jsPsych, { audio: ["sound"] }, 10);
    const rejection = expect(first).rejects.toThrow("timed out");
    await vi.advanceTimersByTimeAsync(10);
    await rejection;
    const next = prepareMedia(jsPsych, { audio: ["sound"] }, 10);
    callbacks[0]();
    callbacks[1]();
    await next;
    await prepareMedia(jsPsych, { audio: ["sound"] });
    expect(preloadAudio).toHaveBeenCalledTimes(2);
  });
});
