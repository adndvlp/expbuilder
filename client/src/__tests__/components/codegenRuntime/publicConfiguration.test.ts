import { beforeEach, describe, expect, it, vi } from "vitest";
import { defaultFunctionalSettings } from "../../../lib/functionalSettings";
import {
  generateAllCodesMock,
  mocks,
  normalize,
  PublicConfigurationHarness,
} from "./testHarness";

describe("PublicConfiguration with local functional settings", () => {
  let settings = defaultFunctionalSettings();
  beforeEach(() => {
    vi.clearAllMocks();
    settings = defaultFunctionalSettings();
    mocks.currentUser = { uid: "user-1" };
    mocks.devMode = {
      isDevMode: false,
      code: "dev-code;",
      customInitJsPsychParams: { public: {} },
      customPreInitCode: { public: "" },
    };
    generateAllCodesMock.mockResolvedValue([
      "const Trial_A_procedure = {}; timeline.push(Trial_A_procedure);if (window.branchCustomParameters) { Object.entries(window.branchCustomParameters).forEach(() => {}); }",
    ]);
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url) => ({
        ok: true,
        json: async () =>
          String(url).includes("/functional-settings/")
            ? {
                functionalSettings: settings,
                revision: settings.revision,
                settingsMigration: { state: "complete", source: "local" },
              }
            : {
                tokens: [{ id: "counter", type: "counter", counterDigits: 3 }],
                separator: "-",
              },
      })),
    );
  });
  function harness(
    experimentID: string | undefined = "local-design",
    progressBar = false,
  ) {
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
      appearance: { backgroundColor: "#fff", fullScreen: false, progressBar },
    });
  }
  it("generates from explicit local defaults with no Firestore read", async () => {
    const code = normalize(await harness().generateExperiment());
    expect(code).toContain("useIndexedDB: true");
    expect(code).toContain("resumeTimeoutMinutes: 30");
    expect(code).toContain("const Trial_A_procedure = {};");
    expect(mocks.firestoreGetDoc).not.toHaveBeenCalled();
  });
  it.each(["needs_remote_read", "needs_review"])(
    "refuses incomplete %s settings without generating or reading Firestore",
    async (state) => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          functionalSettings: null,
          revision: 0,
          settingsMigration: { state, source: "local" },
        }),
      } as Response);
      await expect(harness().generateExperiment()).rejects.toThrow(
        /Review and save/,
      );
      expect(generateAllCodesMock).not.toHaveBeenCalled();
      expect(mocks.firestoreGetDoc).not.toHaveBeenCalled();
    },
  );
  it("propagates local read failures instead of substituting defaults", async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error("local API unavailable"));
    await expect(harness().generateExperiment()).rejects.toThrow(
      "local API unavailable",
    );
    expect(generateAllCodesMock).not.toHaveBeenCalled();
  });
  it("rejects malformed saved settings", async () => {
    settings.batchConfig.batchSize = -1;
    await expect(harness().generateExperiment()).rejects.toThrow(/Batch size/);
  });
  it("generates MTurk and CAPTCHA using local values and public hooks", async () => {
    settings.batchConfig = {
      useIndexedDB: false,
      batchSize: 7,
      resumeTimeoutMinutes: 45,
    };
    settings.recruitmentConfig.platform = "mturk";
    settings.captchaConfig = {
      enabled: true,
      provider: "recaptcha",
      siteKey: "site-key",
    };
    mocks.devMode.customInitJsPsychParams.public = {
      on_trial_finish: "console.log('trial finish');",
      display_element: "'jspsych-container'",
    };
    mocks.devMode.customPreInitCode.public = "window.beforePublic = true;";
    const code = normalize(await harness().generateExperiment("cloud"));
    for (const fragment of [
      "useIndexedDB: false",
      "size: 7",
      "resumeTimeoutMinutes: 45",
      "Accept the HIT to start the experiment",
      "Submitting to MTurk",
      "window.beforePublic = true;",
      "on_trial_finish: function(data)",
      "display_element: 'jspsych-container'",
      'storage: "cloud"',
    ])
      expect(code).toContain(fragment);
  });
  it("requires an experiment id before reading or generating", async () => {
    const generator = PublicConfigurationHarness({
      experimentID: undefined,
      evaluateCondition: "",
      fetchExtensions: vi.fn(),
      branchingEvaluation: "",
      uploadedFiles: [],
      experimentName: "",
      storage: "local",
      getTrial: vi.fn(),
      getLoopTimeline: vi.fn(),
      getLoop: vi.fn(),
    });
    await expect(generator.generateExperiment()).rejects.toThrow(
      /Select an experiment/,
    );
    expect(fetch).not.toHaveBeenCalled();
  });
  it("uses the supplied validated snapshot even when a newer draft exists", async () => {
    const snapshot = defaultFunctionalSettings();
    snapshot.recruitmentConfig = {
      platform: "prolific",
      prolificCompletionCode: "DONE",
    };
    mocks.devMode.customInitJsPsychParams.public = {
      on_trial_start: "startHook();",
      on_data_update: "updateHook();",
      on_finish: "finishHook();",
    };
    const code = normalize(
      await harness("local", true).generateExperiment("cloud", snapshot),
    );
    for (const fragment of [
      "show_progress_bar: true",
      "startHook();",
      "updateHook();",
      "finishHook();",
      "Redirecting to Prolific",
      "cc=DONE",
    ])
      expect(code).toContain(fragment);
    expect(
      vi
        .mocked(fetch)
        .mock.calls.some(([url]) =>
          String(url).includes("/functional-settings/"),
        ),
    ).toBe(false);
  });
  it("[TG-09] keeps parseable runtime and stable backend session identity", async () => {
    const code = normalize(await harness().generateExperiment());
    expect(code).toContain("_updateSessionName(trialSessionId, _finalName)");
    expect(code).not.toContain("trialSessionId = _finalName");
    expect(code).toContain("throw new Error('Batch upload failed:");
    expect(() => new Function(code)).not.toThrow();
  });
});
