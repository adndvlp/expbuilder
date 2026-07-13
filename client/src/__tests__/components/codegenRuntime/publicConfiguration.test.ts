import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  generateAllCodesMock,
  mocks,
  normalize,
  PublicConfigurationHarness,
} from "./testHarness";

describe("PublicConfigurationHarness", () => {
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

  function createPublicConfigurationHarness(experimentID?: string) {
    return PublicConfigurationHarness({
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
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    mocks.firestoreGetDoc.mockRejectedValueOnce(new Error("load failed"));
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        json: vi.fn(async () => ({})),
      })),
    );
    const { generateExperiment } = createPublicConfigurationHarness(
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

    const { generateExperiment } =
      createPublicConfigurationHarness("experiment-empty");
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

    const { generateExperiment } =
      createPublicConfigurationHarness("experiment-mturk");
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
    expect(code).toContain('storage: "cloud"');
  });

  it("skips remote config without experiment id and can emit dev-mode base code", async () => {
    mocks.currentUser = null;
    mocks.devMode.isDevMode = true;
    mocks.devMode.code =
      "timeline.push({ type: jsPsychHtmlKeyboardResponse });";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("should not fetch session config");
      }),
    );

    const { generateExperiment } = createPublicConfigurationHarness(undefined);
    const code = normalize(await generateExperiment());

    expect(mocks.firestoreDoc).not.toHaveBeenCalled();
    expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(generateAllCodesMock).not.toHaveBeenCalled();
    expect(code).toContain(
      "timeline.push({ type: jsPsychHtmlKeyboardResponse });",
    );
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

    const { generateExperiment } =
      createPublicConfigurationHarness("missing-doc");
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

    const { generateExperiment } =
      createPublicConfigurationHarness("empty-doc");
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

    const { generateExperiment } = PublicConfigurationHarness({
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
