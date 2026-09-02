import { describe, expect, it } from "vitest";
import { buildPublicExperimentCode } from "../buildPublicExperimentCode";
import type { PublicExperimentCodeOptions } from "../publicCodeTypes";
import { getPublicRuntimeStorageKeys } from "../publicRuntimeStorageKeys";

function options(experimentID: string): PublicExperimentCodeOptions {
  return {
    DATA_API_URL: "/apiData",
    FIREBASE_DATABASE_URL: "https://example.invalid",
    experimentID,
    useStorage: "firebase",
    batchConfig: {
      useIndexedDB: true,
      batchSize: 10,
      resumeTimeoutMinutes: 30,
    },
    recruitmentConfig: {
      platform: "none",
      prolificCompletionCode: "",
    },
    captchaConfig: {
      enabled: true,
      provider: "hcaptcha",
      siteKey: "test-site-key",
    },
    sessionNameTokens: [],
    sessionNameSeparator: "_",
    currentUid: "test-user",
    evaluateCondition: "",
    branchingEvaluation: "",
    customPreInitCode: { local: "", public: "" },
    publicParams: {},
    extensions: "",
    progressBar: false,
    baseCode: "Object.entries(window.branchCustomParameters); jsPsych.run([]);",
  };
}

const OLD_GLOBAL_KEYS = [
  "jsPsych_currentSessionId",
  "jsPsych_participantNumber",
  "jsPsych_captchaPassed",
  "jsPsych_resumeTrial",
  "jsPsych_jumpRequest",
  "jsPsych_jumpReload",
  "jsPsych_jumpToTrial",
  "jsPsych_jumpContext",
  "jsPsychTrialsDB",
];

describe("public session persistence code", () => {
  it("generates disjoint browser state for two published experiments", () => {
    const firstKeys = getPublicRuntimeStorageKeys("experiment-a");
    const secondKeys = getPublicRuntimeStorageKeys("experiment-b");
    const secondValues = new Set(Object.values(secondKeys));

    expect(Object.values(firstKeys)).toHaveLength(9);
    expect(
      Object.values(firstKeys).every((key) =>
        key.startsWith("expbuilder:public:experiment-a:"),
      ),
    ).toBe(true);
    expect(
      Object.values(firstKeys).filter((key) => secondValues.has(key)),
    ).toEqual([]);
  });

  it("wires the scoped keys through session, navigation, captcha and batching", () => {
    const storageKeys = getPublicRuntimeStorageKeys("experiment-a");
    const code = buildPublicExperimentCode(options("experiment-a"));

    expect(code).toContain(
      `const _publicStorageKeys = ${JSON.stringify(storageKeys)}`,
    );
    expect(code).toContain(
      `const JUMP_REQUEST_KEY = ${JSON.stringify(storageKeys.jumpRequest)}`,
    );
    expect(code).toContain(
      `const JUMP_RELOAD_KEY = ${JSON.stringify(storageKeys.jumpReload)}`,
    );
    expect(code).toContain(
      `const RESUME_TRIAL_KEY = ${JSON.stringify(storageKeys.resumeTrial)}`,
    );
    expect(code).toContain(
      `const JUMP_TARGET_KEY = ${JSON.stringify(storageKeys.jumpTarget)}`,
    );
    expect(code).toContain(
      `const JUMP_CONTEXT_KEY = ${JSON.stringify(storageKeys.jumpContext)}`,
    );
    expect(code).toContain(
      `const resumeRaw = localStorage.getItem(${JSON.stringify(storageKeys.resumeTrial)})`,
    );
    expect(code).toContain(
      `dbName: ${JSON.stringify(storageKeys.trialDatabase)}`,
    );
    expect(code).toContain(
      "sessionStorage.getItem(_publicStorageKeys.captchaPassed)",
    );
    expect(code).toContain("_publicStorageKeys.resumeTrial,");
  });

  it("clears only the current experiment namespace after durable completion", () => {
    const code = buildPublicExperimentCode(options("experiment-a"));

    expect(code).toContain("window.ExpBuilderNavigation.clearTransientState()");
    expect(code).toContain(
      "localStorage.removeItem(_publicStorageKeys.sessionId)",
    );
    expect(code).toContain(
      "localStorage.removeItem(_publicStorageKeys.participant)",
    );
    expect(code).toContain(
      "sessionStorage.removeItem(_publicStorageKeys.captchaPassed)",
    );
  });

  it("never consumes or clears the former global public state", () => {
    const code = buildPublicExperimentCode(options("experiment-a"));

    OLD_GLOBAL_KEYS.forEach((key) => expect(code).not.toContain(key));
  });

  it("produces syntactically valid executable JavaScript", () => {
    const code = buildPublicExperimentCode(options("experiment-a"));
    expect(() => new Function(code)).not.toThrow();
  });
});
