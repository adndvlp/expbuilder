import { beforeEach, describe, expect, it, vi } from "vitest";
import ExperimentBase from "../../pages/ExperimentBuilder/components/Timeline/ExperimentCode/ExperimentBase";
import { resumeCode } from "../../pages/ExperimentBuilder/components/Timeline/ExperimentCode/ResumeCode";

const generateAllCodesMock = vi.fn();

vi.mock("../../pages/ExperimentBuilder/utils/generateTrialLoopCodes", () => ({
  generateAllCodes: generateAllCodesMock,
}));

function normalize(code: string) {
  return code.replace(/\s+/g, " ").trim();
}

function getResumeResolver() {
  return new Function(`${resumeCode()}; return _resolveResumeBranch;`)() as (
    resumeRaw: string | null,
  ) => string | null;
}

describe("ExperimentBase", () => {
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
    const { generatedBaseCode } = ExperimentBase({
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
    expect(code).toContain("const Last_Trial_timeline =");
    expect(code).toContain("jsPsych.run(timeline);");
  });

  it("omits fullscreen when canvas styles disable it", async () => {
    const { generatedBaseCode } = ExperimentBase({
      experimentID: "experiment-1",
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
});

describe("resumeCode", () => {
  it("returns null for missing, corrupt or terminal resume data", () => {
    const resolveResumeBranch = getResumeResolver();

    expect(resolveResumeBranch(null)).toBeNull();
    expect(resolveResumeBranch("not-json")).toBeNull();
    expect(
      resolveResumeBranch(JSON.stringify({ branches: [], trialData: {} })),
    ).toBeNull();
  });

  it("returns the only branch without evaluating conditions", () => {
    const resolveResumeBranch = getResumeResolver();

    expect(
      resolveResumeBranch(
        JSON.stringify({
          branches: [42],
          branchConditions: [],
          trialData: { response: "anything" },
        }),
      ),
    ).toBe("42");
  });

  it("uses matching condition.nextTrialId for multiple branches", () => {
    const resolveResumeBranch = getResumeResolver();

    expect(
      resolveResumeBranch(
        JSON.stringify({
          branches: [2, 3],
          branchConditions: [
            {
              id: 1,
              nextTrialId: 3,
              rules: [{ column: "response", op: "==", value: "yes" }],
            },
          ],
          trialData: { response: "yes" },
        }),
      ),
    ).toBe("3");
  });

  it("supports nested survey response fields and array comparisons", () => {
    const resolveResumeBranch = getResumeResolver();

    expect(
      resolveResumeBranch(
        JSON.stringify({
          branches: [2, 3],
          branchConditions: [
            {
              id: 1,
              nextTrialId: 3,
              rules: [
                {
                  column: "SurveyComponent_1_choice",
                  op: "==",
                  value: "blue",
                },
                {
                  column: "selected_values",
                  op: "==",
                  value: "ready",
                },
              ],
            },
          ],
          trialData: {
            SurveyComponent_1_response: { choice: "blue" },
            selected_values: ["ready", "go"],
          },
        }),
      ),
    ).toBe("3");
  });

  it("falls back to the first branch when no conditions match", () => {
    const resolveResumeBranch = getResumeResolver();

    expect(
      resolveResumeBranch(
        JSON.stringify({
          branches: [2, 3],
          branchConditions: [
            {
              id: 1,
              nextTrialId: 3,
              rules: [{ column: "response", op: "==", value: "yes" }],
            },
          ],
          trialData: { response: "no" },
        }),
      ),
    ).toBe("2");
  });
});
