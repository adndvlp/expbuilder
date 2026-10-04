import { describe, expect, it, vi } from "vitest";
import {
  collectDynamicAssets,
  collectUpcomingDynamicAssets,
} from "../../../../server/dynamicplugin/utils/mediaAssets";

const type = { info: { name: "plugin-dynamic" } };
const image = (url: unknown) => ({ type: "ImageComponent", stimulus: url });
const trial = (url: unknown, extra = {}) => ({
  type,
  components: [image(url)],
  ...extra,
});
function upcoming(root: unknown[], current: unknown, count = 3) {
  return collectUpcomingDynamicAssets(
    {
      getTimeline: () => root,
      getCurrentTrial: () => current,
      getProgress: () => ({ current_trial_global: 999 }),
    },
    count,
  );
}

describe("Resolved media and conservative anticipation", () => {
  it("discovers canvas, HTML, response and declared media without the unused library", () => {
    const assets = collectDynamicAssets(
      {
        components: [
          image("signed.png?token=x&y=2"),
          { type: "AudioComponent", stimulus: "sound" },
          { type: "VideoComponent", stimulus: ["clip"] },
          {
            type: "HtmlComponent",
            stimulus:
              '<img src="external.png?x=1&amp;y=2"><video poster="poster"><source src="html-video"></video><audio src="html-audio"></audio>',
          },
          { type: "SketchpadComponent", background_image: "sketch" },
        ],
        response_components: [
          {
            type: "ButtonResponseComponent",
            choices: ["button.webp?token=x", "text"],
          },
        ],
      },
      [
        { url: "unused.png", type: "img" },
        { url: "signed.png?token=x&y=2", type: "img" },
      ],
    );
    expect(assets.images).toEqual(["signed.png?token=x&y=2"]);
    expect(assets.htmlImages).toEqual([
      "sketch",
      "button.webp?token=x",
      "external.png?x=1&y=2",
      "poster",
    ]);
    expect(assets.audio).toEqual(["sound", "html-audio"]);
    expect(assets.video).toEqual(["clip", "html-video"]);
  });

  it("uses the active description in its scope instead of the global execution index", () => {
    const current = trial("current");
    const next = trial("next");
    expect(
      upcoming(
        [{ timeline: [current, next], repetitions: 20 }, trial("outside")],
        current,
      ).images,
    ).toEqual(["next"]);
    expect(
      upcoming([{ timeline: [current], repetitions: 20 }, next], current)
        .images,
    ).toEqual([]);
  });

  it.each([
    { on_finish: () => {}, data: { branches: ["target"] } },
    { __expbuilderMedia: { sequential: false } },
  ])("does not speculate beyond a navigation decision", (extra) => {
    const current = trial("current", extra);
    expect(upcoming([current, trial("sequential")], current).images).toEqual(
      [],
    );
  });

  it("stops at CSV values, callbacks and conditional scopes without evaluating them", () => {
    const current = trial("current");
    const callback = vi.fn();
    for (const target of [
      trial(callback),
      trial("next", { on_start: callback }),
      { timeline: [trial("nested")], conditional_function: callback },
      { type, components: { name: "CSV-components" } },
    ]) {
      expect(
        upcoming([current, target, trial("later")], current).images,
      ).toEqual([]);
    }
    expect(callback).not.toHaveBeenCalled();
  });

  it("caps speculative resources independently of component density", () => {
    const current = trial("current");
    const dense = {
      type,
      components: [image("a"), image("b"), image("c"), image("d")],
    };
    expect(upcoming([current, dense], current).images).toEqual([]);
    expect(
      upcoming(
        [current, trial("a"), trial("b"), trial("c"), trial("d")],
        current,
      ).images,
    ).toEqual(["a", "b", "c"]);
  });
});
