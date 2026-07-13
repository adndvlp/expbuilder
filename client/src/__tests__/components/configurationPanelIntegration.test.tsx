import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ConfigurationPanel from "../../pages/ExperimentBuilder/components/ConfigurationPanel";

const mocks = vi.hoisted(() => ({
  selectedTrial: null as any,
  selectedLoop: null as any,
  updateTrial: vi.fn(),
  plugins: [] as Array<{
    name: string;
    scripTag: string;
    pluginCode: string;
    index: number;
  }>,
  setPlugins: vi.fn(),
  metadataError: "",
  setMetadataError: vi.fn(),
  isSaving: false,
}));

vi.mock("../../pages/ExperimentBuilder/hooks/useTrials", () => ({
  default: () => ({
    selectedTrial: mocks.selectedTrial,
    selectedLoop: mocks.selectedLoop,
    updateTrial: mocks.updateTrial,
  }),
}));

vi.mock("../../pages/ExperimentBuilder/hooks/usePlugins", () => ({
  default: () => ({
    isSaving: mocks.isSaving,
    plugins: mocks.plugins,
    metadataError: mocks.metadataError,
    setPlugins: mocks.setPlugins,
    setMetadataError: mocks.setMetadataError,
  }),
}));

vi.mock("react-switch", () => ({
  default: ({
    checked,
    onChange,
    disabled,
    "aria-label": ariaLabel,
  }: {
    checked: boolean;
    onChange: (checked: boolean) => void;
    disabled?: boolean;
    "aria-label"?: string;
  }) => (
    <button
      type="button"
      aria-label={ariaLabel ?? "toggle switch"}
      data-checked={String(checked)}
      disabled={disabled}
      onClick={() => onChange(!checked)}
    />
  ),
}));

vi.mock("react-select", () => ({
  default: ({
    options,
    value,
    onChange,
    placeholder,
    styles,
  }: {
    options: Array<{ value: string; label: string }>;
    value: { value: string; label: string } | null;
    onChange: (option: { value: string; label: string } | null) => void;
    placeholder: string;
    styles?: Record<string, (...args: any[]) => Record<string, unknown>>;
  }) => {
    const styleProbe = {
      controlFocused: styles?.control?.({}, { isFocused: true }),
      controlBlurred: styles?.control?.({}, { isFocused: false }),
      singleValue: styles?.singleValue?.({}),
      menu: styles?.menu?.({}),
      optionFocused: styles?.option?.({}, { isFocused: true, isSelected: true }),
      optionBlurred: styles?.option?.({}, { isFocused: false, isSelected: false }),
      placeholder: styles?.placeholder?.({}),
      input: styles?.input?.({}),
      dropdownFocused: styles?.dropdownIndicator?.({}, { isFocused: true }),
      dropdownBlurred: styles?.dropdownIndicator?.({}, { isFocused: false }),
      indicatorSeparator: styles?.indicatorSeparator?.({}),
    };

    return (
      <>
        <select
          aria-label="plugin select"
          value={value?.value ?? ""}
          onChange={(event) =>
            onChange(
              options.find((option) => option.value === event.target.value) ??
                null,
            )
          }
        >
          <option value="">{placeholder}</option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <output data-testid="select-style-probe">
          {JSON.stringify(styleProbe)}
        </output>
      </>
    );
  },
}));

vi.mock(
  "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration",
  () => ({
    default: ({ pluginName }: { pluginName: string }) => (
      <div data-testid="trials-config">TrialsConfig {pluginName}</div>
    ),
  }),
);

vi.mock(
  "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/Webgazer",
  () => ({
    default: ({ webgazerPlugins }: { webgazerPlugins: string[] }) => (
      <div data-testid="webgazer-config">{webgazerPlugins.join(",")}</div>
    ),
  }),
);

vi.mock(
  "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/LoopsConfiguration",
  () => ({
    default: ({ loop }: { loop: { id: string; name: string } }) => (
      <div data-testid="loop-config">LoopConfig {loop.name}</div>
    ),
  }),
);

vi.mock("../../pages/ExperimentBuilder/components/PluginEditor", () => ({
  default: ({ selectedPluginName }: { selectedPluginName: string }) => (
    <div data-testid="plugin-editor">PluginEditor {selectedPluginName}</div>
  ),
}));

function okJson(payload: unknown): Response {
  return {
    ok: true,
    json: vi.fn(async () => payload),
  } as unknown as Response;
}

