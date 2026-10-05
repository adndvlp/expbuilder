import fs from "node:fs";
import * as cheerio from "cheerio";
import {
  configureLocalWebgazer,
  getWebgazerPluginsFromCode,
} from "../../utils/webgazer-assets.js";

describe("eye tracking asset selection", () => {
  test("ordinary code, comments and stimulus labels do not load models", () => {
    expect(
      getWebgazerPluginsFromCode(`
      // jsPsychExtensionWebgazer
      const stimulus = "webgazer";
      const unusedLabel = "jsPsychWebgazerInitCamera";
      Object.prototype.toString.call(stimulus);
      timeline.push({ type: jsPsychHtmlButtonResponse, stimulus });
    `),
    ).toEqual([]);
  });

  test.each([
    ["webgazer.begin();", "webgazer"],
    ["window['webgazer'].begin();", "webgazer"],
    ["const e = window.jsPsychExtensionWebgazer;", "extension-webgazer"],
    [
      "timeline.push({ type: jsPsychWebgazerInitCamera });",
      "plugin-webgazer-init-camera",
    ],
    [
      "timeline.push({ type: jsPsychWebgazerCalibrate });",
      "plugin-webgazer-calibrate",
    ],
    [
      "timeline.push({ type: jsPsychWebgazerValidate });",
      "plugin-webgazer-validate",
    ],
  ])("retains dependencies referenced by %s", (code, plugin) => {
    expect(getWebgazerPluginsFromCode(code)).toEqual([plugin]);
  });

  test("invalid code conservatively keeps eye tracking dependencies", () => {
    expect(getWebgazerPluginsFromCode("function (")).toContain(
      "extension-webgazer",
    );
  });

  test.each(["experiment_template.html", "trials_preview_template.html"])(
    "%s omits unused Webgazer and loads it before the SDK when needed",
    (name) => {
      const template = fs.readFileSync(
        new URL(`../../templates/${name}`, import.meta.url),
        "utf8",
      );
      const $ = cheerio.load(template);
      expect($('script[src*="webgazer"]')).toHaveLength(0);
      configureLocalWebgazer($, "const x = 'webgazer';");
      expect($('script[src*="webgazer"]')).toHaveLength(0);
      configureLocalWebgazer($, "const x = jsPsychExtensionWebgazer;");
      configureLocalWebgazer($, "const x = jsPsychExtensionWebgazer;");
      const scripts = $("script[src]")
        .map((_, element) => $(element).attr("src"))
        .get();
      expect(scripts[0]).toBe("../jspsych-bundle/webgazer.js");
      expect(scripts[1]).toBe("../jspsych-bundle/index.js");
      expect($('script[src*="webgazer"]')).toHaveLength(1);
      configureLocalWebgazer(
        $,
        "timeline.push({ type: jsPsychHtmlButtonResponse });",
      );
      expect($('script[src*="webgazer"]')).toHaveLength(0);
    },
  );
});
