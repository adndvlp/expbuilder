import { editorHarness } from "./testHarness";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CodeEditor from "../../../pages/ExperimentBuilder/components/CodeEditor";
import {
  setupMonacoJsPsychContext,
  updateCustomPluginContext,
} from "../../../pages/ExperimentBuilder/components/monacoJsPsychContext";

describe("coverage editor: Monaco context and code editor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    editorHarness.modelChange = undefined;
    editorHarness.monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions =
      vi.fn();
    editorHarness.monaco.languages.typescript.javascriptDefaults.setCompilerOptions =
      vi.fn();
    editorHarness.monaco.languages.typescript.javascriptDefaults.addExtraLib =
      vi.fn();
    editorHarness.editor = {
      addCommand: vi.fn(),
      trigger: vi.fn(),
      onDidChangeModelContent: vi.fn((callback: () => void) => {
        editorHarness.modelChange = callback;
      }),
      getValue: vi.fn(() => "const saved = true;"),
    };
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn(() => ({
        matches: false,
        addEventListener: vi.fn((_event, callback) => {
          editorHarness.mediaListener = callback;
        }),
        removeEventListener: vi.fn(),
      })),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("registers jsPsych typings and custom plugin globals", () => {
    updateCustomPluginContext(editorHarness.monaco, [
      "plugin-html-keyboard-response",
      "custom-trial",
    ]);
    expect(
      editorHarness.monaco.languages.typescript.javascriptDefaults.addExtraLib,
    ).toHaveBeenCalledWith(
      expect.stringContaining("jsPsychPluginHtmlKeyboardResponse"),
      "ts:jspsych-custom-plugins.d.ts",
    );
    expect(
      editorHarness.monaco.languages.typescript.javascriptDefaults.addExtraLib,
    ).toHaveBeenCalledWith(
      expect.stringContaining("jsPsychCustomTrial"),
      "ts:jspsych-custom-plugins.d.ts",
    );

    updateCustomPluginContext(editorHarness.monaco, []);
    expect(
      editorHarness.monaco.languages.typescript.javascriptDefaults.addExtraLib,
    ).toHaveBeenCalledWith(
      "// no custom plugins loaded",
      "ts:jspsych-custom-plugins.d.ts",
    );

    setupMonacoJsPsychContext(editorHarness.monaco);
    setupMonacoJsPsychContext(editorHarness.monaco);
    expect(
      editorHarness.monaco.languages.typescript.javascriptDefaults
        .setDiagnosticsOptions,
    ).toHaveBeenCalledWith({
      noSemanticValidation: false,
      noSyntaxValidation: false,
    });
    expect(
      editorHarness.monaco.languages.typescript.javascriptDefaults
        .setCompilerOptions,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        checkJs: true,
        target: "ESNext",
      }),
    );
  });

  it("mounts Monaco, handles undo/redo commands and debounced saves", () => {
    render(<CodeEditor />);

    expect(screen.getByText("Editor vs-dark")).toBeInTheDocument();
    act(() => {
      editorHarness.mediaListener?.({ matches: true });
    });
    expect(screen.getByText("Editor vs-light")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Editor vs-light"));

    expect(editorHarness.editor.addCommand).toHaveBeenCalledTimes(2);
    editorHarness.editor.addCommand.mock.calls[0][1]();
    editorHarness.editor.addCommand.mock.calls[1][1]();
    expect(editorHarness.editor.trigger).toHaveBeenCalledWith(
      "keyboard",
      "undo",
      null,
    );
    expect(editorHarness.editor.trigger).toHaveBeenCalledWith(
      "keyboard",
      "redo",
      null,
    );

    act(() => {
      editorHarness.modelChange?.();
      editorHarness.modelChange?.();
      vi.advanceTimersByTime(1000);
    });
    expect(editorHarness.setCode).toHaveBeenCalledWith("const saved = true;");
    expect(screen.getByText("Saved Code")).toHaveStyle({ opacity: "1" });

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(screen.getByText("Saved Code")).toHaveStyle({ opacity: "0" });
  });

  it("unmounts the code editor before any debounced change exists", () => {
    const { unmount } = render(<CodeEditor />);

    unmount();

    expect(editorHarness.setCode).not.toHaveBeenCalled();
  });
});
