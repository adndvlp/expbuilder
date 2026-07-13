import { act, fireEvent, render, renderHook, screen } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CodeEditor from "../../pages/ExperimentBuilder/components/CodeEditor";
import {
  setupMonacoJsPsychContext,
  updateCustomPluginContext,
} from "../../pages/ExperimentBuilder/components/monacoJsPsychContext";
import CanvasContextMenu from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/CanvasContextMenu";
import TextEditingOverlay from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/TextEditingOverlay";
import useHandleResize from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/useHandleResize";
import type { TrialComponent } from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/types";

const editorHarness = vi.hoisted(() => ({
  editorProps: undefined as any,
  editor: undefined as any,
  monaco: {
    KeyMod: { CtrlCmd: 1, Shift: 2 },
    KeyCode: { KeyZ: 4 },
    languages: {
      typescript: {
        ScriptTarget: { ESNext: "ESNext" },
        javascriptDefaults: {
          setDiagnosticsOptions: vi.fn(),
          setCompilerOptions: vi.fn(),
          addExtraLib: vi.fn(),
        },
      },
    },
  } as any,
  modelChange: undefined as undefined | (() => void),
  setCode: vi.fn(),
  mediaListener: undefined as undefined | ((event: { matches: boolean }) => void),
}));

vi.mock("@monaco-editor/react", async () => {
  const React = await vi.importActual<typeof import("react")>("react");
  return {
    default: (props: any) => {
      editorHarness.editorProps = props;
      return React.createElement(
        "button",
        {
          type: "button",
          onClick: () => props.onMount(editorHarness.editor, editorHarness.monaco),
        },
        `Editor ${props.theme}`,
      );
    },
  };
});

vi.mock("monaco-editor", () => editorHarness.monaco);

vi.mock("../../pages/ExperimentBuilder/hooks/useDevMode", () => ({
  default: () => ({
    code: "const start = true;",
    setCode: editorHarness.setCode,
  }),
}));

vi.mock("../../pages/ExperimentBuilder/hooks/usePlugins", () => ({
  default: () => ({
    plugins: [{ name: "plugin-html-keyboard-response" }],
  }),
}));

function textComponent(overrides: Partial<TrialComponent> = {}): TrialComponent {
  return {
    id: "text-1",
    type: "TextComponent",
    x: 120,
    y: 80,
    width: 160,
    height: 80,
    rotation: 15,
    zIndex: 1,
    config: {
      text: { source: "typed", value: "Hello" },
      font_size: { source: "typed", value: 20 },
      background_color: { source: "typed", value: "transparent" },
    },
    ...overrides,
  } as TrialComponent;
}

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

