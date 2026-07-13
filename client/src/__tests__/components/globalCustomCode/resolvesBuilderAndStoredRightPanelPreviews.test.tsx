import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import GlobalCustomCode, {
  PreviewTabs,
  resolveRightPreviewValue,
} from "../../../pages/ExperimentBuilder/components/GlobalCustomCode";

const mocks = vi.hoisted(() => ({
  setCustomInitJsPsychParam: vi.fn(),
  setCustomPreInitCode: vi.fn(),
  setupMonacoJsPsychContext: vi.fn(),
  updateCustomPluginContext: vi.fn(),
  revealLine: vi.fn(),
  devMode: {
    customInitJsPsychParams: {
      local: {
        on_finish: "console.log('local finish')",
        display_element: "display",
      },
      public: {
        on_trial_start: "console.log('public start')",
      },
    },
    customPreInitCode: {
      local: "window.localPre = true;",
      public: "window.publicPre = true;",
    },
  },
  plugins: [{ name: "plugin-custom" }],
  canvasStyles: { progressBar: true } as { progressBar?: boolean } | undefined,
  experimentID: "experiment-1" as string | undefined,
  readonlyModelMissing: false,
}));

vi.mock("@monaco-editor/react", () => ({
  default: ({
    value,
    defaultValue,
    onChange,
    onMount,
    options,
  }: {
    value?: string;
    defaultValue?: string;
    onChange?: (value?: string) => void;
    onMount?: (editor: any, monaco: any) => void;
    options?: { readOnly?: boolean };
  }) => {
    onMount?.(
      {
        getModel: () =>
          options?.readOnly && mocks.readonlyModelMissing
            ? null
            : { getLineCount: () => 7 },
        revealLine: mocks.revealLine,
      },
      {},
    );
    return (
      <>
        <textarea
          aria-label={options?.readOnly ? "readonly editor" : "editable editor"}
          readOnly={options?.readOnly}
          value={value ?? defaultValue ?? ""}
          onChange={(event) => onChange?.(event.target.value)}
        />
        {!options?.readOnly && (
          <button type="button" onClick={() => onChange?.(undefined)}>
            Clear editor value
          </button>
        )}
      </>
    );
  },
}));

vi.mock("monaco-editor", () => ({}));

vi.mock(
  "../../../pages/ExperimentBuilder/components/monacoJsPsychContext",
  () => ({
    setupMonacoJsPsychContext: mocks.setupMonacoJsPsychContext,
    updateCustomPluginContext: mocks.updateCustomPluginContext,
  }),
);

vi.mock("../../../pages/ExperimentBuilder/hooks/useDevMode", () => ({
  default: () => ({
    customInitJsPsychParams: mocks.devMode.customInitJsPsychParams,
    setCustomInitJsPsychParam: mocks.setCustomInitJsPsychParam,
    customPreInitCode: mocks.devMode.customPreInitCode,
    setCustomPreInitCode: mocks.setCustomPreInitCode,
  }),
}));

vi.mock("../../../pages/ExperimentBuilder/hooks/usePlugins", () => ({
  default: () => ({ plugins: mocks.plugins }),
}));

vi.mock("../../../pages/ExperimentBuilder/hooks/useCanvasStyles", () => ({
  default: () => ({ canvasStyles: mocks.canvasStyles }),
}));

vi.mock("../../../pages/ExperimentBuilder/hooks/useExperimentID", () => ({
  useExperimentID: () => mocks.experimentID,
}));

