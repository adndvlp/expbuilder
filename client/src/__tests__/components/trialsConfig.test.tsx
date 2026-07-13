import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import TrialsConfig from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration";
import type { Trial } from "../../pages/ExperimentBuilder/components/ConfigurationPanel/types";

const mocks = vi.hoisted(() => ({
  trialsContext: {} as any,
  mapperProps: undefined as any,
  extensionsProps: undefined as any,
  tabContentProps: undefined as any,
  pluginParameters: [
    { key: "stimulus", label: "Stimulus", type: "html_string", default: "" },
    { key: "choices", label: "Choices", type: "string_array", default: [] },
  ],
  pluginData: [{ key: "response", label: "Response", type: "string" }],
  uploadedFiles: [{ name: "image.png", url: "https://cdn/image.png", type: "image" }],
}));

vi.mock("../../pages/ExperimentBuilder/hooks/useTrials", () => ({
  default: () => mocks.trialsContext,
}));

vi.mock(
  "../../pages/ExperimentBuilder/components/ConfigurationPanel/hooks/usePluginParameters",
  () => ({
    usePluginParameters: () => ({
      parameters: mocks.pluginParameters,
      data: mocks.pluginData,
      loading: false,
      error: null,
    }),
  }),
);

vi.mock(
  "../../pages/ExperimentBuilder/components/Timeline/useFileUpload",
  () => ({
    useFileUpload: () => ({
      uploadedFiles: mocks.uploadedFiles,
    }),
  }),
);

vi.mock("react-switch", () => ({
  default: ({ checked, onChange, disabled }: any) => (
    <button
      type="button"
      data-testid={disabled ? "disabled-switch" : "switch"}
      onClick={() => onChange(!checked)}
    >
      switch {String(checked)}
    </button>
  ),
}));

vi.mock(
  "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialCode/TrialCodeGenerators",
  () => ({
    generateInitializeCode: (code: string) =>
      code.trim() ? `initialize generated ${code}` : "",
    generateOnLoadCode: (code: string) =>
      code.trim() ? `on_load generated ${code}` : "",
    generateOnStartCode: ({ customOnStart, getVarName }: any) => {
      const varName = getVarName("BranchCustomParameters");
      return customOnStart?.trim() ? `on_start generated ${varName}` : "";
    },
    generateOnFinishCode: ({ customOnFinish, getVarName, isInLoop }: any) => {
      const varName = getVarName("HasBranches");
      return customOnFinish?.trim() || isInLoop
        ? `on_finish generated ${varName}`
        : "";
    },
  }),
);

vi.mock(
  "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/ParameterMapper",
  () => ({
    default: (props: any) => {
      mocks.mapperProps = props;
      return (
        <div data-testid="parameter-mapper">
          <span data-testid="mapper-cols">{props.csvColumns.join(",")}</span>
          <span data-testid="mapper-stimulus">
            {props.columnMapping.stimulus?.value ?? ""}
          </span>
          <button
            type="button"
            onClick={() =>
              props.onSave("stimulus", { source: "typed", value: "<p>New</p>" })
            }
          >
            Save Stimulus Mapping
          </button>
          <button type="button" onClick={() => props.onSave("choices", undefined)}>
            Remove Choices Mapping
          </button>
        </div>
      );
    },
  }),
);

vi.mock(
  "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TabContent",
  () => ({
    default: (props: any) => {
      mocks.tabContentProps = props;
      return (
        <div data-testid="tab-content">
          <button
            type="button"
            onClick={() =>
              props.saveColumnMapping("stimulus", {
                source: "typed",
                value: "<p>Dynamic</p>",
              })
            }
          >
            Save Dynamic Mapping
          </button>
          <button
            type="button"
            onClick={() => props.saveField("customOnLoad", "dynamic();")}
          >
            Save Dynamic Field
          </button>
        </div>
      );
    },
  }),
);