function makeTrial(plugin = "plugin-dynamic") {
  return {
    id: 1,
    type: "trial",
    name: "Trial 1",
    plugin,
    parameters: {},
    trialCode: "",
  };
}

describe("ConfigurationPanel integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.selectedTrial = null;
    mocks.selectedLoop = null;
    mocks.plugins = [];
    mocks.metadataError = "";
    mocks.isSaving = false;
    mocks.updateTrial.mockResolvedValue(true);
    mocks.setPlugins.mockImplementation((nextPlugins: typeof mocks.plugins) => {
      mocks.plugins = nextPlugins;
    });
    globalThis.fetch = vi.fn(async (url: string) => {
      if (url === "http://localhost:3000/api/plugins-list") {
        return okJson({
          plugins: [
            "plugin-html-keyboard-response",
            "plugin-webgazer-calibrate",
          ],
        });
      }
      return okJson({});
    }) as unknown as typeof fetch;
  });

  it("shows the empty state and switches to loop configuration when a loop is selected", () => {
    const { rerender } = render(<ConfigurationPanel />);

    expect(
      screen.getByText("Select a trial from the timeline or add a new one"),
    ).toBeInTheDocument();

    mocks.selectedLoop = { id: "loop-1", name: "Practice Loop" };
    rerender(<ConfigurationPanel />);

    expect(screen.getByTestId("loop-config")).toHaveTextContent(
      "Practice Loop",
    );
  });

  it("switches from dynamic plugin config to a selected jsPsych plugin", async () => {
    mocks.selectedTrial = makeTrial("plugin-dynamic");

    render(<ConfigurationPanel />);

    expect(await screen.findByTestId("trials-config")).toHaveTextContent(
      "plugin-dynamic",
    );

    fireEvent.click(screen.getByLabelText("Toggle jsPsych plugins"));
    await waitFor(() => {
      expect(screen.getByLabelText("plugin select")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("plugin select"), {
      target: { value: "plugin-html-keyboard-response" },
    });

    expect(mocks.updateTrial).toHaveBeenCalledWith(1, {
      plugin: "plugin-html-keyboard-response",
    });
    expect(screen.getByTestId("trials-config")).toHaveTextContent(
      "plugin-html-keyboard-response",
    );
  });

  it("routes webgazer plugin choices to the Webgazer configuration", async () => {
    mocks.selectedTrial = makeTrial("plugin-dynamic");

    render(<ConfigurationPanel />);

    fireEvent.click(screen.getByLabelText("Toggle jsPsych plugins"));
    await waitFor(() => {
      expect(screen.getByLabelText("plugin select")).toBeInTheDocument();
    });
    fireEvent.change(screen.getByLabelText("plugin select"), {
      target: { value: "webgazer" },
    });

    expect(mocks.updateTrial).toHaveBeenCalledWith(1, { plugin: "webgazer" });
    expect(screen.getByTestId("webgazer-config")).toHaveTextContent(
      "plugin-webgazer-calibrate",
    );
  });

  it("renders uploaded plugin config and opens the plugin editor on demand", async () => {
    mocks.plugins = [
      {
        name: "plugin-custom",
        scripTag: "/plugins/plugin-custom.js",
        pluginCode: "class CustomPlugin {}",
        index: 0,
      },
    ];
    mocks.selectedTrial = makeTrial("plugin-custom");

    render(<ConfigurationPanel />);

    expect(await screen.findByTestId("trials-config")).toHaveTextContent(
      "plugin-custom",
    );
    fireEvent.click(screen.getByLabelText("toggle switch"));

    expect(screen.getByTestId("plugin-editor")).toHaveTextContent(
      "plugin-custom",
    );
  });

  it("creates a new plugin slot and assigns it to the selected trial", async () => {
    mocks.selectedTrial = makeTrial("plugin-dynamic");

    render(<ConfigurationPanel />);

    fireEvent.click(screen.getByLabelText("Toggle jsPsych plugins"));
    await waitFor(() => {
      expect(screen.getByLabelText("plugin select")).toBeInTheDocument();
    });
    fireEvent.change(screen.getByLabelText("plugin select"), {
      target: { value: "new-plugin" },
    });

    expect(mocks.setPlugins).toHaveBeenCalledWith([
      {
        name: "1",
        scripTag: "/plugins/1.js",
        pluginCode: "",
        index: 0,
      },
    ]);
    expect(mocks.updateTrial).toHaveBeenCalledWith(1, { plugin: "1" });
    expect(screen.getByTestId("plugin-editor")).toHaveTextContent("1");
  });

  it("skips fetch work while saving", () => {
    mocks.isSaving = true;
    mocks.selectedTrial = makeTrial("plugin-html-keyboard-response");

    render(<ConfigurationPanel />);

    expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(screen.getByTestId("trials-config")).toHaveTextContent(
      "plugin-dynamic",
    );
  });

  it("reports plugin list loading failures", async () => {
    mocks.selectedTrial = makeTrial("plugin-dynamic");
    globalThis.fetch = vi.fn(async () => {
      throw new Error("offline");
    }) as unknown as typeof fetch;

    render(<ConfigurationPanel />);

    await waitFor(() => {
      expect(mocks.setMetadataError).toHaveBeenCalledWith(
        expect.stringContaining("Could not load plugin list: Error: offline"),
      );
    });
  });

  it("handles metadata 404 and rejected metadata checks", async () => {
    mocks.selectedTrial = makeTrial("plugin-missing");
    globalThis.fetch = vi.fn(async (url: string) => {
      if (url === "http://localhost:3000/api/plugins-list") {
        return okJson({ plugins: ["plugin-missing"] });
      }
      return { status: 404, json: vi.fn(async () => ({})) } as unknown as Response;
    }) as unknown as typeof fetch;

    const { rerender } = render(<ConfigurationPanel />);

    await waitFor(() => {
      expect(mocks.setMetadataError).toHaveBeenCalledWith(
        "No valid info object in plugin-missing",
      );
    });

    vi.clearAllMocks();
    mocks.selectedTrial = makeTrial("plugin-rejected");
    globalThis.fetch = vi.fn(async (url: string) => {
      if (url === "http://localhost:3000/api/plugins-list") {
        return okJson({ plugins: ["plugin-rejected"] });
      }
      throw new Error("metadata offline");
    }) as unknown as typeof fetch;

    rerender(<ConfigurationPanel />);

    await waitFor(() => {
      expect(mocks.setMetadataError).toHaveBeenCalledWith(
        "No valid info object in plugin-rejected",
      );
    });
  });

  it("turns jsPsych plugin mode off and ignores null select changes", async () => {
    mocks.selectedTrial = makeTrial("plugin-html-keyboard-response");

    render(<ConfigurationPanel />);

    await waitFor(() => {
      expect(screen.getByLabelText("plugin select")).toBeInTheDocument();
      expect(screen.getByTestId("select-style-probe")).toHaveTextContent(
        "controlFocused",
      );
    });

    fireEvent.change(screen.getByLabelText("plugin select"), {
      target: { value: "" },
    });
    expect(mocks.updateTrial).not.toHaveBeenCalledWith(1, { plugin: "" });

    fireEvent.click(screen.getByLabelText("Toggle jsPsych plugins"));

    expect(mocks.updateTrial).toHaveBeenCalledWith(1, {
      plugin: "plugin-dynamic",
    });
  });

  it("opens plugin editor when selecting uploaded and custom plugin options", async () => {
    mocks.plugins = [
      {
        name: "plugin-custom",
        scripTag: "/plugins/plugin-custom.js",
        pluginCode: "class CustomPlugin {}",
        index: 0,
      },
    ];
    mocks.selectedTrial = makeTrial("plugin-dynamic");
    globalThis.fetch = vi.fn(async (url: string) => {
      if (url === "http://localhost:3000/api/plugins-list") {
        return okJson({ plugins: ["custom"] });
      }
      return okJson({});
    }) as unknown as typeof fetch;

    const { rerender } = render(<ConfigurationPanel />);

    fireEvent.click(screen.getByLabelText("Toggle jsPsych plugins"));
    await waitFor(() => {
      expect(screen.getByLabelText("plugin select")).toBeInTheDocument();
    });
    fireEvent.change(screen.getByLabelText("plugin select"), {
      target: { value: "plugin-custom" },
    });

    expect(mocks.updateTrial).toHaveBeenCalledWith(1, {
      plugin: "plugin-custom",
    });
    expect(screen.getByTestId("plugin-editor")).toHaveTextContent(
      "plugin-custom",
    );

    mocks.plugins = [];
    mocks.selectedTrial = makeTrial("plugin-dynamic");
    rerender(<ConfigurationPanel />);

    fireEvent.click(screen.getByLabelText("Toggle jsPsych plugins"));
    await waitFor(() => {
      expect(screen.getByLabelText("plugin select")).toBeInTheDocument();
    });
    fireEvent.change(screen.getByLabelText("plugin select"), {
      target: { value: "custom" },
    });

    expect(mocks.updateTrial).toHaveBeenCalledWith(1, { plugin: "custom" });
    expect(screen.queryByTestId("trials-config")).not.toBeInTheDocument();
  });

  it("increments new plugin names past existing numeric plugins", async () => {
    mocks.plugins = [
      { name: "1", scripTag: "/plugins/1.js", pluginCode: "", index: 0 },
      { name: "2", scripTag: "/plugins/2.js", pluginCode: "", index: 1 },
    ];
    mocks.selectedTrial = makeTrial("plugin-dynamic");

    render(<ConfigurationPanel />);

    fireEvent.click(screen.getByLabelText("Toggle jsPsych plugins"));
    await waitFor(() => {
      expect(screen.getByLabelText("plugin select")).toBeInTheDocument();
    });
    fireEvent.change(screen.getByLabelText("plugin select"), {
      target: { value: "new-plugin" },
    });

    expect(mocks.setPlugins).toHaveBeenCalledWith([
      { name: "1", scripTag: "/plugins/1.js", pluginCode: "", index: 0 },
      { name: "2", scripTag: "/plugins/2.js", pluginCode: "", index: 1 },
      {
        name: "3",
        scripTag: "/plugins/3.js",
        pluginCode: "",
        index: 2,
      },
    ]);
    expect(mocks.updateTrial).toHaveBeenCalledWith(1, { plugin: "3" });
  });

  it("exposes a webgazer option for uploaded webgazer plugins", async () => {
    mocks.plugins = [
      {
        name: "plugin-webgazer-custom",
        scripTag: "/plugins/plugin-webgazer-custom.js",
        pluginCode: "",
        index: 0,
      },
    ];
    mocks.selectedTrial = makeTrial("plugin-dynamic");
    globalThis.fetch = vi.fn(async (url: string) => {
      if (url === "http://localhost:3000/api/plugins-list") {
        return okJson({ plugins: [] });
      }
      return okJson({});
    }) as unknown as typeof fetch;

    render(<ConfigurationPanel />);

    fireEvent.click(screen.getByLabelText("Toggle jsPsych plugins"));

    await waitFor(() => {
      expect(screen.getByRole("option", { name: "webgazer" })).toBeInTheDocument();
    });
  });

  it("falls back to an empty plugin list when the response omits plugins", async () => {
    mocks.selectedTrial = makeTrial("plugin-dynamic");
    globalThis.fetch = vi.fn(async (url: string) => {
      if (url === "http://localhost:3000/api/plugins-list") {
        return okJson({});
      }
      return okJson({});
    }) as unknown as typeof fetch;

    render(<ConfigurationPanel />);

    fireEvent.click(screen.getByLabelText("Toggle jsPsych plugins"));

    await waitFor(() => {
      expect(screen.getByRole("option", { name: "Create plugin" })).toBeInTheDocument();
    });
    expect(screen.queryByRole("option", { name: "html keyboard response" }))
      .not.toBeInTheDocument();
  });

  it("renders the plugin editor when the selected trial already has new-plugin", async () => {
    mocks.selectedTrial = makeTrial("new-plugin");

    render(<ConfigurationPanel />);

    expect(await screen.findByTestId("plugin-editor")).toHaveTextContent(
      "new-plugin",
    );
  });

  it("disables custom plugin editing for metadata 404 and shows metadata errors", async () => {
    mocks.plugins = [
      {
        name: "plugin-custom",
        scripTag: "/plugins/plugin-custom.js",
        pluginCode: "",
        index: 0,
      },
    ];
    mocks.selectedTrial = makeTrial("plugin-custom");
    globalThis.fetch = vi.fn(async (url: string) => {
      if (url === "http://localhost:3000/api/plugins-list") {
        return okJson({ plugins: ["plugin-custom"] });
      }
      return { status: 404, json: vi.fn(async () => ({})) } as unknown as Response;
    }) as unknown as typeof fetch;

    const { rerender } = render(<ConfigurationPanel />);

    await waitFor(() => {
      expect(screen.getByLabelText("toggle switch")).toBeDisabled();
    });

    mocks.metadataError = "Metadata failed";
    rerender(<ConfigurationPanel />);

    expect(screen.getByText(/Metadata failed/)).toBeInTheDocument();
    expect(screen.getByTestId("plugin-editor")).toHaveTextContent(
      "plugin-custom",
    );
  });
});
