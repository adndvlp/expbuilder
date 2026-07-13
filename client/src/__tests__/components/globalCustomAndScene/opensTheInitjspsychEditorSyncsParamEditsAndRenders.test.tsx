import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
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

  it("opens the initJsPsych editor, syncs param edits and renders builder previews", async () => {
    render(<GlobalCustomCode />);

    expect(mocks.updateCustomPluginContext).toHaveBeenCalledWith(
      expect.anything(),
      ["custom-plugin"],
    );

    fireEvent.click(screen.getByRole("button", { name: "initJsPsych" }));

    expect(screen.getByText(/progress bar on/)).toBeInTheDocument();
    expect(screen.getByText(/Builder-managed/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^on_trial_start/ }));
    expect(
      (screen.getByLabelText("Monaco readonly editor") as HTMLTextAreaElement)
        .value,
    ).toContain("// No user code for this param in local");

    fireEvent.click(screen.getByRole("button", { name: "Public" }));
    await waitFor(() => {
      expect(
        (screen.getByLabelText("Monaco readonly editor") as HTMLTextAreaElement)
          .value,
      ).toContain("on_trial_start");
    });

    fireEvent.click(screen.getByRole("button", { name: /^on_finish\b/ }));

    const editable = screen.getByLabelText("Monaco editor");
    fireEvent.change(editable, {
      target: { value: "data.updated = true;" },
    });

    expect(mocks.setCustomInitJsPsychParam).toHaveBeenCalledWith(
      "local",
      "on_finish",
      "data.updated = true;",
    );

    fireEvent.click(screen.getByRole("button", { name: /^on_data_update\b/ }));
    fireEvent.change(screen.getByLabelText("Monaco editor"), {
      target: { value: "data.updated = true;" },
    });

    expect(mocks.setCustomInitJsPsychParam).toHaveBeenCalledWith(
      "local",
      "on_data_update",
      "data.updated = true;",
    );

    fireEvent.click(screen.getByRole("button", { name: "Local" }));

    await waitFor(() => {
      expect(
        (screen.getByLabelText("Monaco readonly editor") as HTMLTextAreaElement)
          .value,
      ).toContain("data.updated = true;");
    });

    expect(mocks.setupMonacoJsPsychContext).toHaveBeenCalled();
  });

  it("runs save timers and closes init/pre-init modals from controls and backdrop", () => {
    vi.useFakeTimers();
    render(<GlobalCustomCode />);

    fireEvent.click(screen.getByRole("button", { name: "initJsPsych" }));
    fireEvent.change(screen.getByLabelText("Monaco editor"), {
      target: { value: "data.timer = true;" },
    });

    act(() => {
      vi.advanceTimersByTime(1200);
    });
    expect(screen.getByText("✓ Saved")).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(1500);
    });

    const initOverlay = Array.from(document.body.children).find(
      (child) => (child as HTMLElement).style.position === "fixed",
    ) as HTMLElement;
    fireEvent.keyDown(initOverlay.firstElementChild as Element, {
      key: "Escape",
    });
    fireEvent.click(screen.getByRole("button", { name: "×" }));
    expect(screen.queryByText(/progress bar on/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "initJsPsych" }));
    const initBackdrop = Array.from(document.body.children).find(
      (child) => (child as HTMLElement).style.position === "fixed",
    ) as HTMLElement;
    fireEvent.click(initBackdrop);
    expect(screen.queryByText(/progress bar on/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Before initJsPsych" }));
    const preInitOverlay = Array.from(document.body.children).find(
      (child) => (child as HTMLElement).style.position === "fixed",
    ) as HTMLElement;
    fireEvent.keyDown(preInitOverlay.firstElementChild as Element, {
      key: "Escape",
    });
    fireEvent.click(screen.getByRole("button", { name: "×" }));
    expect(screen.queryByText(/inside async IIFE/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Before initJsPsych" }));
    const preInitBackdrop = Array.from(document.body.children).find(
      (child) => (child as HTMLElement).style.position === "fixed",
    ) as HTMLElement;
    fireEvent.change(screen.getByLabelText("Monaco editor"), {
      target: { value: "window.preTimer = true;" },
    });
    act(() => {
      vi.advanceTimersByTime(1200);
    });
    expect(screen.getByText("✓ Saved")).toHaveStyle({ opacity: "1" });
    fireEvent.click(preInitBackdrop);
    expect(screen.queryByText(/inside async IIFE/)).not.toBeInTheDocument();

    vi.useRealTimers();
  });
});
