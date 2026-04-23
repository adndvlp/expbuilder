import {
  getPluginScripts,
  getPluginScriptsFromTrials,
  buildHtmlTags,
} from "../../utils/plugin-scripts.js";

describe("getPluginScripts", () => {
  test("returns empty arrays for empty input", () => {
    const { scriptUrls, styleUrls } = getPluginScripts([]);
    expect(scriptUrls).toEqual([]);
    expect(styleUrls).toEqual([]);
  });

  test("deduplicates plugins", () => {
    const { scriptUrls } = getPluginScripts([
      "plugin-html-keyboard-response",
      "plugin-html-keyboard-response",
    ]);
    expect(scriptUrls).toHaveLength(1);
  });

  test("uses pinned version for known plugin", () => {
    const { scriptUrls } = getPluginScripts(["plugin-survey"]);
    expect(scriptUrls[0]).toBe("https://unpkg.com/@jspsych/plugin-survey@4.0.0");
  });

  test("uses default version for unknown plugin", () => {
    const { scriptUrls } = getPluginScripts(["plugin-novel-thing"]);
    expect(scriptUrls[0]).toBe(
      "https://unpkg.com/@jspsych/plugin-novel-thing@2.1.0",
    );
  });

  test("injects webgazer.js before any webgazer-dependent plugin", () => {
    const { scriptUrls } = getPluginScripts([
      "plugin-html-keyboard-response",
      "plugin-webgazer-calibrate",
    ]);
    expect(scriptUrls[0]).toMatch(/webgazer\.js$/);
    expect(scriptUrls[scriptUrls.length - 1]).toMatch(/plugin-webgazer-calibrate/);
  });

  test("adds survey CSS for plugin-survey", () => {
    const { styleUrls } = getPluginScripts(["plugin-survey"]);
    expect(styleUrls[0]).toMatch(/plugin-survey@4\.0\.0\/css\/survey\.css$/);
  });

  test("adds survey CSS for plugin-dynamic but skips its JS", () => {
    const { scriptUrls, styleUrls } = getPluginScripts(["plugin-dynamic"]);
    expect(scriptUrls).toEqual([]);
    expect(styleUrls).toHaveLength(1);
  });

  test("drops falsy entries (null/undefined/empty)", () => {
    const { scriptUrls } = getPluginScripts([
      null,
      undefined,
      "",
      "plugin-cloze",
    ]);
    expect(scriptUrls).toEqual([
      "https://unpkg.com/@jspsych/plugin-cloze@2.2.0",
    ]);
  });
});

describe("getPluginScriptsFromTrials", () => {
  test("extracts plugin names from trials", () => {
    const trials = [
      { plugin: "plugin-html-keyboard-response" },
      { plugin: "plugin-cloze" },
      {},
    ];
    const { scriptUrls } = getPluginScriptsFromTrials(trials);
    expect(scriptUrls).toHaveLength(2);
  });

  test("tolerates null/undefined input", () => {
    expect(() => getPluginScriptsFromTrials(null)).not.toThrow();
    expect(() => getPluginScriptsFromTrials(undefined)).not.toThrow();
    const { scriptUrls } = getPluginScriptsFromTrials(null);
    expect(scriptUrls).toEqual([]);
  });
});

describe("buildHtmlTags", () => {
  test("renders script and link tags", () => {
    const { scriptTags, styleTags } = buildHtmlTags(
      ["https://a/x.js"],
      ["https://a/x.css"],
    );
    expect(scriptTags).toBe('<script src="https://a/x.js"></script>');
    expect(styleTags).toBe('<link rel="stylesheet" href="https://a/x.css" />');
  });

  test("joins multiple entries with newlines", () => {
    const { scriptTags } = buildHtmlTags(
      ["https://a/x.js", "https://a/y.js"],
      [],
    );
    expect(scriptTags.split("\n")).toHaveLength(2);
  });

  test("returns empty strings when no urls", () => {
    expect(buildHtmlTags([], [])).toEqual({ scriptTags: "", styleTags: "" });
  });
});