vi.mock(
  "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialCodeInjection",
  () => ({
    default: ({ tabs, onSave }: any) => (
      <div data-testid="trial-code-injection">
        {tabs.map((tab: any) => (
          <div key={tab.key}>
            <output data-testid={`preview-empty-${tab.key}`}>
              {tab.computePreview("")}
            </output>
            <output data-testid={`preview-custom-${tab.key}`}>
              {tab.computePreview("console.log('x');")}
            </output>
          </div>
        ))}
        <button
          type="button"
          onClick={() => onSave("customOnFinish", "data.ok = true;")}
        >
          Save Custom Code
        </button>
      </div>
    ),
  }),
);

vi.mock(
  "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/Extensions",
  () => ({
    default: (props: any) => {
      mocks.extensionsProps = props;
      return (
        <button
          type="button"
          onClick={() => props.onSave(true, "jsPsychExtensionMouseTracking")}
        >
          Save Extensions
        </button>
      );
    },
  }),
);

vi.mock(
  "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialActions",
  () => ({
    default: ({ onSave, canSave, onDelete }: any) => (
      <div>
        <button type="button" disabled={!canSave} onClick={onSave}>
          Save trial
        </button>
        <button type="button" onClick={onSave}>
          Force save
        </button>
        <button type="button" onClick={onDelete}>
          Delete trial
        </button>
      </div>
    ),
  }),
);

function makeTrial(overrides: Partial<Trial> = {}): Trial {
  return {
    id: 10,
    type: "trial",
    name: "Target Trial",
    plugin: "plugin-html-keyboard-response",
    parameters: {
      includesExtensions: false,
      extensionType: "",
    },
    trialCode: "",
    columnMapping: {
      stimulus: { source: "typed", value: "<p>Old</p>" },
      choices: { source: "typed", value: ["y", "n"] },
    },
    ...overrides,
  };
}

function installTrialsContext(selectedTrial: Trial | null, overrides: Partial<any> = {}) {
  mocks.trialsContext = {
    selectedTrial,
    setSelectedTrial: vi.fn(),
    updateTrial: vi.fn(async (id: string | number, data: unknown) => ({
      id,
      ...(data as object),
    })),
    updateTrialField: vi.fn(async () => true),
    getLoop: vi.fn(async () => ({
      id: "loop_1",
      name: "Parent Loop",
      csvColumns: ["stimulus_col", "choice_col"],
      csvJson: [{ stimulus_col: "A", choice_col: "y" }],
    })),
    deleteTrial: vi.fn(async () => true),
    timeline: [{ id: 10, name: "Target Trial" }],
    ...overrides,
  };
}

