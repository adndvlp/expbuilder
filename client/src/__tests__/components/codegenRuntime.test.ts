import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ExperimentBase from "../../pages/ExperimentBuilder/components/Timeline/ExperimentCode/ExperimentBase";
import PublicConfiguration from "../../pages/ExperimentBuilder/components/Timeline/ExperimentCode/PublicConfiguration";
import { resumeCode } from "../../pages/ExperimentBuilder/components/Timeline/ExperimentCode/ResumeCode";

const mocks = vi.hoisted(() => ({
  generateAllCodes: vi.fn(),
  firestoreDoc: vi.fn(),
  firestoreGetDoc: vi.fn(),
  currentUser: { uid: "user-1" } as { uid: string } | null,
  devMode: {
    isDevMode: false,
    code: "dev-code",
    customInitJsPsychParams: { public: {} as Record<string, string> },
    customPreInitCode: { public: "" },
  },
}));

const generateAllCodesMock = mocks.generateAllCodes;

vi.mock("../../pages/ExperimentBuilder/utils/generateTrialLoopCodes", () => ({
  generateAllCodes: generateAllCodesMock,
}));

vi.mock("../../pages/ExperimentBuilder/hooks/useDevMode", () => ({
  default: () => mocks.devMode,
}));

vi.mock("firebase/firestore", () => ({
  doc: mocks.firestoreDoc,
  getDoc: mocks.firestoreGetDoc,
}));

vi.mock("../../lib/firebase", () => {
  const auth = {};
  Object.defineProperty(auth, "currentUser", {
    get: () => mocks.currentUser,
  });
  return { auth, db: {} };
});

function normalize(code: string) {
  return code.replace(/\s+/g, " ").trim();
}

