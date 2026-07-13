import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import BranchedTrial from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/BranchedTrial";
import useLoadData from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/BranchedTrial/useLoadData";
import Webgazer from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/Webgazer";

const trialsState = vi.hoisted(() => ({
  value: {} as any,
}));

const phaseState = vi.hoisted(() => ({
  setMinimumPercentAcceptable: vi.fn(),
  setColumnMapping: vi.fn(),
  setIncludeInstructions: vi.fn(),
  columnMapping: {
    stale: { source: "typed", value: "old" },
  } as any,
  trialCode: (pluginName: string) => `// ${pluginName}\n`,
}));

vi.mock("../../pages/ExperimentBuilder/hooks/useTrials", () => ({
  default: () => trialsState.value,
}));

vi.mock(
  "../../pages/ExperimentBuilder/components/ConfigurationPanel/utils/pluginParameterLoader",
  () => ({
    loadPluginParameters: vi.fn(async () => ({
      parameters: [{ key: "duration", label: "Duration", type: "number" }],
    })),
  }),
);

vi.mock(
  "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/ParameterMapper/Modal",
  () => ({
    default: ({
      isOpen,
      onClose,
      children,
    }: {
      isOpen: boolean;
      onClose: () => void;
      children: React.ReactNode;
    }) =>
      isOpen ? (
        <div data-testid="modal-shell">
          {children}
          <button onClick={onClose}>modal close</button>
        </div>
      ) : null,
  }),
);

vi.mock(
  "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/BranchedTrial/useLoadData",
  () => ({
    default: vi.fn(),
  }),
);

vi.mock(
  "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/BranchedTrial/BranchedTrialLayout",
  () => ({
    default: ({
      conditions,
      data,
      error,
      loading,
      selectedTrial,
      targetTrialParameters,
      targetTrialCsvColumns,
      onClose,
      handleSaveConditions,
      setConditions,
      loadTargetTrialParameters,
      findTrialByIdSync,
      getAvailableTrials,
    }: any) => (
      <div data-testid="branched-layout">
        <div>layout-trial:{selectedTrial?.id}</div>
        <div>layout-conditions:{conditions.length}</div>
        <div>layout-data:{data.length}</div>
        <div>layout-loading:{String(loading)}</div>
        <div>layout-error:{error || "none"}</div>
        <div>layout-params:{Object.keys(targetTrialParameters).join(",")}</div>
        <div>layout-csv:{Object.keys(targetTrialCsvColumns).join(",")}</div>
        <button onClick={() => loadTargetTrialParameters("trial-a")}>
          load target trial
        </button>
        <button onClick={() => loadTargetTrialParameters("loop_1")}>
          load target loop
        </button>
        <button onClick={() => loadTargetTrialParameters("missing-target")}>
          load missing target
        </button>
        <button onClick={() => loadTargetTrialParameters("bad-plugin")}>
          load bad plugin
        </button>
        <button onClick={() => loadTargetTrialParameters("no-plugin")}>
          load no plugin
        </button>
        <button onClick={() => setConditions([{ id: 2, rules: [] }])}>
          set branch conditions
        </button>
        <button
          onClick={() =>
            handleSaveConditions([
              { id: 1, nextTrialId: "target-a", rules: [] },
            ])
          }
        >
          save branch conditions
        </button>
        <button onClick={() => handleSaveConditions()}>
          save existing conditions
        </button>
        <button
          onClick={() =>
            handleSaveConditions([
              { id: 3, nextTrialId: "inner-future", rules: [] },
            ])
          }
        >
          save inner target
        </button>
        <button
          onClick={() =>
            handleSaveConditions([
              { id: 4, nextTrialId: "inner-a", rules: [] },
            ])
          }
        >
          save top-level loop child
        </button>
        <button
          onClick={() =>
            handleSaveConditions([
              { id: 5, nextTrialId: "unknown-target", rules: [] },
            ])
          }
        >
          save unknown target
        </button>
        <button
          onClick={() =>
            handleSaveConditions([{ id: 6, nextTrialId: null, rules: [] }])
          }
        >
          save empty target
        </button>
        <button onClick={() => onClose?.()}>close branch modal</button>
        <button onClick={() => findTrialByIdSync("trial-a")}>
          find loaded target
        </button>
        <output data-testid="available-trials">
          {JSON.stringify(getAvailableTrials())}
        </output>
      </div>
    ),
  }),
);

