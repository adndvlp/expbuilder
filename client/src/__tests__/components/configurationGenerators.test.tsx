import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import LocalConfiguration, {
  resolveApiUrl,
} from "../../pages/ExperimentBuilder/components/Timeline/ExperimentCode/LocalConfiguration";
import PublicConfiguration from "../../pages/ExperimentBuilder/components/Timeline/ExperimentCode/PublicConfiguration";

const mocks = vi.hoisted(() => ({
  devMode: {
    isDevMode: false,
    code: "DEV_MODE_CODE();",
    customCode: "",
    customInitJsPsychParams: {
      local: {} as Record<string, string>,
      public: {} as Record<string, string>,
    },
    customPreInitCode: {
      local: "",
      public: "",
    },
  },
  generatedBaseCode: vi.fn(async () => "BASE_TIMELINE_CODE();"),
  firestoreData: null as null | Record<string, any>,
}));

vi.mock(
  "../../pages/ExperimentBuilder/components/Timeline/ExperimentCode/ExperimentBase",
  () => ({
    default: () => ({
      generatedBaseCode: mocks.generatedBaseCode,
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

function mockSessionNameFetch() {
  globalThis.fetch = vi.fn(async (url: string) => {
    if (url.includes("/api/session-name-config/exp-1")) {
      return {
        ok: true,
        json: async () => ({
          separator: "-",
          tokens: [
            {
              id: "date",
              type: "date",
              dateFormat: "YYYYMMDD",
              timeFormat: "HH-mm",
              randomLength: 6,
              customValue: "",
              counterDigits: 3,
            },
          ],
        }),
      } as Response;
    }

    return {
      ok: true,
      json: async () => ({}),
    } as Response;
  }) as unknown as typeof fetch;
}

describe("experiment configuration generators", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSessionNameFetch();
    mocks.firestoreData = null;
    mocks.devMode = {
      isDevMode: false,
      code: "DEV_MODE_CODE();",
      customCode: "",
      customInitJsPsychParams: {
        local: {},
        public: {},
      },
      customPreInitCode: {
        local: "",
        public: "",
      },
    };
  });

  it("resolves configured and missing local API URLs", () => {
    expect(resolveApiUrl("http://localhost:3000")).toBe(
      "http://localhost:3000",
    );
    expect(resolveApiUrl(undefined)).toBe("");
  });

  it("builds local experiment HTML with session naming, custom lifecycle code and base timeline", async () => {
    mocks.devMode.customCode = "override_safe_mode: true";
    mocks.devMode.customPreInitCode.local = "window.beforeLocal = true;";
    mocks.devMode.customInitJsPsychParams.local = {
      on_trial_start: "trial.localStarted = true;",
      on_data_update: "data.localTag = 'saved';",
      on_finish: "window.localDone = true;",
      default_iti: "250",
    };

    const { result } = renderHook(() => LocalConfiguration(defaultProps));

    const code = await result.current.generateLocalExperiment();

    expect(defaultProps.fetchExtensions).toHaveBeenCalled();
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "http://localhost:3000/api/session-name-config/exp-1",
    );
    expect(code).toContain(
      "window.JSPSYCH_FILE_UPLOAD_ENDPOINT = '/api/participant-files/exp-1';",
    );
    expect(code).toContain('"dateFormat":"YYYYMMDD"');
    expect(code).toContain('const _SESSION_NAME_SEPARATOR = "-"');
    expect(code).toContain("window.beforeLocal = true;");
    expect(code).toContain("show_progress_bar: true,");
    expect(code).toContain("trial.localStarted = true;");
    expect(code).toContain("branchingEvaluation(data);");
    expect(code).toContain("data.localTag = 'saved';");
    expect(code).toContain("window.localDone = true;");
    expect(code).toContain("default_iti: 250");
    expect(code).toContain("override_safe_mode: true");
    expect(code).toContain("BASE_TIMELINE_CODE();");
  });

  it("uses dev-mode code as the local timeline when dev mode is enabled", async () => {
    mocks.devMode.isDevMode = true;
    mocks.devMode.code = "DEV_TIMELINE();";

    const { result } = renderHook(() => LocalConfiguration(defaultProps));

    const code = await result.current.generateLocalExperiment();

    expect(mocks.generatedBaseCode).not.toHaveBeenCalled();
    expect(code).toContain("DEV_TIMELINE();");
  });

  it("omits progress and supports function params when session config is unavailable", async () => {
    mocks.devMode.customInitJsPsychParams.local = {
      on_close: "window.localClosed = true;",
    };
    globalThis.fetch = vi.fn(async () => ({ ok: false }) as Response);

    const { result } = renderHook(() =>
      LocalConfiguration({ ...defaultProps, canvasStyles: undefined }),
    );
    const code = await result.current.generateLocalExperiment();

    expect(code).not.toContain("show_progress_bar: true,");
    expect(code).toContain("on_close: function()");
    expect(code).toContain("window.localClosed = true;");
  });

  it("falls back to empty session tokens and the default separator", async () => {
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({ tokens: null, separator: null }),
    }) as Response);

    const { result } = renderHook(() => LocalConfiguration(defaultProps));
    const code = await result.current.generateLocalExperiment();

    expect(code).toContain("const _SESSION_NAME_TOKENS = [];");
    expect(code).toContain('const _SESSION_NAME_SEPARATOR = "_";');
  });

  it("skips session configuration lookup without an experiment id", async () => {
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy as unknown as typeof fetch;

    const { result } = renderHook(() =>
      LocalConfiguration({ ...defaultProps, experimentID: undefined }),
    );
    const code = await result.current.generateLocalExperiment();

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(code).toContain("const _SESSION_NAME_TOKENS = [];");
  });

  it("builds public experiment HTML with Firestore-backed batch, captcha and recruitment settings", async () => {
    mocks.firestoreData = {
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
    };
    mocks.devMode.customPreInitCode.public = "window.beforePublic = true;";
    mocks.devMode.customInitJsPsychParams.public = {
      on_trial_start: "trial.publicStarted = true;",
      on_data_update: "data.publicTag = 'batched';",
      on_finish: "window.publicDone = true;",
      message_progress_bar: "'Loading trial'",
    };

    const { result } = renderHook(() =>
      PublicConfiguration({
        ...defaultProps,
        experimentName: "Public Experiment",
        storage: "firebase",
      }),
    );

    const code = await result.current.generateExperiment();

    expect(defaultProps.fetchExtensions).toHaveBeenCalled();
    expect(code).toContain(
      "window.JSPSYCH_FILE_UPLOAD_ENDPOINT = 'http://localhost:3000/api/data'.replace('/apiData', '/uploadParticipantFile');",
    );
    expect(code).toContain("await _showCaptchaGate(\"site-key-123\", \"recaptcha\")");
    expect(code).toContain("batchSize: 5");
    expect(code).toContain("resumeTimeoutMinutes: 45");
    expect(code).toContain("useIndexedDB: false");
    expect(code).toContain("window.beforePublic = true;");
    expect(code).toContain("show_progress_bar: true,");
    expect(code).toContain("trial.publicStarted = true;");
    expect(code).toContain("branchingEvaluation(data);");
    expect(code).toContain("data.publicTag = 'batched';");
    expect(code).toContain("window.publicDone = true;");
    expect(code).toContain("message_progress_bar: 'Loading trial'");
    expect(code).toContain(
      "https://app.prolific.com/submissions/complete?cc=COMPLETE123",
    );
    expect(code).toContain("BASE_TIMELINE_CODE();");
  });
});
