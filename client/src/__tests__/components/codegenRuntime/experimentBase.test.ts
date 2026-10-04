import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ExperimentBaseHarness,
  generateAllCodesMock,
  mocks,
  normalize,
} from "./testHarness";

describe("ExperimentBaseHarness", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    generateAllCodesMock.mockResolvedValue([
      "const Trial_A_procedure = {}; timeline.push(Trial_A_procedure);",
      "const loop_1_procedure = {}; timeline.push(loop_1_procedure);",
    ]);
  });

  it("assembles media preparation, fullscreen, generated codes and jsPsych.run", async () => {
    const getTrial = vi.fn();
    const getLoopTimeline = vi.fn();
    const getLoop = vi.fn();
    const { generatedBaseCode } = ExperimentBaseHarness({
      experimentID: "experiment-1",
      uploadedFiles: [
        { name: "a.png", url: "https://cdn.test/a.png", type: "img" },
        { name: "missing-url.png", type: "img" },
      ],
      getTrial,
      getLoopTimeline,
      getLoop,
      appearance: {        backgroundColor: "#fff",
        fullScreen: true,
        progressBar: false,
      },
    });

    const code = normalize(await generatedBaseCode());

    expect(generateAllCodesMock).toHaveBeenCalledWith(
      "experiment-1",
      [
        { name: "a.png", url: "https://cdn.test/a.png", type: "img" },
        { name: "missing-url.png", type: "img" },
      ],
      getTrial,
      getLoopTimeline,
      getLoop,
      {
        apiBaseUrl: "http://localhost:3000",
        fetchImpl: undefined,
        graph: mocks.experimentGraph,
        throwOnError: true,
      },
    );
    expect(code).toContain("const timeline = [];");
    expect(code).toContain("ExpBuilderMediaPreparation.install(timeline)");
    expect(code).toContain('"url":"https://cdn.test/a.png","type":"img"');
    expect(code).not.toContain("globalPreload");
    expect(code).not.toContain("files:");
    expect(code).toContain("type: jsPsychFullscreen");
    expect(code).toContain(
      "conditional_function: function() { return !document.fullscreenElement; }",
    );
    expect(code).toContain("const Trial_A_procedure = {};");
    expect(code).toContain("const loop_1_procedure = {};");
    expect(code).toContain("jsPsych.run(timeline);");
  });

  it("omits fullscreen when canvas styles disable it", async () => {
    const { generatedBaseCode } = ExperimentBaseHarness({
      experimentID: "",
      uploadedFiles: [],
      getTrial: vi.fn(),
      getLoopTimeline: vi.fn(),
      getLoop: vi.fn(),
      appearance: {        backgroundColor: "#fff",
        fullScreen: false,
        progressBar: false,
      },
    });

    const code = normalize(await generatedBaseCode());

    expect(code).not.toContain("jsPsychFullscreen");
    expect(code).not.toContain("jsPsychPreload");
    expect(code).toContain("jsPsych.run(timeline);");
  });

  it("keeps generating base code when trial generation fails", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    generateAllCodesMock.mockRejectedValueOnce(new Error("codegen failed"));
    const { generatedBaseCode } = ExperimentBaseHarness({
      experimentID: "experiment-1",
      uploadedFiles: [{ url: "aud/alert.mp3", type: "aud" }],
      getTrial: vi.fn(),
      getLoopTimeline: vi.fn(),
      getLoop: vi.fn(),
    });

    const code = normalize(await generatedBaseCode());

    expect(consoleError).toHaveBeenCalledWith(
      "Error generating codes:",
      expect.any(Error),
    );
    expect(code).toContain("const timeline = [];");
    expect(code).toContain('"url":"aud/alert.mp3","type":"aud"');
    expect(code).not.toContain("files:");
    expect(code).toContain("jsPsych.run(timeline);");
  });
});