describe("TrialsConfig", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => {});
    installTrialsContext(makeTrial({ parentLoopId: "loop_1" }));
    mocks.mapperProps = undefined;
    mocks.extensionsProps = undefined;
    mocks.tabContentProps = undefined;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("loads selected trial mapping and parent loop CSV columns into ParameterMapper", async () => {
    render(<TrialsConfig pluginName="plugin-html-keyboard-response" />);

    await waitFor(() => {
      expect(screen.getByTestId("mapper-stimulus")).toHaveTextContent("<p>Old</p>");
    });
    await waitFor(() => {
      expect(screen.getByTestId("mapper-cols")).toHaveTextContent(
        "stimulus_col,choice_col",
      );
    });

    expect(mocks.trialsContext.getLoop).toHaveBeenCalledWith("loop_1");
    expect(mocks.mapperProps.uploadedFiles).toEqual([
      { name: "image.png", url: "https://cdn/image.png", type: "image" },
    ]);

    fireEvent.click(screen.getByTestId("disabled-switch"));
  });

  it("autosaves individual columnMapping changes and removals", async () => {
    render(<TrialsConfig pluginName="plugin-html-keyboard-response" />);

    fireEvent.click(screen.getByRole("button", { name: "Save Stimulus Mapping" }));

    await waitFor(() => {
      expect(mocks.trialsContext.updateTrialField).toHaveBeenCalledWith(
        10,
        "columnMapping",
        {
          stimulus: { source: "typed", value: "<p>New</p>" },
          choices: { source: "typed", value: ["y", "n"] },
        },
      );
    });

    fireEvent.click(screen.getByRole("button", { name: "Remove Choices Mapping" }));

    await waitFor(() => {
      expect(mocks.trialsContext.updateTrialField).toHaveBeenCalledWith(
        10,
        "columnMapping",
        {
          stimulus: { source: "typed", value: "<p>Old</p>" },
        },
      );
    });
  });

  it("saves trial name, custom lifecycle code and extension settings through updateTrialField", async () => {
    render(<TrialsConfig pluginName="plugin-html-keyboard-response" />);

    const nameInput = screen.getByDisplayValue("Target Trial");
    fireEvent.change(nameInput, { target: { value: "Renamed Trial" } });
    fireEvent.blur(nameInput);

    await waitFor(() => {
      expect(mocks.trialsContext.updateTrialField).toHaveBeenCalledWith(
        10,
        "name",
        "Renamed Trial",
      );
    });

    fireEvent.click(screen.getByRole("button", { name: "Save Custom Code" }));
    fireEvent.click(screen.getByRole("button", { name: "Save Extensions" }));

    await waitFor(() => {
      expect(mocks.trialsContext.updateTrialField).toHaveBeenCalledWith(
        10,
        "customOnFinish",
        "data.ok = true;",
      );
    });
    expect(mocks.trialsContext.updateTrialField).toHaveBeenCalledWith(
      10,
      "parameters",
      {
        includesExtensions: true,
        extensionType: "jsPsychExtensionMouseTracking",
      },
    );
  });

  it("persists the full trial on manual save and refreshes selectedTrial", async () => {
    render(<TrialsConfig pluginName="plugin-html-keyboard-response" />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Save trial" })).toBeEnabled();
    });

    fireEvent.click(screen.getByRole("button", { name: "Save trial" }));

    await waitFor(() => {
      expect(mocks.trialsContext.updateTrial).toHaveBeenCalledWith(
        10,
        expect.objectContaining({
          name: "Target Trial",
          plugin: "plugin-html-keyboard-response",
          parameters: {
            includesExtensions: false,
            extensionType: "",
          },
          columnMapping: {
            stimulus: { source: "typed", value: "<p>Old</p>" },
            choices: { source: "typed", value: ["y", "n"] },
          },
          parentLoopId: "loop_1",
        }),
      );
    });
    expect(mocks.trialsContext.setSelectedTrial).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 10,
        name: "Target Trial",
      }),
    );
  });

  it("confirms before deleting the selected trial", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);

    render(<TrialsConfig pluginName="plugin-html-keyboard-response" />);

    fireEvent.click(screen.getByRole("button", { name: "Delete trial" }));

    await waitFor(() => {
      expect(mocks.trialsContext.deleteTrial).toHaveBeenCalledWith(10);
    });
    expect(mocks.trialsContext.setSelectedTrial).toHaveBeenCalledWith(null);
  });

  it("skips deletion when there is no selected trial or the user cancels", async () => {
    installTrialsContext(null);
    render(<TrialsConfig pluginName="plugin-html-keyboard-response" />);

    fireEvent.click(screen.getByRole("button", { name: "Delete trial" }));
    expect(mocks.trialsContext.deleteTrial).not.toHaveBeenCalled();

    installTrialsContext(makeTrial());
    vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<TrialsConfig pluginName="plugin-html-keyboard-response" />);

    fireEvent.click(screen.getAllByRole("button", { name: "Delete trial" }).at(-1)!);
    expect(mocks.trialsContext.deleteTrial).not.toHaveBeenCalled();
  });

  it("keeps the selected trial when deleteTrial returns false", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    installTrialsContext(makeTrial(), {
      deleteTrial: vi.fn(async () => false),
    });

    render(<TrialsConfig pluginName="plugin-html-keyboard-response" />);

    fireEvent.click(screen.getByRole("button", { name: "Delete trial" }));

    await waitFor(() => {
      expect(mocks.trialsContext.deleteTrial).toHaveBeenCalledWith(10);
    });
    expect(mocks.trialsContext.setSelectedTrial).not.toHaveBeenCalledWith(null);
  });

  it("loads trials without parent loops using empty CSV defaults", async () => {
    installTrialsContext(
      makeTrial({
        name: "",
        parameters: {},
        columnMapping: undefined as any,
        parentLoopId: undefined,
      }),
      {
        getLoop: vi.fn(async () => null),
      },
    );

    render(<TrialsConfig pluginName="plugin-html-keyboard-response" />);

    await waitFor(() => {
      expect(screen.getByTestId("mapper-cols")).toHaveTextContent("");
    });
    expect(mocks.trialsContext.getLoop).not.toHaveBeenCalled();

    fireEvent.blur(screen.getByDisplayValue(""));
    expect(mocks.trialsContext.updateTrialField).not.toHaveBeenCalledWith(
      10,
      "name",
      expect.anything(),
    );

    fireEvent.click(screen.getByRole("button", { name: "Remove Choices Mapping" }));
    await waitFor(() => {
      expect(mocks.trialsContext.updateTrialField).toHaveBeenCalledWith(
        10,
        "columnMapping",
        {},
      );
    });

    fireEvent.click(screen.getByRole("button", { name: "Force save" }));
    await waitFor(() => {
      expect(mocks.trialsContext.updateTrial).not.toHaveBeenCalled();
    });
  });

  it("uses empty CSV columns when the parent loop is missing or has no csvColumns", async () => {
    installTrialsContext(makeTrial({ parentLoopId: "missing_loop" }), {
      getLoop: vi.fn(async () => null),
    });
    const { unmount } = render(
      <TrialsConfig pluginName="plugin-html-keyboard-response" />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("mapper-cols")).toHaveTextContent("");
    });
    unmount();

    installTrialsContext(makeTrial({ parentLoopId: "loop_without_columns" }), {
      getLoop: vi.fn(async () => ({
        id: "loop_without_columns",
        name: "Loop without columns",
        csvJson: [],
      })),
    });
    render(<TrialsConfig pluginName="plugin-html-keyboard-response" />);

    await waitFor(() => {
      expect(screen.getByTestId("mapper-cols")).toHaveTextContent("");
    });
  });

  it("renders dynamic plugin tab content and routes dynamic saves", async () => {
    render(<TrialsConfig pluginName="plugin-dynamic" />);

    await waitFor(() => {
      expect(screen.getByTestId("tab-content")).toBeInTheDocument();
    });
    expect(screen.queryByTestId("parameter-mapper")).not.toBeInTheDocument();
    expect(mocks.tabContentProps.uploadedFiles).toEqual(mocks.uploadedFiles);

    fireEvent.click(screen.getByRole("button", { name: "Save Dynamic Mapping" }));
    fireEvent.click(screen.getByRole("button", { name: "Save Dynamic Field" }));

    await waitFor(() => {
      expect(mocks.trialsContext.updateTrialField).toHaveBeenCalledWith(
        10,
        "columnMapping",
        {
          stimulus: { source: "typed", value: "<p>Dynamic</p>" },
          choices: { source: "typed", value: ["y", "n"] },
        },
      );
    });
    expect(mocks.trialsContext.updateTrialField).toHaveBeenCalledWith(
      10,
      "customOnLoad",
      "dynamic();",
    );
  });

  it("exercises lifecycle previews inside and outside loops", async () => {
    render(<TrialsConfig pluginName="plugin-html-keyboard-response" />);

    expect(screen.getByTestId("preview-empty-initialize")).toHaveTextContent(
      "initialize: async function",
    );
    expect(screen.getByTestId("preview-custom-onStart")).toHaveTextContent(
      "loop_loop_1_BranchCustomParameters",
    );
    expect(screen.getByTestId("preview-empty-onFinish")).toHaveTextContent(
      "loop_loop_1_HasBranches",
    );

    installTrialsContext(makeTrial({ parentLoopId: undefined }));
    render(<TrialsConfig pluginName="plugin-html-keyboard-response" />);

    expect(screen.getAllByTestId("preview-empty-onFinish").at(-1)).toHaveTextContent(
      "on_finish: function",
    );
  });

  it("does not show a save indicator when granular field saves return false", async () => {
    installTrialsContext(makeTrial(), {
      updateTrialField: vi.fn(async () => false),
    });

    render(<TrialsConfig pluginName="plugin-html-keyboard-response" />);

    fireEvent.click(screen.getByRole("button", { name: "Save Custom Code" }));

    await waitFor(() => {
      expect(mocks.trialsContext.updateTrialField).toHaveBeenCalledWith(
        10,
        "customOnFinish",
        "data.ok = true;",
      );
    });
    expect(screen.getByText(/Saved Trial/)).toHaveStyle({ opacity: "0" });
  });

  it("hides the save indicator after successful granular saves", async () => {
    vi.useFakeTimers();
    render(<TrialsConfig pluginName="plugin-html-keyboard-response" />);

    await act(async () => {
      await Promise.resolve();
      vi.advanceTimersByTime(100);
    });

    fireEvent.click(screen.getByRole("button", { name: "Save Custom Code" }));

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByText(/Saved \(customOnFinish\)/)).toHaveStyle({
      opacity: "1",
    });

    act(() => {
      vi.advanceTimersByTime(1500);
    });

    expect(screen.getByText(/Saved Trial/)).toHaveStyle({ opacity: "0" });
  });

  it("handles manual save responses without updated trials and logs save failures", async () => {
    installTrialsContext(makeTrial({ parentLoopId: undefined }), {
      updateTrial: vi.fn(async () => null),
      getLoop: vi.fn(async () => null),
    });
    const { unmount } = render(
      <TrialsConfig pluginName="plugin-html-keyboard-response" />,
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Save trial" })).toBeEnabled();
    });
    fireEvent.click(screen.getByRole("button", { name: "Save trial" }));

    await waitFor(() => {
      expect(mocks.trialsContext.updateTrial).toHaveBeenCalledWith(
        10,
        expect.objectContaining({ parentLoopId: null }),
      );
    });
    expect(mocks.trialsContext.setSelectedTrial).not.toHaveBeenCalled();
    unmount();

    vi.spyOn(console, "error").mockImplementation(() => {});
    installTrialsContext(makeTrial(), {
      updateTrial: vi.fn(async () => {
        throw new Error("save failed");
      }),
    });
    render(<TrialsConfig pluginName="plugin-html-keyboard-response" />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Save trial" })).toBeEnabled();
    });
    fireEvent.click(screen.getByRole("button", { name: "Save trial" }));

    await waitFor(() => {
      expect(console.error).toHaveBeenCalledWith(
        "Error saving trial:",
        expect.any(Error),
      );
    });
  });

  it("keeps save callbacks guarded when selectedTrial is null", async () => {
    installTrialsContext(null);
    render(<TrialsConfig pluginName="plugin-html-keyboard-response" />);

    fireEvent.click(screen.getByRole("button", { name: "Force save" }));
    fireEvent.click(screen.getByRole("button", { name: "Save Stimulus Mapping" }));
    fireEvent.click(screen.getByRole("button", { name: "Save Custom Code" }));
    fireEvent.click(screen.getByRole("button", { name: "Save Extensions" }));

    expect(mocks.trialsContext.updateTrial).not.toHaveBeenCalled();
    expect(mocks.trialsContext.updateTrialField).not.toHaveBeenCalled();
  });
});
