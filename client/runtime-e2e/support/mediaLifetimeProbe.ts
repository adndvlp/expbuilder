import type { Page } from "@playwright/test";

export async function installMediaLifetimeProbe(page: Page, htmlAudio = false) {
  // These scenarios do not use eye tracking; avoid unrelated model downloads.
  await page.route("**/jspsych-bundle/webgazer.js", (route) =>
    route.fulfill({ contentType: "application/javascript", body: "" }),
  );
  await page.addInitScript((html) => {
    let initialize: (options: unknown) => unknown;
    Object.defineProperty(window, "initJsPsych", {
      configurable: true,
      get: () => initialize,
      set: (factory: (options: unknown) => unknown) => {
        initialize = (options) => {
          const instance = factory(options);
          Object.assign(window, { __runtimeMediaInstance: instance });
          return instance;
        };
      },
    });
    if (html) {
      Reflect.deleteProperty(window, "AudioContext");
      Reflect.deleteProperty(window, "webkitAudioContext");
    }
    const inventory = {
      created: [] as string[],
      revoked: [] as string[],
      audioStarts: 0,
    };
    Object.assign(window, { __runtimeMediaInventory: inventory });
    const create = URL.createObjectURL.bind(URL);
    const revoke = URL.revokeObjectURL.bind(URL);
    URL.createObjectURL = (blob) => {
      const url = create(blob);
      if (blob instanceof Blob && blob.type.startsWith("video/"))
        inventory.created.push(url);
      return url;
    };
    URL.revokeObjectURL = (url) => {
      inventory.revoked.push(url);
      revoke(url);
    };
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      if (this.tagName === "AUDIO") inventory.audioStarts++;
      return play.call(this);
    };
    if (!html) {
      const start = AudioBufferSourceNode.prototype.start;
      AudioBufferSourceNode.prototype.start = function (...args) {
        inventory.audioStarts++;
        return start.apply(this, args);
      };
    }
  }, htmlAudio);
}

export const mediaInventory = (page: Page) =>
  page.evaluate(() => {
    const runtime = (
      window as Window & {
        __runtimeMediaInstance: {
          pluginAPI: {
            expBuilderMedia: {
              stats(): {
                audio: number;
                video: number;
                users: number;
                pending: number;
              };
            };
          };
        };
      }
    ).__runtimeMediaInstance;
    const inventory = (
      window as Window & {
        __runtimeMediaInventory: {
          created: string[];
          revoked: string[];
          audioStarts: number;
        };
      }
    ).__runtimeMediaInventory;
    return { ...inventory, ...runtime.pluginAPI.expBuilderMedia.stats() };
  });

export function audioFixture() {
  const rate = 22050;
  const samples = rate / 2;
  const wav = Buffer.alloc(44 + samples * 2);
  wav.write("RIFF", 0);
  wav.writeUInt32LE(wav.length - 8, 4);
  wav.write("WAVEfmt ", 8);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(rate, 24);
  wav.writeUInt32LE(rate * 2, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write("data", 36);
  wav.writeUInt32LE(samples * 2, 40);
  for (let index = 0; index < samples; index++)
    wav.writeInt16LE(
      Math.round(Math.sin((index * Math.PI * 2 * 440) / rate) * 1000),
      44 + index * 2,
    );
  return wav;
}
