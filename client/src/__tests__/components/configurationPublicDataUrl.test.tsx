import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import PublicConfiguration from "../../pages/ExperimentBuilder/components/Timeline/ExperimentCode/PublicConfiguration";

const mocks = vi.hoisted(() => ({
  devMode: {
    isDevMode: false,
    code: "DEV_MODE_CODE();",
    customCode: "",
    customInitJsPsychParams: {
      local: {} as Record<string, string>,
      public: {
        on_trial_start: "trial.publicStarted = true;",
        on_data_update: "data.publicTag = 'batched';",
        on_finish: "window.publicDone = true;",
        message_progress_bar: "'Loading trial'",
      } as Record<string, string>,
    },
    customPreInitCode: {
      local: "",
      public: "window.beforePublic = true;",
    },
  },
  firestoreData: {
    batchConfig: {
      useIndexedDB: false,
      batchSize: 5,
      resumeTimeoutMinutes: 45,
    },
    recruitmentConfig: {
      platform: "prolific",
      prolificCompletionCode: "COMPLETE123",
    },
    captchaConfig: {
      enabled: true,
      provider: "recaptcha",
      siteKey: "site-key-123",
    },
  } as null | Record<string, any>,
}));

vi.mock(
  "../../pages/ExperimentBuilder/components/Timeline/ExperimentCode/ExperimentBase",
  () => ({
    default: () => ({
      // The base timeline is embedded in the finish fragment, so it must
      // carry the custom-parameters consumer evidence the runtime contract
      // requires (mirrors the shared generator test mock).
      generatedBaseCode: vi.fn(
        async () =>
          "BASE_TIMELINE_CODE();" +
          "if (window.branchCustomParameters) { Object.entries(window.branchCustomParameters).forEach(() => {}); }",
      ),
    }),
  }),
);

vi.mock("../../pages/ExperimentBuilder/hooks/useDevMode", () => ({
  default: () => mocks.devMode,
}));

vi.mock("firebase/firestore", () => ({
  doc: vi.fn(() => ({ id: "exp-1" })),
  getDoc: vi.fn(async () => ({
    exists: () => Boolean(mocks.firestoreData),
    data: () => mocks.firestoreData,
  })),
}));

vi.mock("../../lib/firebase", () => ({
  auth: { currentUser: { uid: "uid-123" } },
  db: { name: "test-db" },
}));

const defaultProps = {
  experimentID: "exp-1",
  evaluateCondition: "function evaluateCondition() { return true; }",
  fetchExtensions: vi.fn(async () => "const extensions = ['webgazer'];"),
  branchingEvaluation: "branchingEvaluation(data);",
  uploadedFiles: [],
  getTrial: vi.fn(),
  getLoopTimeline: vi.fn(),
  getLoop: vi.fn(),
  canvasStyles: {
    width: 1024,
    height: 768,
    backgroundColor: "#ffffff",
    fullScreen: true,
    progressBar: true,
  },
};

describe("public experiment data URL", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("derives the public data URL from a member backend instead of the build env", async () => {
    // A shared-server member has no build env of its own: the published page
    // must point at the ACTIVE backend, otherwise sessions POST to the wrong
    // place (or GitHub Pages itself when the baked value is missing).
    // Simulate a production bundle (import.meta.env.DEV=false): dev-server
    // flows always keep the emulator URL. NOTE: VITE_* values resolve from
    // tracked config (vitest.config `env`), never from machine-local .env
    // files — that is what makes this deterministic on every machine.
    vi.stubEnv("DEV", false);
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({}),
    })) as unknown as typeof fetch;
    (window as any).electron = {
      readFirebaseConfig: vi.fn(async () => ({
        apiKey: "member-key",
        authDomain: "member.firebaseapp.com",
        projectId: "member-proj",
        storageBucket: "member.appspot.com",
        messagingSenderId: "333",
        appId: "1:333:web:ccc",
      })),
    };
    try {
      const { result } = renderHook(() =>
        PublicConfiguration({
          ...defaultProps,
          experimentName: "Public Experiment",
          storage: "firebase",
        }),
      );

      const code = await result.current.generateExperiment();

      expect(code).toContain(
        "window.JSPSYCH_FILE_UPLOAD_ENDPOINT = 'https://us-central1-member-proj.cloudfunctions.net/apiData'.replace('/apiData', '/uploadParticipantFile');",
      );
      // Active backend wins for credentials...
      expect(code).toContain('apiKey: "member-key"');
    } finally {
      delete (window as any).electron;
    }
  });
});
