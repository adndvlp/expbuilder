import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import TrialsConfig from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration";
import type { Trial } from "../../pages/ExperimentBuilder/components/ConfigurationPanel/types";

const mocks = vi.hoisted(() => ({
  trialsContext: {} as any,
  mapperProps: undefined as any,
  extensionsProps: undefined as any,
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
    default: () => <div data-testid="tab-content" />,
  }),
);

vi.mock(
  "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialCodeInjection",
  () => ({
    default: ({ onSave }: any) => (
      <button type="button" onClick={() => onSave("customOnFinish", "data.ok = true;")}>
        Save Custom Code
      </button>
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
  });

  afterEach(() => {
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
});
