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
  }: {
    options: Array<{ value: string; label: string }>;
    value: { value: string; label: string } | null;
    onChange: (option: { value: string; label: string } | null) => void;
    placeholder: string;
  }) => (
    <select
      aria-label="plugin select"
      value={value?.value ?? ""}
      onChange={(event) =>
        onChange(
          options.find((option) => option.value === event.target.value) ?? null,
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
  ),
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
});