describe("GlobalCustomCode", () => {
  beforeEach(() => {
    mocks.devMode = {
      customInitJsPsychParams: {
        local: {
          on_finish: "console.log('local finish')",
          display_element: "display",
        },
        public: {
          on_trial_start: "console.log('public start')",
        },
      },
      customPreInitCode: {
        local: "window.localPre = true;",
        public: "window.publicPre = true;",
      },
    };
    mocks.plugins = [{ name: "plugin-custom" }];
    mocks.canvasStyles = { progressBar: true };
    mocks.experimentID = "experiment-1";
    mocks.readonlyModelMissing = false;
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("resolves builder and stored right-panel previews", () => {
    const base = {
      eid: "experiment-1",
      liveValue: "live value",
      localParams: { custom: "local saved" },
      publicParams: { custom: "public saved" },
      activeParam: "custom",
    };
    const customParam = {
      key: "custom",
      description: "Custom",
      type: "value",
    } as any;

    expect(
      resolveRightPreviewValue({
        ...base,
        param: customParam,
        previewVariant: "local",
        editVariant: "public",
      }),
    ).toBe("local saved");
    expect(
      resolveRightPreviewValue({
        ...base,
        param: customParam,
        previewVariant: "public",
        editVariant: "public",
      }),
    ).toBe("live value");
    expect(
      resolveRightPreviewValue({
        ...base,
        param: customParam,
        previewVariant: "public",
        publicParams: {},
        editVariant: "local",
      }),
    ).toContain("No user code for this param in public");

    const builderParam = {
      key: "on_finish",
      description: "Finish",
      type: "function",
      builderUsed: { local: true, public: true },
    } as any;
    expect(
      resolveRightPreviewValue({
        ...base,
        param: builderParam,
        activeParam: "on_finish",
        previewVariant: "local",
        editVariant: "local",
      }),
    ).toContain("on_finish");
    expect(
      resolveRightPreviewValue({
        ...base,
        param: builderParam,
        activeParam: "on_finish",
        previewVariant: "public",
        editVariant: "local",
      }),
    ).toContain("on_finish");
  });

  it("renders labeled preview tabs and reports tab changes", () => {
    const onChange = vi.fn();
    render(
      <PreviewTabs
        value="local"
        onChange={onChange}
        isLightMode
        borderColor="#ddd"
        panelHeaderBg="#fff"
        panelHeaderColor="#333"
      />,
    );

    expect(screen.getByText("preview")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Public" }));
    expect(onChange).toHaveBeenCalledWith("public");
  });

  it("edits initJsPsych params and switches builder previews", () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({ matches: true })),
    );

    render(<GlobalCustomCode />);

    expect(mocks.updateCustomPluginContext).toHaveBeenCalledWith(
      expect.anything(),
      ["plugin-custom"],
    );

    fireEvent.click(screen.getByRole("button", { name: "initJsPsych" }));
    expect(screen.getByText(/progress bar on/)).toBeInTheDocument();
    expect(screen.getByText(/Builder-managed/)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("editable editor"), {
      target: { value: "console.log('edited finish')" },
    });
    expect(mocks.setCustomInitJsPsychParam).toHaveBeenCalledWith(
      "local",
      "on_finish",
      "console.log('edited finish')",
    );

    fireEvent.click(screen.getAllByRole("button", { name: "Public" })[0]);
    expect(
      (screen.getByLabelText("readonly editor") as HTMLTextAreaElement).value,
    ).toContain("edited finish");

    fireEvent.click(screen.getByRole("button", { name: "on_trial_finish" }));
    expect(screen.getByText(/value added as key/)).toBeInTheDocument();
    expect(screen.queryByText(/Builder-managed/)).not.toBeInTheDocument();
  });

  it("clears undefined editor values and handles a missing readonly model", () => {
    mocks.readonlyModelMissing = true;
    render(<GlobalCustomCode />);

    fireEvent.click(screen.getByRole("button", { name: "initJsPsych" }));
    fireEvent.click(screen.getByRole("button", { name: "Clear editor value" }));

    expect(mocks.setCustomInitJsPsychParam).toHaveBeenCalledWith(
      "local",
      "on_finish",
      "",
    );
    expect(mocks.revealLine).toHaveBeenCalledWith(1);

    fireEvent.click(screen.getByRole("button", { name: "×" }));
    fireEvent.click(screen.getByRole("button", { name: "Before initJsPsych" }));
    fireEvent.click(screen.getByRole("button", { name: "Clear editor value" }));

    expect(mocks.setCustomPreInitCode).toHaveBeenCalledWith("local", "");
  });
});