describe("coverage designer small components", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("runs context menu actions, respects disabled items and closes after actions", () => {
    const actions = {
      onCopy: vi.fn(),
      onCut: vi.fn(),
      onPaste: vi.fn(),
      onDelete: vi.fn(),
      onSelectAll: vi.fn(),
      onUndo: vi.fn(),
      onClose: vi.fn(),
    };
    const { container, rerender } = render(
      <CanvasContextMenu
        state={null}
        canCopy={false}
        canPaste={false}
        canUndo={false}
        hasComponents={false}
        {...actions}
      />,
    );
    expect(container).toBeEmptyDOMElement();

    rerender(
      <CanvasContextMenu
        state={{ x: 40, y: 50 }}
        canCopy={false}
        canPaste
        canUndo={false}
        hasComponents
        {...actions}
      />,
    );
    expect(screen.getByRole("menu", { name: "Canvas actions" })).toBeInTheDocument();
    const disabledCopy = screen.getByRole("menuitem", { name: /Copy/ });
    expect(disabledCopy).toBeDisabled();
    fireEvent.mouseEnter(disabledCopy);

    const paste = screen.getByRole("menuitem", { name: /Paste/ });
    fireEvent.mouseEnter(paste);
    expect(paste).toHaveStyle({ background: "#e5edf8" });
    fireEvent.mouseLeave(paste);
    fireEvent.click(paste);
    expect(actions.onPaste).toHaveBeenCalled();
    expect(actions.onClose).toHaveBeenCalled();

    rerender(
      <CanvasContextMenu
        state={{ x: 40, y: 50 }}
        canCopy
        canPaste
        canUndo
        hasComponents
        {...actions}
      />,
    );
    const menu = screen.getByRole("menu", { name: "Canvas actions" });
    fireEvent.contextMenu(menu);
    fireEvent.mouseDown(menu);
    fireEvent.click(screen.getByRole("menuitem", { name: /Copy/ }));
    fireEvent.click(screen.getByRole("menuitem", { name: /Cut/ }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Delete" }));
    fireEvent.click(screen.getByRole("menuitem", { name: /Undo/ }));
    fireEvent.click(screen.getByRole("menuitem", { name: /Select All/ }));
    expect(actions.onCopy).toHaveBeenCalled();
    expect(actions.onCut).toHaveBeenCalled();
    expect(actions.onDelete).toHaveBeenCalled();
    expect(actions.onUndo).toHaveBeenCalled();
    expect(actions.onSelectAll).toHaveBeenCalled();
  });

  it("commits, cancels and hides the text editing overlay for unsupported components", async () => {
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      callback(0);
      return 1;
    });
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
    const onCommit = vi.fn();
    const onCancel = vi.fn();
    const { rerender, container } = render(
      <TextEditingOverlay
        component={null}
        stageScale={1}
        canvasWidth={640}
        onCommit={onCommit}
        onCancel={onCancel}
      />,
    );
    expect(container).toBeEmptyDOMElement();

    rerender(
      <TextEditingOverlay
        component={textComponent()}
        stageScale={2}
        canvasWidth={640}
        onCommit={onCommit}
        onCancel={onCancel}
      />,
    );
    const textarea = await screen.findByDisplayValue("Hello");
    fireEvent.change(textarea, { target: { value: "Updated" } });
    fireEvent.keyDown(textarea, { key: "Enter", ctrlKey: true });
    fireEvent.blur(textarea);
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith("Updated");

    rerender(
      <TextEditingOverlay
        component={textComponent({ id: "text-2" })}
        stageScale={1}
        canvasWidth={640}
        onCommit={onCommit}
        onCancel={onCancel}
      />,
    );
    const secondTextarea = await screen.findByDisplayValue("Hello");
    fireEvent.keyDown(secondTextarea, { key: "Escape" });
    fireEvent.keyDown(secondTextarea, { key: "Escape" });
    expect(onCancel).toHaveBeenCalledTimes(1);

    rerender(
      <TextEditingOverlay
        component={textComponent({
          id: "text-fallbacks",
          width: 0,
          height: 0,
          rotation: 0,
          config: {
            text: { source: "typed", value: "Fallback sizing" },
            font_size: { source: "typed", value: 20 },
            background_color: { source: "typed", value: "#123456" },
          },
        })}
        stageScale={1}
        canvasWidth={640}
        onCommit={onCommit}
        onCancel={onCancel}
      />,
    );
    const fallbackTextarea = await screen.findByDisplayValue("Fallback sizing");
    expect(fallbackTextarea).toHaveStyle({
      transform: "rotate(0deg)",
      background: "#123456",
    });
    expect(fallbackTextarea.style.width).not.toBe("0px");
    expect(fallbackTextarea.style.height).not.toBe("0px");

    rerender(
      <TextEditingOverlay
        component={textComponent({ id: "image-1", type: "ImageComponent" })}
        stageScale={1}
        canvasWidth={640}
        onCommit={onCommit}
        onCancel={onCancel}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("resizes left and right designer panels from document mouse events", () => {
    const setShowLeftPanel = vi.fn();
    const setLeftPanelWidth = vi.fn();
    const setShowRightPanel = vi.fn();
    const setRightPanelWidth = vi.fn();
    const isResizingLeft = { current: true };
    const isResizingRight = { current: false };
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 1000,
    });

    const { unmount } = renderHook(() =>
      useHandleResize({
        isResizingLeft,
        setShowLeftPanel,
        setLeftPanelWidth,
        isResizingRight,
        setShowRightPanel,
        setRightPanelWidth,
      }),
    );

    document.dispatchEvent(new MouseEvent("mousemove", { clientX: 260 }));
    expect(setLeftPanelWidth).toHaveBeenCalledWith(240);
    expect(setShowLeftPanel).toHaveBeenCalledWith(true);

    document.dispatchEvent(new MouseEvent("mousemove", { clientX: 100 }));
    expect(setShowLeftPanel).toHaveBeenCalledWith(false);

    isResizingLeft.current = false;
    isResizingRight.current = true;
    document.dispatchEvent(new MouseEvent("mousemove", { clientX: 500 }));
    expect(setRightPanelWidth).toHaveBeenCalledWith(450);
    expect(setShowRightPanel).toHaveBeenCalledWith(true);

    document.dispatchEvent(new MouseEvent("mousemove", { clientX: 800 }));
    expect(setShowRightPanel).toHaveBeenCalledWith(false);

    document.dispatchEvent(new MouseEvent("mouseup"));
    expect(isResizingLeft.current).toBe(false);
    expect(isResizingRight.current).toBe(false);
    unmount();
  });
});