vi.mock(
  "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/Csv/useCsvData",
  () => ({
    useCsvData: () => ({
      csvJson: [{ stimulus: "A" }],
      setCsvJson: vi.fn(),
      csvColumns: ["stimulus", "answer"],
      setCsvColumns: vi.fn(),
    }),
  }),
);

vi.mock(
  "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/hooks/useColumnMapping",
  () => ({
    useColumnMapping: () => ({
      columnMapping: phaseState.columnMapping,
      setColumnMapping: phaseState.setColumnMapping,
    }),
  }),
);

vi.mock(
  "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/Webgazer/InstructionsArrays",
  () => ({
    default: () => ({
      initCameraInstructions: [{ key: "init_text", default: "Init" }],
      calibrateInstructions: [{ key: "cal_text", default: "Calibrate" }],
      validateInstructions: [{ key: "validate_text", default: "Validate" }],
      recalibrateInstructions: [{ key: "recal_text", default: "Recalibrate" }],
    }),
  }),
);

vi.mock(
  "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/Webgazer/generatePhaseCode",
  () => ({
    generatePhaseCode: ({ pluginName, instructions }: any) => ({
      data: [{ key: `${pluginName}_data` }],
      columnMapping: {
        [`${pluginName}_param`]: { source: "typed", value: "mapped" },
      },
      setColumnMapping: phaseState.setColumnMapping,
      includeInstructions: pluginName === "plugin-webgazer-init-camera",
      setIncludeInstructions: phaseState.setIncludeInstructions,
      fieldGroups: {
        instructions,
        parameters:
          pluginName === "plugin-webgazer-recalibrate"
            ? []
            : [{ key: `${pluginName}_param`, label: "Param", type: "string" }],
      },
      trialCode: phaseState.trialCode(pluginName),
      minimumPercentAcceptable: 66,
      setMinimumPercentAcceptable: phaseState.setMinimumPercentAcceptable,
    }),
  }),
);

vi.mock(
  "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialMetaConfig",
  () => ({
    default: ({ trialName, setTrialName, onSave }: any) => (
      <div>
        <input
          aria-label="trial name"
          value={trialName}
          onChange={(event) => setTrialName(event.target.value)}
        />
        <button onClick={onSave}>save trial name</button>
      </div>
    ),
  }),
);

vi.mock(
  "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/Webgazer/Instructions",
  () => ({
    default: ({
      includeInstructions,
      setIncludeInstructions,
      onSave,
    }: any) => (
      <div>
        <button onClick={() => setIncludeInstructions(!includeInstructions)}>
          toggle instructions
        </button>
        <button onClick={() => onSave("stale", undefined)}>
          clear instruction mapping
        </button>
      </div>
    ),
  }),
);

vi.mock(
  "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/ParameterMapper",
  () => ({
    default: ({ pluginName, onSave }: any) => (
      <button
        onClick={() =>
          onSave(`${pluginName}_param`, { source: "typed", value: "new" })
        }
      >
        map {pluginName}
      </button>
    ),
  }),
);

vi.mock(
  "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialActions",
  () => ({
    default: ({ onSave, canSave, onDelete }: any) => (
      <div>
        <button disabled={!canSave} onClick={onSave}>
          save webgazer
        </button>
        <button onClick={onSave}>force save webgazer</button>
        <button onClick={onDelete}>delete webgazer</button>
      </div>
    ),
  }),
);

