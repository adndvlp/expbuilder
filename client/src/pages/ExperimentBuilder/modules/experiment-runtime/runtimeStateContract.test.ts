import { describe, expect, it } from "vitest";
import { buildLocalExperimentCode } from "../../components/Timeline/ExperimentCode/services/buildLocalExperimentCode";
import { buildPublicExperimentCode } from "../../components/Timeline/ExperimentCode/services/buildPublicExperimentCode";
import {
  branchingEvaluationRuntimeCode,
  evaluateConditionRuntimeCode,
} from "../../components/Timeline/ExperimentCode/services/branchingRuntimeCode";
import {
  composeRuntimeCode,
  RuntimeStateContractError,
} from "./runtimeStateContract";

const targetConsumerCode =
  "const targetTrial = {};\n" +
  "Object.entries(window.branchCustomParameters).forEach(() => {});";

const localOptions = {
  experimentID: "contract-experiment",
  sessionNameTokens: [],
  sessionNameSeparator: "_",
  evaluateCondition: evaluateConditionRuntimeCode,
  branchingEvaluation: branchingEvaluationRuntimeCode,
  baseCode: targetConsumerCode,
  customCode: undefined,
  customPreInitCode: { local: "" },
  extensions: "",
  localParams: {},
  progressBar: false,
};

const publicOptions = {
  DATA_API_URL: "/data",
  FIREBASE_DATABASE_URL: "https://example.invalid",
  experimentID: "contract-experiment",
  useStorage: "firebase",
  batchConfig: {
    useIndexedDB: false,
    batchSize: 0,
    resumeTimeoutMinutes: 30,
  },
  recruitmentConfig: {
    platform: "none" as const,
    prolificCompletionCode: "",
  },
  captchaConfig: {
    enabled: false,
    provider: "hcaptcha" as const,
    siteKey: "",
  },
  sessionNameTokens: [],
  sessionNameSeparator: "_",
  currentUid: "test-user",
  evaluateCondition: evaluateConditionRuntimeCode,
  branchingEvaluation: branchingEvaluationRuntimeCode,
  customPreInitCode: { local: "", public: "" },
  publicParams: {},
  extensions: "",
  progressBar: false,
  baseCode: targetConsumerCode,
};

describe("runtime state contract", () => {
  it("[TG-13] validates reachable writers and consumers in local and public artifacts", () => {
    const local = buildLocalExperimentCode(localOptions);
    const publicCode = buildPublicExperimentCode(publicOptions);

    [local, publicCode].forEach((code) => {
      expect(code).toContain("_createResumeCheckpoint(data)");
      expect(code).toContain("_resolveResumeBranch(resumeRaw)");
      expect(code).toContain("clearTransientState()");
      expect(code).toContain("Object.entries(window.branchCustomParameters)");
    });
  });

  it("fails generation when a declared state consumer disappears", () => {
    expect(() =>
      buildLocalExperimentCode({
        ...localOptions,
        baseCode: "const timeline = [];",
      }),
    ).toThrowError(
      /local-runtime declares custom-parameters consumer/,
    );
  });

  it("fails composition when a required access is not reachable", () => {
    expect(() =>
      composeRuntimeCode([
        {
          owner: "incomplete-runtime",
          code: "writeRoute();",
          accesses: [
            {
              state: "route",
              mode: "writer",
              evidence: "writeRoute()",
            },
          ],
        },
      ]),
    ).toThrowError(
      new RuntimeStateContractError("route has no reachable consumer"),
    );
  });
});
