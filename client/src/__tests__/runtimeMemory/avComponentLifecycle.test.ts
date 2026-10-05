import { afterEach, expect, it, vi } from "vitest";
import AudioComponent from "../../../../server/dynamicplugin/components/AudioComponent";
import VideoComponent from "../../../../server/dynamicplugin/components/VideoComponent";

afterEach(() => vi.restoreAllMocks());

it("retires an audio component awaiting a cancelled lazy load without playing or rejecting afterward", async () => {
  let reject!: (error: Error) => void;
  const component = new AudioComponent({
    pluginAPI: {
      audioContext: () => null,
      getAudioPlayer: () =>
        new Promise((_resolve, fail) => {
          reject = fail;
        }),
    },
  });
  const rendered = component.render(document.createElement("div"), {
    stimulus: "slow",
    autoplay: true,
  });
  component.destroy();
  reject(new DOMException("Audio retired", "AbortError"));
  await expect(rendered).resolves.toBeNull();
  expect(component.getAudio()).toBeNull();
});

it("preserves signed fallback URLs and removes video sources and late autoplay callbacks", async () => {
  let reject!: (error: Error) => void;
  const play = vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(
    () =>
      new Promise((_resolve, fail) => {
        reject = fail;
      }),
  );
  const pause = vi
    .spyOn(HTMLMediaElement.prototype, "pause")
    .mockImplementation(() => {});
  const load = vi
    .spyOn(HTMLMediaElement.prototype, "load")
    .mockImplementation(() => {});
  const component = new VideoComponent({
    pluginAPI: { getVideoBuffer: () => undefined },
  });
  const url = "https://cdn.test/clip.webm?signature=one&token=two";
  const video = component.render(document.createElement("div"), {
    stimulus: [url],
    autoplay: true,
  });
  expect(video.querySelector("source")!.src).toBe(url);
  expect(video.querySelector("source")!.type).toBe("video/webm");
  video.dispatchEvent(new Event("loadeddata"));
  component.destroy();
  component.destroy();
  reject(new DOMException("Playback interrupted", "AbortError"));
  await Promise.resolve();
  video.dispatchEvent(new Event("loadeddata"));
  expect(play).toHaveBeenCalledOnce();
  expect(pause).toHaveBeenCalledOnce();
  expect(load).toHaveBeenCalledOnce();
  expect(video.querySelector("source")!.hasAttribute("src")).toBe(false);
  expect(component.getVideoElement()).toBeNull();
});
