import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import GlobalCustomCode from "../../../pages/ExperimentBuilder/components/GlobalCustomCode";

type MonacoEditorStub = {
  getModel: () => { getLineCount: () => number } | null;
  revealLine: (line: number) => void;
};

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
    onMount?: (editor: MonacoEditorStub, monaco: unknown) => void;
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

  it("renders empty dark-state fallbacks and local preview for public-only builder params", () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({ matches: false })),
    );
    mocks.devMode = {
      customInitJsPsychParams: { local: {}, public: {} },
      customPreInitCode: { local: undefined as unknown as string, public: "" },
    };
    mocks.plugins = [];
    mocks.canvasStyles = undefined;
    mocks.experimentID = undefined;

    render(<GlobalCustomCode />);

    expect(mocks.updateCustomPluginContext).toHaveBeenCalledWith(
      expect.anything(),
      [],
    );

    fireEvent.click(screen.getByRole("button", { name: "initJsPsych" }));
    expect(screen.queryByText(/progress bar on/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /on_trial_start/ }));
    expect(
      (screen.getByLabelText("readonly editor") as HTMLTextAreaElement).value,
    ).toContain("No user code for this param in local");

    fireEvent.click(screen.getAllByRole("button", { name: "Public" })[0]);
    expect(
      (screen.getByLabelText("readonly editor") as HTMLTextAreaElement).value,
    ).toContain("prev_response");

    fireEvent.click(screen.getByRole("button", { name: "Before initJsPsych" }));
    expect(screen.getAllByLabelText("editable editor")[1]).toHaveValue("");
  });

  it("edits before-init code and closes modals", () => {
    render(<GlobalCustomCode />);

    fireEvent.click(screen.getByRole("button", { name: "Before initJsPsych" }));
    expect(screen.getByText(/inside async IIFE/)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("editable editor"), {
      target: { value: "window.before = true;" },
    });
    expect(mocks.setCustomPreInitCode).toHaveBeenCalledWith(
      "local",
      "window.before = true;",
    );

    fireEvent.click(screen.getAllByRole("button", { name: "Public" })[0]);
    expect(
      (screen.getByLabelText("readonly editor") as HTMLTextAreaElement).value,
    ).toContain("window.before = true;");

    fireEvent.click(screen.getByRole("button", { name: "×" }));
    expect(screen.queryByText(/inside async IIFE/)).not.toBeInTheDocument();
  });

  it("marks initJsPsych as configured when only public params contain code", () => {
    mocks.devMode = {
      customInitJsPsychParams: {
        local: { on_finish: "" },
        public: { on_trial_start: "console.log('public only')" },
      },
      customPreInitCode: { local: "", public: "" },
    };

    render(<GlobalCustomCode />);

    expect(screen.getByRole("button", { name: "initJsPsych" })).toHaveStyle({
      color: "#fff",
    });
  });
});
