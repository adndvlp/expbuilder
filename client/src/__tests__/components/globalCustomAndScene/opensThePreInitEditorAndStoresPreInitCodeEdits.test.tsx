import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import GlobalCustomCode from "../../../pages/ExperimentBuilder/components/GlobalCustomCode";

const mocks = vi.hoisted(() => ({
  plugins: [{ name: "custom-plugin" }],
  setCustomInitJsPsychParam: vi.fn(),
  setCustomPreInitCode: vi.fn(),
  updateCustomPluginContext: vi.fn(),
  setupMonacoJsPsychContext: vi.fn(),
  editorMounts: [] as any[],
  devMode: {
    customInitJsPsychParams: {
      local: {
        on_data_update: "data.existing = true;",
      } as Record<string, string>,
      public: {
        on_finish: "window.publicDone = true;",
      } as Record<string, string>,
    },
    customPreInitCode: {
      local: "window.preExisting = true;",
      public: "",
    },
    setCustomInitJsPsychParam: vi.fn(),
    setCustomPreInitCode: vi.fn(),
  },
}));

vi.mock("@monaco-editor/react", () => ({
  default: ({ value, defaultValue, onChange, onMount, options }: any) => {
    const readOnly = Boolean(options?.readOnly);
    const text = value ?? defaultValue ?? "";
    const mountPayload = {
      getModel: () => ({ getLineCount: () => String(text).split("\n").length }),
      revealLine: vi.fn(),
    };
    mocks.editorMounts.push({ readOnly, text, mountPayload });
    onMount?.(mountPayload, { languages: {} });

    return (
      <textarea
        aria-label={readOnly ? "Monaco readonly editor" : "Monaco editor"}
        readOnly={readOnly}
        value={text}
        onChange={(event) => onChange?.(event.target.value)}
      />
    );
  },
  Editor: ({ value, defaultValue, onChange, onMount, options }: any) => {
    const readOnly = Boolean(options?.readOnly);
    const text = value ?? defaultValue ?? "";
    const mountPayload = {
      getModel: () => ({ getLineCount: () => String(text).split("\n").length }),
      revealLine: vi.fn(),
    };
    mocks.editorMounts.push({ readOnly, text, mountPayload });
    onMount?.(mountPayload, { languages: {} });

    return (
      <textarea
        aria-label={readOnly ? "Monaco readonly editor" : "Monaco editor"}
        readOnly={readOnly}
        value={text}
        onChange={(event) => onChange?.(event.target.value)}
      />
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
    ...mocks.devMode,
    setCustomInitJsPsychParam: mocks.setCustomInitJsPsychParam,
    setCustomPreInitCode: mocks.setCustomPreInitCode,
  }),
}));

vi.mock("../../../pages/ExperimentBuilder/hooks/usePlugins", () => ({
  default: () => ({ plugins: mocks.plugins }),
}));

vi.mock("../../../pages/ExperimentBuilder/hooks/useCanvasStyles", () => ({
  default: () => ({
    canvasStyles: {
      width: 1024,
      height: 768,
      backgroundColor: "#ffffff",
      fullScreen: true,
      progressBar: true,
    },
  }),
}));

vi.mock("../../../pages/ExperimentBuilder/hooks/useExperimentID", () => ({
  useExperimentID: () => "exp-1",
}));

describe("GlobalCustomCode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.editorMounts = [];
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn(() => ({
        matches: true,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("opens the pre-init editor and stores pre-init code edits", async () => {
    render(<GlobalCustomCode />);

    fireEvent.click(screen.getByRole("button", { name: "Before initJsPsych" }));

    expect(screen.getAllByText("Before initJsPsych")).toHaveLength(2);
    expect(screen.getByText(/inside async IIFE/)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Monaco editor"), {
      target: { value: "window.before = true;" },
    });

    expect(mocks.setCustomPreInitCode).toHaveBeenCalledWith(
      "local",
      "window.before = true;",
    );

    await waitFor(() => {
      expect(
        (screen.getByLabelText("Monaco readonly editor") as HTMLTextAreaElement)
          .value,
      ).toContain("window.before = true;");
    });

    fireEvent.click(screen.getByRole("button", { name: "Public" }));

    await waitFor(() => {
      expect(
        (screen.getByLabelText("Monaco readonly editor") as HTMLTextAreaElement)
          .value,
      ).toContain("window.before = true;");
    });
  });
});
