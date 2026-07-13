import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ExperimentBaseHarness,
  generateAllCodesMock,
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

  it("assembles preload, fullscreen, generated codes, last trial and jsPsych.run", async () => {
    const getTrial = vi.fn();
    const getLoopTimeline = vi.fn();
    const getLoop = vi.fn();
    const { generatedBaseCode } = ExperimentBaseHarness({
      experimentID: "experiment-1",
      uploadedFiles: [
        { name: "a.png", url: "https://cdn.test/a.png", type: "image" },
        { name: "missing-url.png", type: "image" },
      ],
      getTrial,
      getLoopTimeline,
      getLoop,
      canvasStyles: {
        width: 1024,
        height: 768,
        backgroundColor: "#fff",
        fullScreen: true,
        progressBar: false,
      },
    });

    const code = normalize(await generatedBaseCode());

    expect(generateAllCodesMock).toHaveBeenCalledWith(
      "experiment-1",
      [
        { name: "a.png", url: "https://cdn.test/a.png", type: "image" },
        { name: "missing-url.png", type: "image" },
      ],
      getTrial,
      getLoopTimeline,
      getLoop,
    );
    expect(code).toContain("const timeline = [];");
    expect(code).toContain("type: jsPsychPreload");
    expect(code).toContain('files: ["https://cdn.test/a.png"]');
    expect(code).toContain("type: jsPsychFullscreen");
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
      canvasStyles: {
        width: 1024,
        height: 768,
        backgroundColor: "#fff",
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
      uploadedFiles: [],
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
    expect(code).toContain("jsPsych.run(timeline);");
  });
});
