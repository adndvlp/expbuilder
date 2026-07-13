import { vi } from "vitest";

const hoistedMocks = vi.hoisted(() => ({
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

vi.mock("../../../pages/ExperimentBuilder/hooks/useTrials", () => ({
  default: () => ({
    selectedTrial: hoistedMocks.selectedTrial,
    selectedLoop: hoistedMocks.selectedLoop,
    updateTrial: hoistedMocks.updateTrial,
  }),
}));

vi.mock("../../../pages/ExperimentBuilder/hooks/usePlugins", () => ({
  default: () => ({
    isSaving: hoistedMocks.isSaving,
    plugins: hoistedMocks.plugins,
    metadataError: hoistedMocks.metadataError,
    setPlugins: hoistedMocks.setPlugins,
    setMetadataError: hoistedMocks.setMetadataError,
  }),
}));

vi.mock("react-switch", () => ({
  default: ({ checked, onChange, disabled, "aria-label": ariaLabel }: any) => (
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
  default: ({ options, value, onChange, placeholder, styles }: any) => {
    const styleProbe = {
      controlFocused: styles?.control?.({}, { isFocused: true }),
      controlBlurred: styles?.control?.({}, { isFocused: false }),
      singleValue: styles?.singleValue?.({}),
      menu: styles?.menu?.({}),
      optionFocused: styles?.option?.(
        {},
        { isFocused: true, isSelected: true },
      ),
      optionBlurred: styles?.option?.(
        {},
        { isFocused: false, isSelected: false },
      ),
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
              options.find(
                (option: any) => option.value === event.target.value,
              ) ?? null,
            )
          }
        >
          <option value="">{placeholder}</option>
          {options.map((option: any) => (
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
  "../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration",
  () => ({
    default: ({ pluginName }: { pluginName: string }) => (
      <div data-testid="trials-config">TrialsConfig {pluginName}</div>
    ),
  }),
);
vi.mock(
  "../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/Webgazer",
  () => ({
    default: ({ webgazerPlugins }: { webgazerPlugins: string[] }) => (
      <div data-testid="webgazer-config">{webgazerPlugins.join(",")}</div>
    ),
  }),
);
vi.mock(
  "../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/LoopsConfiguration",
  () => ({
    default: ({ loop }: { loop: { id: string; name: string } }) => (
      <div data-testid="loop-config">LoopConfig {loop.name}</div>
    ),
  }),
);
vi.mock("../../../pages/ExperimentBuilder/components/PluginEditor", () => ({
  default: ({ selectedPluginName }: { selectedPluginName: string }) => (
    <div data-testid="plugin-editor">PluginEditor {selectedPluginName}</div>
  ),
}));

export function okJson(payload: unknown): Response {
  return { ok: true, json: vi.fn(async () => payload) } as unknown as Response;
}

export function makeTrial(plugin = "plugin-dynamic") {
  return {
    id: 1,
    type: "trial",
    name: "Trial 1",
    plugin,
    parameters: {},
    trialCode: "",
  };
}

export function resetPanelMocks() {
  vi.clearAllMocks();
  hoistedMocks.selectedTrial = null;
  hoistedMocks.selectedLoop = null;
  hoistedMocks.plugins = [];
  hoistedMocks.metadataError = "";
  hoistedMocks.isSaving = false;
  hoistedMocks.updateTrial.mockResolvedValue(true);
  hoistedMocks.setPlugins.mockImplementation(
    (nextPlugins: typeof hoistedMocks.plugins) => {
      hoistedMocks.plugins = nextPlugins;
    },
  );
  globalThis.fetch = vi.fn(async (url: string) =>
    url === "http://localhost:3000/api/plugins-list"
      ? okJson({
          plugins: [
            "plugin-html-keyboard-response",
            "plugin-webgazer-calibrate",
          ],
        })
      : okJson({}),
  ) as unknown as typeof fetch;
}

const mocks = hoistedMocks;
export { mocks };