function getResumeResolver() {
  return new Function(`${resumeCode()}; return _resolveResumeBranch;`)() as (
    resumeRaw: string | null,
  ) => string | null;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

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
    expect(code).toContain("jsPsych.run(timeline);");
  });

  it("omits fullscreen when canvas styles disable it", async () => {
    const { generatedBaseCode } = ExperimentBase({
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
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    generateAllCodesMock.mockRejectedValueOnce(new Error("codegen failed"));
    const { generatedBaseCode } = ExperimentBase({
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

describe("PublicConfiguration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.currentUser = { uid: "user-1" };
    mocks.devMode = {
      isDevMode: false,
      code: "dev-code",
      customInitJsPsychParams: { public: {} },
      customPreInitCode: { public: "" },
    };
    mocks.firestoreDoc.mockReturnValue({ id: "doc-ref" });
    mocks.firestoreGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({}),
    });
    generateAllCodesMock.mockResolvedValue([
      "const Trial_A_procedure = {}; timeline.push(Trial_A_procedure);",
    ]);
  });

  function createPublicConfiguration(experimentID?: string) {
    return PublicConfiguration({
      experimentID,
      evaluateCondition: "function evaluateCondition() { return true; }",
      fetchExtensions: vi.fn(async () => ""),
      branchingEvaluation: "",
      uploadedFiles: [],
      experimentName: "Runtime Experiment",
      storage: "local",
      getTrial: vi.fn(),
      getLoopTimeline: vi.fn(),
      getLoop: vi.fn(),
    });
  }

  it("falls back to default public settings when Firestore config loading fails", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.firestoreGetDoc.mockRejectedValueOnce(new Error("load failed"));
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        json: vi.fn(async () => ({})),
      })),
    );
    const { generateExperiment } = createPublicConfiguration(
      "experiment-firestore-error",
    );

    const code = normalize(await generateExperiment());

    expect(consoleError).toHaveBeenCalledWith(
      "Error loading batch config:",
      expect.any(Error),
    );
    expect(code).toContain("jsPsych.run(timeline);");
  });

  it("uses fallback values when remote config sections are empty", async () => {
    mocks.firestoreGetDoc.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({
        batchConfig: {},
        recruitmentConfig: {},
        captchaConfig: {},
      }),
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: vi.fn(async () => ({})),
      })),
    );

    const { generateExperiment } = createPublicConfiguration("experiment-empty");
    const code = normalize(await generateExperiment());

    expect(code).toContain("useIndexedDB: true");
    expect(code).toContain("size: 0");
    expect(code).toContain("resumeTimeoutMinutes: 30");
    expect(code).toContain("_showSuccess();");
    expect(code).toContain("const Trial_A_procedure = {};");
  });

  it("generates mturk, captcha and user-added public params from remote config", async () => {
    mocks.devMode.customInitJsPsychParams.public = {
      on_trial_finish: "console.log('trial finish');",
      display_element: "'jspsych-container'",
    };
    mocks.devMode.customPreInitCode.public = "window.beforePublic = true;";
    mocks.firestoreGetDoc.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({
        batchConfig: {
          useIndexedDB: false,
          batchSize: 7,
          resumeTimeoutMinutes: 45,
        },
        recruitmentConfig: {
          platform: "mturk",
        },
        captchaConfig: {
          enabled: true,
          provider: "recaptcha",
          siteKey: "site-key",
        },
      }),
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: vi.fn(async () => ({
          tokens: [{ id: "participant", type: "uuid" }],
          separator: "-",
        })),
      })),
    );

    const { generateExperiment } = createPublicConfiguration("experiment-mturk");
    const code = normalize(await generateExperiment("cloud"));

    expect(code).toContain("useIndexedDB: false");
    expect(code).toContain("size: 7");
    expect(code).toContain("resumeTimeoutMinutes: 45");
    expect(code).toContain("Accept the HIT to start the experiment");
    expect(code).toContain("Submitting to MTurk");
    expect(code).toContain("jsPsych.data.addProperties");
    expect(code).toContain("window.beforePublic = true;");
    expect(code).toContain("on_trial_finish: function(data)");
    expect(code).toContain("display_element: 'jspsych-container'");
    expect(code).toContain("storage: \"cloud\"");
  });

  it("skips remote config without experiment id and can emit dev-mode base code", async () => {
    mocks.currentUser = null;
    mocks.devMode.isDevMode = true;
    mocks.devMode.code = "timeline.push({ type: jsPsychHtmlKeyboardResponse });";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("should not fetch session config");
      }),
    );

    const { generateExperiment } = createPublicConfiguration(undefined);
    const code = normalize(await generateExperiment());

    expect(mocks.firestoreDoc).not.toHaveBeenCalled();
    expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(generateAllCodesMock).not.toHaveBeenCalled();
    expect(code).toContain("timeline.push({ type: jsPsychHtmlKeyboardResponse });");
    expect(code).toContain('const Uid = "";');
  });

  it("keeps defaults when the Firestore document does not exist", async () => {
    mocks.firestoreGetDoc.mockResolvedValueOnce({
      exists: () => false,
      data: () => {
        throw new Error("data should not be read");
      },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        json: vi.fn(async () => ({})),
      })),
    );

    const { generateExperiment } = createPublicConfiguration("missing-doc");
    const code = normalize(await generateExperiment());

    expect(code).toContain("useIndexedDB: true");
    expect(code).toContain("_showSuccess();");
  });

  it("keeps defaults when the Firestore document has no config sections", async () => {
    mocks.firestoreGetDoc.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({}),
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        json: vi.fn(async () => ({})),
      })),
    );

    const { generateExperiment } = createPublicConfiguration("empty-doc");
    const code = normalize(await generateExperiment());

    expect(code).toContain("useIndexedDB: true");
    expect(code).not.toContain("platform IDs");
    expect(code).toContain("_showSuccess();");
  });

  it("generates prolific, progress bar and builder hook user code", async () => {
    mocks.devMode.customInitJsPsychParams.public = {
      on_trial_start: "startHook();",
      on_data_update: "updateHook();",
      on_finish: "finishHook();",
    };
    mocks.firestoreGetDoc.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({
        recruitmentConfig: {
          platform: "prolific",
          prolificCompletionCode: "DONE",
        },
      }),
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        json: vi.fn(async () => ({})),
      })),
    );

    const { generateExperiment } = PublicConfiguration({
      experimentID: "experiment-prolific",
      evaluateCondition: "function evaluateCondition() { return true; }",
      fetchExtensions: vi.fn(async () => ""),
      branchingEvaluation: "// branch eval",
      uploadedFiles: [],
      experimentName: "Runtime Experiment",
      storage: "local",
      getTrial: vi.fn(),
      getLoopTimeline: vi.fn(),
      getLoop: vi.fn(),
      canvasStyles: {
        width: 1024,
        height: 768,
        backgroundColor: "#fff",
        fullScreen: false,
        progressBar: true,
      },
    });

    const code = normalize(await generateExperiment());

    expect(code).toContain("show_progress_bar: true");
    expect(code).toContain("startHook();");
    expect(code).toContain("updateHook();");
    expect(code).toContain("finishHook();");
    expect(code).toContain("Redirecting to Prolific");
    expect(code).toContain("cc=DONE");
    expect(code).toContain("jsPsych.data.addProperties");
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
