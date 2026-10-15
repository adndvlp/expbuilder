import { describe, expect, it } from "vitest";
import { collectTrialResources } from "../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/memory/resourceInventory";
import type { TrialComponent } from "../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/types";

const component = (
  type: TrialComponent["type"],
  config: TrialComponent["config"],
  id = type,
): TrialComponent => ({
  id,
  type,
  config,
  x: 0,
  y: 0,
  width: 100,
  height: 100,
});
const options = {
  experimentID: "E1",
  apiUrl: "http://localhost:3000",
  uploadedFiles: [{ name: "photo.png", url: "img/photo.png", type: "img" }],
};

describe("placed trial resources", () => {
  it("resolves filenames and repeated HTML references to one measured source", () => {
    const inventory = collectTrialResources(
      [
        component("ImageComponent", {
          stimulus: { source: "typed", value: "photo.png" },
        }),
        component("HtmlComponent", {
          stimulus: {
            source: "typed",
            value:
              '<img src="img/photo.png"><div style="background-image:url(img/photo.png)"></div>',
          },
        }),
      ],
      options,
    );
    expect(inventory.resources).toEqual([
      {
        key: "image:http://localhost:3000/E1/img/photo.png",
        url: "http://localhost:3000/E1/img/photo.png",
        kind: "image",
        instances: 3,
      },
    ]);
    expect(inventory.unresolved).toEqual([]);
  });

  it("includes nested HTML audio, video, posters, CSS backgrounds, surveys and canvases", () => {
    const inventory = collectTrialResources(
      [
        component("HtmlComponent", {
          stimulus:
            '<video poster="img/poster.png"><source src="vid/movie.mp4"></video><audio src="aud/sound.wav"></audio><canvas width="640" height="360"></canvas><style>.hero{background:url(img/bg.png)}</style>',
        }),
        component("SurveyComponent", {
          survey_json: {
            source: "typed",
            value: {
              elements: [
                { imageLink: "img/question.png" },
                { html: '<img src="img/answer.png">' },
              ],
            },
          },
        }),
        component("ButtonResponseComponent", {
          button_html: '<button><img src="img/button.png"></button>',
        }),
      ],
      options,
    );
    expect(inventory.resources.map(({ kind }) => kind)).toEqual([
      "video",
      "image",
      "audio",
      "image",
      "image",
      "image",
      "image",
    ]);
    expect(inventory.canvasBytes).toBe(640 * 360 * 4);
  });

  it("leaves CSV, dynamic functions, recording and embedded documents unresolved", () => {
    const inventory = collectTrialResources(
      [
        component("ImageComponent", {
          stimulus: { source: "csv", value: "image_column" },
        }),
        component("VideoComponent", { stimulus: () => "vid/movie.mp4" }),
        component("HtmlComponent", {
          stimulus:
            '<iframe src="https://external.test"></iframe><script>fetch("more.mp4")</script>',
        }),
        component("AudioResponseComponent", {}),
      ],
      options,
    );
    expect(inventory.resources).toEqual([]);
    expect(inventory.unresolved).toHaveLength(4);
  });

  it("does not multiply alternative video sources as concurrent players", () => {
    const inventory = collectTrialResources(
      [
        component("VideoComponent", {
          stimulus: ["vid/movie.mp4", "vid/movie.webm"],
        }),
      ],
      options,
    );
    expect(inventory.resources).toHaveLength(1);
    expect(inventory.unresolved).toEqual([
      "VideoComponent: alternative media sources",
    ]);
  });

  it("removes deleted sources and counts repeated players without duplicating source metadata", () => {
    const first = component(
      "VideoComponent",
      { stimulus: "vid/movie.mp4" },
      "first",
    );
    const second = component(
      "VideoComponent",
      { stimulus: "vid/movie.mp4" },
      "second",
    );
    expect(
      collectTrialResources([first, second], options).resources[0].instances,
    ).toBe(2);
    expect(collectTrialResources([first], options).resources[0].instances).toBe(
      1,
    );
    expect(collectTrialResources([], options).resources).toEqual([]);
  });
});
