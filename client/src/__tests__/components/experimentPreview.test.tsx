import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ExperimentPreview from "../../pages/ExperimentBuilder/components/ExperimentPreview";

const mocks = vi.hoisted(() => ({
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
  devMode: {
    isDevMode: true,
    isSaveMode: false,
    code: "",
  },
  trialsContext: {
    selectedTrial: null as any,
    selectedLoop: null as any,
  },
}));

vi.mock(
  "../../pages/ExperimentBuilder/components/Timeline/ExperimentCode/useExperimentCode",
  () => ({
    useExperimentCode: () => ({
      generateLocalExperiment: mocks.generateLocalExperiment,
    }),
  }),
);

vi.mock("../../pages/ExperimentBuilder/hooks/useUrl", () => ({
  default: () => ({ trialUrl: mocks.trialUrl }),
}));

vi.mock("../../pages/ExperimentBuilder/hooks/useExpetimentState", () => ({
  useExperimentState: () => ({
    version: mocks.version,
    incrementVersion: mocks.incrementVersion,
  }),
}));

vi.mock("../../pages/ExperimentBuilder/hooks/useDevMode", () => ({
  default: () => mocks.devMode,
}));

vi.mock("../../pages/ExperimentBuilder/hooks/useExperimentID", () => ({
  useExperimentID: () => mocks.experimentID,
}));

vi.mock("../../pages/ExperimentBuilder/hooks/useTrials", () => ({
  default: () => ({
    selectedTrial: mocks.trialsContext.selectedTrial,
    selectedLoop: mocks.trialsContext.selectedLoop,
    getTrial: mocks.getTrial,
    getLoopTimeline: mocks.getLoopTimeline,
    getLoop: mocks.getLoop,
  }),
}));

vi.mock("../../pages/ExperimentBuilder/utils/generateTrialLoopCodes", () => ({
  generateSingleTrialCode: mocks.generateSingleTrialCode,
  generateSingleLoopCode: mocks.generateSingleLoopCode,
}));

function requestBodyFromLastPreviewPost() {
  const call = vi
    .mocked(globalThis.fetch)
    .mock.calls.find(([url]) =>
      String(url).includes("/api/trials-preview/test-exp-123"),
    );
  return JSON.parse((call?.[1] as RequestInit).body as string);
}