function selectedTrial(overrides: Record<string, unknown> = {}) {
  return {
    id: "current",
    name: "Current Trial",
    type: "trial",
    plugin: "plugin-html-keyboard-response",
    branches: ["target-a"],
    branchConditions: [],
    repeatConditions: [],
    parameters: {
      include_instructions: {
        "plugin-webgazer-init-camera": true,
      },
      minimum_percent: 50,
    },
    ...overrides,
  } as any;
}

function baseTrialsState(overrides: Record<string, unknown> = {}) {
  const current = selectedTrial();
  return {
    selectedTrial: current,
    setSelectedTrial: vi.fn(),
    updateTrial: vi.fn(async (_id: string, updates: any) => ({
      ...current,
      ...updates,
    })),
    updateLoop: vi.fn(async () => true),
    updateTrialField: vi.fn(async () => true),
    deleteTrial: vi.fn(async () => true),
    getTrial: vi.fn(async (id: string) => ({
      id,
      name: "Loaded Target",
      type: "trial",
      plugin: "plugin-html-keyboard-response",
      csvColumns: ["score", "rt"],
    })),
    getLoop: vi.fn(async (id: string) => ({
      id,
      name: "Loaded Loop",
      type: "loop",
      trials: ["inner-a"],
      csvColumns: ["loop_score"],
    })),
    timeline: [
      { id: "prev-a", name: "Previous A", type: "trial" },
      { id: "current", name: "Current Trial", type: "trial" },
      { id: "target-a", name: "Target A", type: "trial" },
      { id: "loop_1", name: "Loop 1", type: "loop", trials: ["inner-a"] },
    ],
    loopTimeline: [
      { id: "inner-prev", name: "Inner Prev", type: "trial" },
      { id: "current", name: "Current Trial", type: "trial" },
    ],
    getLoopTimeline: vi.fn(async () => []),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
  phaseState.columnMapping = {
    stale: { source: "typed", value: "old" },
  };
  phaseState.trialCode = (pluginName: string) => `// ${pluginName}\n`;
  trialsState.value = baseTrialsState();
});

