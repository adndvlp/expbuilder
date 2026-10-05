import { expect, it, vi } from "vitest";
import { installManagedMediaAPI } from "../../pages/ExperimentBuilder/modules/experiment-runtime/managedMediaAPI";
import { createMediaPreparation } from "../../pages/ExperimentBuilder/modules/experiment-runtime/mediaPreparation";
import { prepareMedia } from "../../../../server/dynamicplugin/utils/mediaResources";

it("protects asynchronous plugin audio through on_finish and releases it after the callback completes", async () => {
  const player = {
    load: async () => {},
    dispose: vi.fn(),
    play: vi.fn(),
    stop: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };
  const factory = vi.fn(() => player);
  const api = {
    getAutoPreloadList: () => ({ images: [], audio: ["sound"], video: [] }),
    preloadAudio: vi.fn(),
    preloadVideo: vi.fn(),
    getAudioPlayer: vi.fn(),
  };
  let finishCallback!: () => void;
  class AsyncAudioPlugin {
    static info = { name: "async-audio", parameters: {} };
    async trial(_display: HTMLElement, _trial: unknown, onLoad: () => void) {
      await api.getAudioPlayer("sound");
      onLoad();
      return { response: 7 };
    }
  }
  const node = {
    type: AsyncAudioPlugin,
    on_finish: async () => {
      expect(await api.getAudioPlayer("sound")).toBe(player);
      await new Promise<void>((resolve) => {
        finishCallback = resolve;
      });
    },
  };
  const runtime = { pluginAPI: api, getCurrentTrial: () => node };
  const manager = installManagedMediaAPI(runtime, factory);
  const coordinator = createMediaPreparation(runtime, [], {
    collect: api.getAutoPreloadList,
    reserveImages: () => ({ ready: Promise.resolve(), release() {} }),
    prepareAV: (assets, timeout, signal) =>
      prepareMedia(runtime, assets, timeout, signal),
  });
  coordinator.install([node]);
  const plugin = new node.type();
  const load = vi.fn();
  expect(await plugin.trial(document.createElement("div"), {}, load)).toEqual({
    response: 7,
  });
  expect(manager.stats().users).toBe(1);
  const callback = node.on_finish();
  await vi.waitFor(() => expect(finishCallback).toBeTypeOf("function"));
  expect(factory).toHaveBeenCalledOnce();
  expect(player.dispose).not.toHaveBeenCalled();
  finishCallback();
  await callback;
  await vi.waitFor(() => expect(player.dispose).toHaveBeenCalledOnce());
  expect(manager.stats().audio).toBe(0);
  coordinator.dispose();
});