describe("ExperimentPreview", () => {
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
    mocks.devMode = {
      isDevMode: true,
      isSaveMode: false,
      code: "",
    };
    mocks.trialsContext.selectedTrial = null;
    mocks.trialsContext.selectedLoop = null;
    mocks.version = 1;
    mocks.experimentID = "test-exp-123";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("generates and posts full local preview code in dev mode", async () => {
    render(
      <ExperimentPreview
        autoStart
        uploadedFiles={[{ name: "image.png", url: "uploads/img/image.png", type: "img" }]}
        canvasStyles={{
          backgroundColor: "#111111",
          width: 800,
          height: 600,
          fullScreen: false,
        }}
      />,
    );

    await waitFor(() => {
      expect(mocks.generateLocalExperiment).toHaveBeenCalled();
      expect(globalThis.fetch).toHaveBeenCalledWith(
        "http://localhost:3000/api/trials-preview/test-exp-123",
        expect.any(Object),
      );
    });

    const body = requestBodyFromLastPreviewPost();
    expect(body).toEqual({
      generatedCode: "local-preview-code",
      canvasStyles: {
        backgroundColor: "#111111",
        width: 800,
        height: 600,
        fullScreen: false,
      },
    });
    expect(mocks.incrementVersion).toHaveBeenCalled();

    const iframe = screen.getByTitle("Experiment Preview");
    expect(iframe).toHaveAttribute(
      "src",
      "http://localhost:3000/test-exp-123/preview",
    );
    expect(iframe).toHaveStyle({
      width: "800px",
      height: "600px",
      background: "#111111",
    });
  });

  it("wraps a selected trial preview with participant bootstrap code", async () => {
    mocks.devMode = {
      isDevMode: false,
      isSaveMode: true,
      code: "",
    };
    mocks.trialsContext.selectedTrial = {
      id: 3,
      name: "Choice Trial",
      plugin: "plugin-html-button-response",
    };

    render(<ExperimentPreview autoStart />);

    await waitFor(() => {
      expect(mocks.generateSingleTrialCode).toHaveBeenCalledWith(
        mocks.trialsContext.selectedTrial,
        [],
        "test-exp-123",
        mocks.getTrial,
        mocks.getLoopTimeline,
        mocks.getLoop,
      );
    });

    const body = requestBodyFromLastPreviewPost();
    expect(body.generatedCode).toContain('"Choice Trial_result_"');
    expect(body.generatedCode).toContain(
      "window.JSPSYCH_FILE_UPLOAD_ENDPOINT = '/api/participant-files/test-exp-123';",
    );
    expect(body.generatedCode).toContain("const singleTrial = {};");
    expect(body.generatedCode).toContain("jsPsych.run(timeline);");
  });

  it("generates selected loop previews with loop timeline helpers", async () => {
    mocks.devMode = {
      isDevMode: false,
      isSaveMode: false,
      code: "",
    };
    mocks.trialsContext.selectedLoop = {
      id: "loop-1",
      name: "Practice Loop",
    };

    render(
      <ExperimentPreview
        autoStart
        uploadedFiles={[{ name: "tone.mp3", url: "uploads/aud/tone.mp3", type: "aud" }]}
      />,
    );

    await waitFor(() => {
      expect(mocks.generateSingleLoopCode).toHaveBeenCalledWith(
        mocks.trialsContext.selectedLoop,
        "test-exp-123",
        [{ name: "tone.mp3", url: "uploads/aud/tone.mp3", type: "aud" }],
        mocks.getTrial,
        mocks.getLoopTimeline,
        mocks.getLoop,
      );
    });

    const body = requestBodyFromLastPreviewPost();
    expect(body.generatedCode).toContain('"Practice Loop_result_"');
    expect(body.generatedCode).toContain("const singleLoop = {};");
  });

  it("uses an empty experiment id for a selected trial when the route id is absent", async () => {
    mocks.devMode = { isDevMode: false, isSaveMode: false, code: "" };
    mocks.experimentID = undefined;
    mocks.trialsContext.selectedTrial = {
      id: 7,
      name: "Route-less Trial",
      plugin: "plugin-html-keyboard-response",
    };

    render(<ExperimentPreview autoStart />);

    await waitFor(() => {
      expect(mocks.generateSingleTrialCode).toHaveBeenCalledWith(
        mocks.trialsContext.selectedTrial,
        [],
        "",
        mocks.getTrial,
        mocks.getLoopTimeline,
        mocks.getLoop,
      );
    });
  });

  it("uses an empty experiment id for a selected loop when the route id is absent", async () => {
    mocks.devMode = { isDevMode: false, isSaveMode: false, code: "" };
    mocks.experimentID = undefined;
    mocks.trialsContext.selectedLoop = {
      id: "loop-no-route",
      name: "Route-less Loop",
    };

    render(<ExperimentPreview autoStart />);

    await waitFor(() => {
      expect(mocks.generateSingleLoopCode).toHaveBeenCalledWith(
        mocks.trialsContext.selectedLoop,
        "",
        [],
        mocks.getTrial,
        mocks.getLoopTimeline,
        mocks.getLoop,
      );
    });
  });

  it("waits for a rendered iframe wrapper before measuring canvas scale", async () => {
    render(
      <ExperimentPreview
        canvasStyles={{ width: 640, height: 480, backgroundColor: "#ffffff" }}
      />,
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.queryByTitle("Experiment Preview")).not.toBeInTheDocument();
  });

  it("falls back to the full local preview when no trial or loop is selected outside dev mode", async () => {
    mocks.devMode = {
      isDevMode: false,
      isSaveMode: false,
      code: "",
    };

    render(<ExperimentPreview autoStart />);

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mocks.generateSingleTrialCode).not.toHaveBeenCalled();
    expect(mocks.generateSingleLoopCode).not.toHaveBeenCalled();
    expect(mocks.generateLocalExperiment).toHaveBeenCalled();
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "http://localhost:3000/api/trials-preview/test-exp-123",
      expect.any(Object),
    );
  });

  it("skips posting when a selected trial generator returns empty code", async () => {
    mocks.devMode = {
      isDevMode: false,
      isSaveMode: false,
      code: "",
    };
    mocks.trialsContext.selectedTrial = {
      id: 5,
      name: "Empty Trial",
      plugin: "plugin-html-keyboard-response",
    };
    mocks.generateSingleTrialCode.mockResolvedValueOnce("");

    render(<ExperimentPreview autoStart />);

    await waitFor(() => {
      expect(mocks.generateSingleTrialCode).toHaveBeenCalled();
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(globalThis.fetch).not.toHaveBeenCalledWith(
      "http://localhost:3000/api/trials-preview/test-exp-123",
      expect.any(Object),
    );
  });

  it("toggles the preview iframe with Run Demo and Stop Demo", async () => {
    render(<ExperimentPreview />);

    expect(screen.queryByTitle("Experiment Preview")).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("Run Demo"));

    expect(screen.getByTitle("Experiment Preview")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Stop Demo"));

    expect(screen.queryByTitle("Experiment Preview")).not.toBeInTheDocument();
  });
});