describe("coverage zero wrappers: BranchedTrial", () => {
  it("loads target metadata, exposes available trials, closes and saves a trial", async () => {
    const onClose = vi.fn();

    render(
      <BranchedTrial
        selectedTrial={trialsState.value.selectedTrial}
        onClose={onClose}
        isOpen
      />,
    );

    expect(screen.getByTestId("modal-shell")).toBeInTheDocument();
    expect(screen.getByTestId("available-trials")).toHaveTextContent("prev-a");
    const loadDataArgs = vi.mocked(useLoadData).mock.calls.at(-1)?.[0] as any;
    loadDataArgs.setRepeatConditions();

    fireEvent.mouseEnter(screen.getAllByRole("button")[0]);
    fireEvent.mouseLeave(screen.getAllByRole("button")[0]);
    fireEvent.click(screen.getByText("load target trial"));
    await waitFor(() => {
      expect(trialsState.value.getTrial).toHaveBeenCalledWith("trial-a");
    });
    fireEvent.click(screen.getByText("find loaded target"));
    fireEvent.click(screen.getByText("set branch conditions"));
    fireEvent.click(screen.getByText("save existing conditions"));
    await waitFor(() => {
      expect(trialsState.value.updateTrial).toHaveBeenCalledWith(
        "current",
        expect.objectContaining({
          branchConditions: [],
          repeatConditions: [],
        }),
      );
    });

    fireEvent.click(screen.getByText("load target loop"));
    await waitFor(() => {
      expect(trialsState.value.getLoop).toHaveBeenCalledWith("loop_1");
    });

    fireEvent.click(screen.getByText("save branch conditions"));
    await waitFor(() => {
      expect(trialsState.value.updateTrial).toHaveBeenCalledWith(
        "current",
        expect.objectContaining({
          branchConditions: expect.any(Array),
          repeatConditions: expect.any(Array),
        }),
      );
    });

    fireEvent.click(screen.getByText("close branch modal"));
    expect(onClose).toHaveBeenCalled();
  });

  it("uses loop-scope available trials and saves loop selections", async () => {
    trialsState.value = baseTrialsState({
      selectedTrial: selectedTrial({
        id: "loop_1",
        name: "Loop Selection",
        type: "loop",
        trials: ["inner-a"],
        branches: ["target-a"],
      }),
    });

    render(
      <BranchedTrial
        selectedTrial={trialsState.value.selectedTrial}
        onClose={vi.fn()}
        isOpen
      />,
    );

    fireEvent.click(screen.getByText("save branch conditions"));
    await waitFor(() => {
      expect(trialsState.value.updateLoop).toHaveBeenCalledWith(
        "loop_1",
        expect.objectContaining({
          branchConditions: expect.any(Array),
          repeatConditions: expect.any(Array),
        }),
      );
    });
  });

  it("handles missing target loads, plugin load failures and lookup errors", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const { loadPluginParameters } = await import(
      "../../pages/ExperimentBuilder/components/ConfigurationPanel/utils/pluginParameterLoader"
    );
    vi.mocked(loadPluginParameters).mockRejectedValueOnce(
      new Error("plugin failed"),
    );
    trialsState.value = baseTrialsState({
      getTrial: vi.fn(async (id: string) => {
        if (id === "missing-target") return null;
        if (id === "bad-plugin") {
          return {
            id,
            name: "Bad Plugin",
            type: "trial",
            plugin: "plugin-bad",
          };
        }
        if (id === "no-plugin") {
          return {
            id,
            name: "No Plugin",
            type: "trial",
          };
        }
        throw new Error("lookup failed");
      }),
    });

    render(
      <BranchedTrial
        selectedTrial={trialsState.value.selectedTrial}
        onClose={vi.fn()}
        isOpen
      />,
    );

    fireEvent.click(screen.getByText("load missing target"));
    await waitFor(() => {
      expect(trialsState.value.getTrial).toHaveBeenCalledWith("missing-target");
    });

    fireEvent.click(screen.getByText("load bad plugin"));
    await waitFor(() => {
      expect(consoleError).toHaveBeenCalledWith(
        "Error loading target trial parameters:",
        expect.any(Error),
      );
    });

    fireEvent.click(screen.getByText("load no plugin"));
    await waitFor(() => {
      expect(trialsState.value.getTrial).toHaveBeenCalledWith("no-plugin");
    });

    fireEvent.click(screen.getByText("load target trial"));
    await waitFor(() => {
      expect(consoleError).toHaveBeenCalledWith(
        "Error finding trial/loop:",
        expect.any(Error),
      );
    });
  });

  it("builds loop-scope available trials and saves an in-loop branch target", async () => {
    trialsState.value = baseTrialsState({
      selectedTrial: selectedTrial({
        parentLoopId: "loop-main",
        branches: [],
      }),
      loopTimeline: [
        { id: "inner-prev", name: "Inner Prev", type: "trial" },
        { id: "current", name: "Current Trial", type: "trial" },
        { id: "inner-future", name: "Inner Future", type: "trial" },
      ],
      timeline: [
        { id: "inner-prev", name: "Inner Prev", type: "trial" },
        { id: "main-a", name: "Main A", type: "trial" },
        { id: "target-a", name: "Target A", type: "trial" },
      ],
    });

    render(
      <BranchedTrial
        selectedTrial={trialsState.value.selectedTrial}
        onClose={vi.fn()}
        isOpen
      />,
    );

    expect(screen.getByTestId("available-trials")).toHaveTextContent(
      "Inner Prev (Loop)",
    );
    expect(screen.getByTestId("available-trials")).toHaveTextContent(
      "Main A (Main)",
    );
    expect(screen.getByTestId("available-trials")).not.toHaveTextContent(
      "Inner Prev (Main)",
    );

    fireEvent.click(screen.getByText("save inner target"));

    await waitFor(() => {
      expect(trialsState.value.updateTrial).toHaveBeenCalledWith(
        "current",
        expect.objectContaining({
          branches: ["inner-future"],
          branchConditions: expect.arrayContaining([
            expect.objectContaining({ nextTrialId: "inner-future" }),
          ]),
        }),
      );
    });
  });

  it("builds loop-parent available trials when the current trial is absent from loop timeline", () => {
    trialsState.value = baseTrialsState({
      selectedTrial: selectedTrial({
        parentLoopId: "loop-main",
      }),
      loopTimeline: [{ id: "inner-prev", name: "Inner Prev", type: "trial" }],
      timeline: [{ id: "main-a", name: "Main A", type: "trial" }],
    });

    render(
      <BranchedTrial
        selectedTrial={trialsState.value.selectedTrial}
        onClose={vi.fn()}
        isOpen
      />,
    );

    expect(screen.getByTestId("available-trials")).not.toHaveTextContent(
      "Inner Prev (Loop)",
    );
    expect(screen.getByTestId("available-trials")).toHaveTextContent(
      "Main A (Main)",
    );
  });

  it("treats top-level loop children and unknown targets as repeat targets", async () => {
    trialsState.value = baseTrialsState({
      selectedTrial: selectedTrial({ branches: [] }),
      timeline: [
        { id: "current", name: "Current Trial", type: "trial" },
        { id: "loop_1", name: "Loop 1", type: "loop", trials: ["inner-a"] },
        { id: "loop_empty", name: "Loop Empty", type: "loop" },
        { id: "inner-a", name: "Inner A", type: "trial" },
      ],
    });

    render(
      <BranchedTrial
        selectedTrial={trialsState.value.selectedTrial}
        onClose={vi.fn()}
        isOpen
      />,
    );

    fireEvent.click(screen.getByText("save top-level loop child"));
    await waitFor(() => {
      expect(trialsState.value.updateTrial).toHaveBeenCalledWith(
        "current",
        expect.objectContaining({
          repeatConditions: expect.arrayContaining([
            expect.objectContaining({ jumpToTrialId: "inner-a" }),
          ]),
        }),
      );
    });

    fireEvent.click(screen.getByText("save unknown target"));
    await waitFor(() => {
      expect(trialsState.value.updateTrial).toHaveBeenCalledWith(
        "current",
        expect.objectContaining({
          repeatConditions: expect.arrayContaining([
            expect.objectContaining({ jumpToTrialId: "unknown-target" }),
          ]),
        }),
      );
    });
  });

  it("returns no available trials when the selected trial is outside the timeline", () => {
    trialsState.value = baseTrialsState({
      selectedTrial: selectedTrial({ id: "detached" }),
      timeline: [{ id: "prev-a", name: "Previous A", type: "trial" }],
    });

    render(
      <BranchedTrial
        selectedTrial={trialsState.value.selectedTrial}
        onClose={vi.fn()}
        isOpen
      />,
    );

    expect(screen.getByTestId("available-trials")).toHaveTextContent("[]");
    fireEvent.click(screen.getByText("find loaded target"));
  });

  it("ignores conditions without a next target when saving", async () => {
    trialsState.value = baseTrialsState({
      selectedTrial: selectedTrial({ branches: [] }),
    });

    render(
      <BranchedTrial
        selectedTrial={trialsState.value.selectedTrial}
        onClose={vi.fn()}
        isOpen
      />,
    );

    fireEvent.click(screen.getByText("save empty target"));

    await waitFor(() => {
      expect(trialsState.value.updateTrial).toHaveBeenCalledWith(
        "current",
        expect.objectContaining({
          branchConditions: [],
          repeatConditions: [],
        }),
      );
    });
  });

  it("saves branch updates when the selected trial has no branches array", async () => {
    trialsState.value = baseTrialsState({
      selectedTrial: selectedTrial({ branches: undefined }),
    });

    render(
      <BranchedTrial
        selectedTrial={trialsState.value.selectedTrial}
        onClose={vi.fn()}
        isOpen
      />,
    );

    fireEvent.click(screen.getByText("save branch conditions"));

    await waitFor(() => {
      expect(trialsState.value.updateTrial).toHaveBeenCalledWith(
        "current",
        expect.objectContaining({
          branches: ["target-a"],
          branchConditions: expect.arrayContaining([
            expect.objectContaining({ nextTrialId: "target-a" }),
          ]),
        }),
      );
    });
  });

  it("no-ops without a selected trial and logs save failures", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    trialsState.value = baseTrialsState({
      selectedTrial: null,
      updateTrial: vi.fn(),
      updateLoop: vi.fn(),
    });

    const { rerender } = render(
      <BranchedTrial selectedTrial={null as any} isOpen />,
    );

    fireEvent.click(screen.getByText("save existing conditions"));
    fireEvent.click(screen.getByText("modal close"));
    expect(trialsState.value.updateTrial).not.toHaveBeenCalled();
    expect(trialsState.value.updateLoop).not.toHaveBeenCalled();

    vi.useFakeTimers();
    trialsState.value = baseTrialsState({
      updateTrial: vi.fn(async () => {
        throw new Error("save failed");
      }),
    });
    rerender(
      <BranchedTrial
        selectedTrial={trialsState.value.selectedTrial}
        onClose={vi.fn()}
        isOpen
      />,
    );

    fireEvent.click(screen.getByText("save branch conditions"));
    await Promise.resolve();
    await Promise.resolve();
    expect(consoleError).toHaveBeenCalledWith(
      "Error saving conditions:",
      expect.any(Error),
    );

    act(() => {
      vi.advanceTimersByTime(1500);
    });
  });

  it("clears the webgazer saved indicator timer", async () => {
    vi.useFakeTimers();

    render(
      <Webgazer
        webgazerPlugins={[
          "plugin-webgazer-calibrate",
          "plugin-webgazer-init-camera",
          "plugin-webgazer-recalibrate",
          "plugin-webgazer-validate",
        ]}
      />,
    );

    fireEvent.change(screen.getByLabelText("trial name"), {
      target: { value: "Timed Save" },
    });
    await act(async () => {
      fireEvent.click(screen.getByText("save trial name"));
    });
    expect(screen.getByText(/Saved \(name\)/)).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1500);
    });
  });

  it("guards webgazer actions when no trial is selected", () => {
    trialsState.value = baseTrialsState({ selectedTrial: null });

    render(
      <Webgazer
        webgazerPlugins={[
          "plugin-webgazer-calibrate",
          "plugin-webgazer-init-camera",
          "plugin-webgazer-recalibrate",
          "plugin-webgazer-validate",
        ]}
      />,
    );

    fireEvent.click(screen.getByText("save trial name"));
    fireEvent.click(screen.getAllByText("toggle instructions")[0]);
    fireEvent.click(screen.getAllByText("clear instruction mapping")[0]);
    fireEvent.change(screen.getByPlaceholderText("1-100"), {
      target: { value: "" },
    });
    fireEvent.blur(screen.getByPlaceholderText("1-100"), {
      target: { value: "" },
    });
    fireEvent.click(screen.getByText("force save webgazer"));
    fireEvent.click(screen.getByText("delete webgazer"));

    expect(trialsState.value.updateTrialField).not.toHaveBeenCalled();
    expect(trialsState.value.updateTrial).not.toHaveBeenCalled();
    expect(trialsState.value.deleteTrial).not.toHaveBeenCalled();
    expect(phaseState.setMinimumPercentAcceptable).toHaveBeenCalledWith(1);
  });

  it("skips webgazer saves when required data is missing or persistence fails", async () => {
    phaseState.trialCode = () => "";
    trialsState.value = baseTrialsState({
      updateTrialField: vi.fn(async () => false),
    });

    render(
      <Webgazer
        webgazerPlugins={[
          "plugin-webgazer-calibrate",
          "plugin-webgazer-init-camera",
          "plugin-webgazer-recalibrate",
          "plugin-webgazer-validate",
        ]}
      />,
    );

    fireEvent.click(screen.getByText("save trial name"));
    expect(trialsState.value.updateTrialField).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("trial name"), {
      target: { value: "No Generated Code" },
    });
    fireEvent.click(screen.getByText("save trial name"));
    await waitFor(() => {
      expect(trialsState.value.updateTrialField).toHaveBeenCalledWith(
        "current",
        "name",
        "No Generated Code",
      );
    });
    expect(trialsState.value.updateTrialField).not.toHaveBeenCalledWith(
      "current",
      "trialCode",
      "",
    );
  });

  it("uses fallback webgazer parameters and empty column mappings", async () => {
    phaseState.columnMapping = undefined;
    trialsState.value = baseTrialsState({
      selectedTrial: selectedTrial({ parameters: undefined }),
    });

    render(
      <Webgazer
        webgazerPlugins={[
          "plugin-webgazer-calibrate",
          "plugin-webgazer-init-camera",
          "plugin-webgazer-recalibrate",
          "plugin-webgazer-validate",
        ]}
      />,
    );

    fireEvent.click(screen.getAllByText("toggle instructions")[0]);
    await waitFor(() => {
      expect(trialsState.value.updateTrialField).toHaveBeenCalledWith(
        "current",
        "parameters",
        expect.objectContaining({
          include_instructions: expect.objectContaining({
            "plugin-webgazer-init-camera": false,
          }),
          minimum_percent: 66,
        }),
      );
    });

    fireEvent.click(screen.getAllByText("clear instruction mapping")[0]);
    await waitFor(() => {
      expect(trialsState.value.updateTrialField).toHaveBeenCalledWith(
        "current",
        "columnMapping",
        {},
      );
    });

    const minimumPercent = screen.getByPlaceholderText("1-100");
    fireEvent.blur(minimumPercent, { target: { value: "" } });
    await waitFor(() => {
      expect(trialsState.value.updateTrialField).toHaveBeenCalledWith(
        "current",
        "parameters",
        { minimum_percent: 1 },
      );
    });
  });

  it("handles webgazer full-save failures and delete cancellations", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    trialsState.value = baseTrialsState({
      updateTrial: vi.fn(async () => {
        throw new Error("save failed");
      }),
    });

    const { rerender } = render(
      <Webgazer
        webgazerPlugins={[
          "plugin-webgazer-calibrate",
          "plugin-webgazer-init-camera",
          "plugin-webgazer-recalibrate",
          "plugin-webgazer-validate",
        ]}
      />,
    );

    fireEvent.change(screen.getByLabelText("trial name"), {
      target: { value: "Rejected Save" },
    });
    fireEvent.click(screen.getByText("save webgazer"));
    await waitFor(() => {
      expect(consoleError).toHaveBeenCalledWith(
        "Error saving trial:",
        expect.any(Error),
      );
    });

    fireEvent.click(screen.getByText("delete webgazer"));
    expect(confirmSpy).toHaveBeenCalled();
    expect(trialsState.value.deleteTrial).not.toHaveBeenCalled();

    confirmSpy.mockReturnValue(true);
    trialsState.value = baseTrialsState({
      deleteTrial: vi.fn(async () => false),
      updateTrial: vi.fn(async () => null),
    });
    rerender(
      <Webgazer
        webgazerPlugins={[
          "plugin-webgazer-calibrate",
          "plugin-webgazer-init-camera",
          "plugin-webgazer-recalibrate",
          "plugin-webgazer-validate",
        ]}
      />,
    );

    fireEvent.change(screen.getByLabelText("trial name"), {
      target: { value: "Null Update" },
    });
    fireEvent.click(screen.getByText("save webgazer"));
    await waitFor(() => {
      expect(trialsState.value.updateTrial).toHaveBeenCalledWith(
        "current",
        expect.objectContaining({ name: "Null Update" }),
      );
    });
    expect(trialsState.value.setSelectedTrial).not.toHaveBeenCalledWith(
      expect.objectContaining({ name: "Null Update" }),
    );

    fireEvent.click(screen.getByText("delete webgazer"));
    await waitFor(() => {
      expect(trialsState.value.deleteTrial).toHaveBeenCalledWith("current");
    });
    expect(trialsState.value.setSelectedTrial).not.toHaveBeenCalledWith(null);

    consoleError.mockRestore();
    confirmSpy.mockRestore();
  });
});

