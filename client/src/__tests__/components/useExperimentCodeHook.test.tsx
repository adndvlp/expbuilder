import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useExperimentCode } from "../../pages/ExperimentBuilder/components/Timeline/ExperimentCode/useExperimentCode";

const mocks = vi.hoisted(() => ({
  trialsContext: {
    getTrial: vi.fn(),
    getLoopTimeline: vi.fn(),
    getLoop: vi.fn(),
  },
  canvasStyles: {
    fullScreen: false,
    progressBar: true,
  },
  localProps: undefined as any,
  publicProps: undefined as any,
  baseProps: undefined as any,
  localGenerator: vi.fn(async () => "local-code"),
  publicGenerator: vi.fn(async () => "public-code"),
  baseGenerator: vi.fn(async () => "base-code"),
  fetchExperimentNameByID: vi.fn(async () => "Named Experiment"),
  experimentID: "exp-123",
}));

vi.mock("../../pages/ExperimentBuilder/hooks/useExperimentID", () => ({
  useExperimentID: () => mocks.experimentID,
  fetchExperimentNameByID: mocks.fetchExperimentNameByID,
}));

vi.mock("../../pages/ExperimentBuilder/hooks/useTrials", () => ({
  default: () => mocks.trialsContext,
}));

vi.mock("../../pages/ExperimentBuilder/hooks/useCanvasStyles", () => ({
  default: () => ({ canvasStyles: mocks.canvasStyles }),
}));

vi.mock(
  "../../pages/ExperimentBuilder/components/Timeline/ExperimentCode/LocalConfiguration",
  () => ({
    default: (props: any) => {
      mocks.localProps = props;
      return { generateLocalExperiment: mocks.localGenerator };
    },
  }),
);

vi.mock(
  "../../pages/ExperimentBuilder/components/Timeline/ExperimentCode/PublicConfiguration",
  () => ({
    default: (props: any) => {
      mocks.publicProps = props;
      return { generateExperiment: mocks.publicGenerator };
    },
  }),
);

vi.mock(
  "../../pages/ExperimentBuilder/components/Timeline/ExperimentCode/ExperimentBase",
  () => ({
    default: (props: any) => {
      mocks.baseProps = props;
      return { generatedBaseCode: mocks.baseGenerator };
    },
  }),
);

describe("useExperimentCode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.localProps = undefined;
    mocks.publicProps = undefined;
    mocks.baseProps = undefined;
    mocks.experimentID = "exp-123";
    globalThis.fetch = vi.fn(async (url: string) => {
      if (url.includes("/api/trials-extensions/")) {
        return {
          json: async () => ({
            extensions: [
              "jsPsychExtensionMouseTracking",
              "jsPsychExtensionWebgazer",
            ],
          }),
        } as Response;
      }
      return { json: async () => ({}) } as Response;
    }) as unknown as typeof fetch;
  });

  it("wires local/public/base generators with experiment context", async () => {
    const uploadedFiles = [
      { name: "image.png", url: "https://cdn.test/image.png", type: "image" },
    ];

    const { result } = renderHook(() => useExperimentCode(uploadedFiles));

    expect(result.current.generateLocalExperiment).toBe(mocks.localGenerator);
    expect(result.current.generateExperiment).toBe(mocks.publicGenerator);
    expect(result.current.generatedBaseCode).toBe(mocks.baseGenerator);

    expect(mocks.localProps).toEqual(
      expect.objectContaining({
        experimentID: "exp-123",
        uploadedFiles,
        getTrial: mocks.trialsContext.getTrial,
        getLoopTimeline: mocks.trialsContext.getLoopTimeline,
        getLoop: mocks.trialsContext.getLoop,
        canvasStyles: mocks.canvasStyles,
      }),
    );
    expect(mocks.baseProps).toEqual(
      expect.objectContaining({
        experimentID: "exp-123",
        uploadedFiles,
        canvasStyles: mocks.canvasStyles,
      }),
    );

    await waitFor(() => {
      expect(mocks.fetchExperimentNameByID).toHaveBeenCalledWith("exp-123");
      expect(mocks.publicProps.experimentName).toBe("Named Experiment");
    });
  });

  it("fetches experiment extensions and formats them for initJsPsych", async () => {
    renderHook(() => useExperimentCode());

    const extensions = await mocks.localProps.fetchExtensions();

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "http://localhost:3000/api/trials-extensions/exp-123",
    );
    expect(extensions).toBe(
      "extensions: [{ type: jsPsychExtensionMouseTracking }, { type: jsPsychExtensionWebgazer }],",
    );
  });

  it("returns no extension code when the experiment has no extensions", async () => {
    globalThis.fetch = vi.fn(async () => ({
      json: async () => ({ extensions: [] }),
    })) as unknown as typeof fetch;

    renderHook(() => useExperimentCode());

    await expect(mocks.localProps.fetchExtensions()).resolves.toBe("");
  });

  it("skips experiment name and extensions lookups without an experiment id", async () => {
    mocks.experimentID = "";

    renderHook(() => useExperimentCode());

    expect(mocks.fetchExperimentNameByID).not.toHaveBeenCalled();
    await expect(mocks.localProps.fetchExtensions()).resolves.toBe("");
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("falls back to no extensions when the extensions request fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    globalThis.fetch = vi.fn(async () => {
      throw new Error("network down");
    }) as unknown as typeof fetch;

    renderHook(() => useExperimentCode());

    await expect(mocks.localProps.fetchExtensions()).resolves.toBe("");
    expect(console.error).toHaveBeenCalledWith(
      "Error loading extensions:",
      expect.any(Error),
    );
  });

  it("passes branching support snippets into local and public configurations", () => {
    renderHook(() => useExperimentCode());

    expect(mocks.localProps.evaluateCondition).toContain(
      "const evaluateCondition = (trialData, condition)",
    );
    expect(mocks.localProps.evaluateCondition).toContain(
      "window.branchCustomParameters = null",
    );
    expect(mocks.publicProps.branchingEvaluation).toContain(
      "const nextTrialId = getNextTrialId(lastTrialData);",
    );
    expect(mocks.publicProps.branchingEvaluation).toContain(
      "jsPsych.abortExperiment('Experiment finished by branching condition'",
    );
  });
});
