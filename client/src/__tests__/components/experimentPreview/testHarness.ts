import { afterEach, beforeEach, vi } from "vitest";

const hoistedMocks = vi.hoisted(() => ({
  generateLocalExperiment: vi.fn(async () => "local-preview-code"),
  incrementVersion: vi.fn(),
  getTrial: vi.fn(),
  getLoopTimeline: vi.fn(),
  getLoop: vi.fn(),
  generateSingleTrialCode: vi.fn(async () => "const singleTrial = {};"),
  generateSingleLoopCode: vi.fn(async () => "const singleLoop = {};"),
  trialUrl: "http://localhost:3000/test-exp-123/preview",
  experimentID: "test-exp-123" as string | undefined,
  version: 1,
  devMode: { isDevMode: true, isSaveMode: false, code: "" },
  trialsContext: {
    selectedTrial: null as any,
    selectedLoop: null as any,
  },
}));

export const previewMocks = hoistedMocks;

vi.mock(
  "../../../pages/ExperimentBuilder/components/Timeline/ExperimentCode/useExperimentCode",
  () => ({
    useExperimentCode: () => ({
      generateLocalExperiment: hoistedMocks.generateLocalExperiment,
    }),
  }),
);

vi.mock("../../../pages/ExperimentBuilder/hooks/useUrl", () => ({
  default: () => ({ trialUrl: hoistedMocks.trialUrl }),
}));

vi.mock("../../../pages/ExperimentBuilder/hooks/useExpetimentState", () => ({
  useExperimentState: () => ({
    version: hoistedMocks.version,
    incrementVersion: hoistedMocks.incrementVersion,
  }),
}));

vi.mock("../../../pages/ExperimentBuilder/hooks/useDevMode", () => ({
  default: () => hoistedMocks.devMode,
}));

vi.mock("../../../pages/ExperimentBuilder/hooks/useExperimentID", () => ({
  useExperimentID: () => hoistedMocks.experimentID,
}));

vi.mock("../../../pages/ExperimentBuilder/hooks/useTrials", () => ({
  default: () => ({
    selectedTrial: hoistedMocks.trialsContext.selectedTrial,
    selectedLoop: hoistedMocks.trialsContext.selectedLoop,
    getTrial: hoistedMocks.getTrial,
    getLoopTimeline: hoistedMocks.getLoopTimeline,
    getLoop: hoistedMocks.getLoop,
  }),
}));

vi.mock(
  "../../../pages/ExperimentBuilder/utils/generateTrialLoopCodes",
  () => ({
    generateSingleTrialCode: hoistedMocks.generateSingleTrialCode,
    generateSingleLoopCode: hoistedMocks.generateSingleLoopCode,
  }),
);

export function requestBodyFromLastPreviewPost() {
  const call = vi
    .mocked(globalThis.fetch)
    .mock.calls.find(([url]) =>
      String(url).includes("/api/trials-preview/test-exp-123"),
    );
  return JSON.parse((call?.[1] as RequestInit).body as string);
}

export function registerExperimentPreviewLifecycle() {
  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({ success: true }),
    })) as unknown as typeof fetch;
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        disconnect() {}
      },
    );
    previewMocks.devMode = { isDevMode: true, isSaveMode: false, code: "" };
    previewMocks.trialsContext.selectedTrial = null;
    previewMocks.trialsContext.selectedLoop = null;
    previewMocks.version = 1;
    previewMocks.experimentID = "test-exp-123";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });
}