describe("coverage zero wrappers: Webgazer", () => {
  it("saves field edits, generated code, full trial data and deletion", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);

    render(
      <Webgazer
        webgazerPlugins={[
          "plugin-webgazer-calibrate",
          "plugin-webgazer-init-camera",
          "plugin-webgazer-recalibrate",
          "plugin-webgazer-validate",
        ]}
      />,
    );

    expect(screen.getByText("WebGazer")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("trial name"), {
      target: { value: "Eye Tracking Trial" },
    });
    fireEvent.click(screen.getByText("save trial name"));
    await waitFor(() => {
      expect(trialsState.value.updateTrialField).toHaveBeenCalledWith(
        "current",
        "name",
        "Eye Tracking Trial",
      );
      expect(trialsState.value.updateTrialField).toHaveBeenCalledWith(
        "current",
        "trialCode",
        expect.stringContaining("plugin-webgazer-init-camera"),
      );
    });

    fireEvent.click(screen.getAllByText("toggle instructions")[0]);
    await waitFor(() => {
      expect(phaseState.setIncludeInstructions).toHaveBeenCalledWith(false);
      expect(trialsState.value.updateTrialField).toHaveBeenCalledWith(
        "current",
        "parameters",
        expect.objectContaining({
          include_instructions: expect.objectContaining({
            "plugin-webgazer-init-camera": false,
          }),
        }),
      );
    });

    fireEvent.click(screen.getAllByText("clear instruction mapping")[0]);
    fireEvent.click(screen.getByText("map plugin-webgazer-calibrate"));
    await waitFor(() => {
      expect(trialsState.value.updateTrialField).toHaveBeenCalledWith(
        "current",
        "columnMapping",
        expect.any(Object),
      );
    });

    const minimumPercent = screen.getByPlaceholderText("1-100");
    fireEvent.change(minimumPercent, { target: { value: "77" } });
    expect(phaseState.setMinimumPercentAcceptable).toHaveBeenCalledWith(77);
    fireEvent.blur(minimumPercent);
    await waitFor(() => {
      expect(trialsState.value.updateTrialField).toHaveBeenCalledWith(
        "current",
        "parameters",
        expect.objectContaining({
          minimum_percent: 66,
        }),
      );
    });

    fireEvent.click(screen.getByText("save webgazer"));
    await waitFor(() => {
      expect(trialsState.value.updateTrial).toHaveBeenCalledWith(
        "current",
        expect.objectContaining({
          name: "Eye Tracking Trial",
          plugin: "webgazer",
          trialCode: expect.stringContaining("plugin-webgazer-validate"),
          columnMapping: expect.any(Object),
        }),
      );
      expect(trialsState.value.setSelectedTrial).toHaveBeenCalledWith(
        expect.objectContaining({ name: "Eye Tracking Trial" }),
      );
    });

    fireEvent.click(screen.getByText("delete webgazer"));
    await waitFor(() => {
      expect(confirmSpy).toHaveBeenCalledWith(
        'Are you sure you want to delete "Current Trial"?',
      );
      expect(trialsState.value.deleteTrial).toHaveBeenCalledWith("current");
      expect(trialsState.value.setSelectedTrial).toHaveBeenCalledWith(null);
    });
  });
});
