import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CodeEditorModal from "../../../pages/ExperimentBuilder/components/CodeEditorModal";

const mocks = vi.hoisted(() => ({
  setupMonacoJsPsychContext: vi.fn(),
  skipNextEditorMount: false,
  initialEditorValue: undefined as string | undefined,
  setModelValue: vi.fn(),
}));

type MockEditor = {
  value: string;
  listeners: Array<() => void>;
  getValue: () => string;
  getModel: () => {
    getValue: () => string;
    setValue: (next: string) => void;
  };
  onDidChangeModelContent: (callback: () => void) => void;
};

type MonacoMockProps = {
  value?: string;
  defaultValue?: string;
  onMount?: (editor: MockEditor, monaco: { languages: object }) => void;
  onChange?: (value: string) => void;
  options?: { readOnly?: boolean };
};

vi.mock("@monaco-editor/react", () => ({
  default: ({
    value,
    defaultValue,
    onMount,
    onChange,
    options,
  }: MonacoMockProps) => {
    const readOnly = Boolean(options?.readOnly);
    const editor: MockEditor = {
      value: mocks.initialEditorValue ?? value ?? defaultValue ?? "",
      listeners: [] as Array<() => void>,
      getValue() {
        return this.value;
      },
      getModel() {
        return {
          getValue: () => this.value,
          setValue: (next: string) => {
            this.value = next;
            mocks.setModelValue(next);
          },
        };
      },
      onDidChangeModelContent(callback: () => void) {
        this.listeners.push(callback);
      },
    };

    if (mocks.skipNextEditorMount) {
      mocks.skipNextEditorMount = false;
    } else {
      onMount?.(editor, { languages: {} });
    }

    return (
      <textarea
        aria-label={readOnly ? "Readonly code editor" : "Code editor"}
        readOnly={readOnly}
        value={editor.value}
        onChange={(event) => {
          editor.value = event.target.value;
          editor.listeners.forEach((listener) => listener());
          onChange?.(event.target.value);
        }}
      />
    );
  },
}));

vi.mock("monaco-editor", () => ({}));

vi.mock(
  "../../../pages/ExperimentBuilder/components/monacoJsPsychContext",
  () => ({
    setupMonacoJsPsychContext: mocks.setupMonacoJsPsychContext,
  }),
);

describe("CodeEditorModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.skipNextEditorMount = false;
    mocks.initialEditorValue = undefined;
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
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("renders nothing when closed and closes open single-editor modals with Escape", () => {
    const onClose = vi.fn();
    const { rerender } = render(
      <CodeEditorModal isOpen={false} onClose={onClose} title="Code" />,
    );

    expect(screen.queryByText("Code")).not.toBeInTheDocument();

    rerender(
      <CodeEditorModal
        isOpen
        onClose={onClose}
        title="Code"
        initialValue="const a = 1;"
        onChange={vi.fn()}
        hint="single editor"
      />,
    );

    expect(screen.getByText("Code")).toBeInTheDocument();
    expect(screen.getByText("single editor")).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });

    expect(onClose).toHaveBeenCalled();
  });

  it("handles backdrop clicks, inner keydown propagation and delayed editor refs", () => {
    const onClose = vi.fn();
    mocks.skipNextEditorMount = true;

    render(
      <CodeEditorModal
        isOpen
        onClose={onClose}
        title="Backdrop modal"
        initialValue="late();"
      />,
    );

    const modal = screen.getByText("Backdrop modal").parentElement
      ?.parentElement as HTMLElement;
    fireEvent.keyDown(modal, { key: "A" });
    expect(onClose).not.toHaveBeenCalled();

    const backdrop = Array.from(document.body.children).find((element) =>
      element.textContent?.includes("Backdrop modal"),
    ) as HTMLElement;
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("syncs stale single-editor models when opened", () => {
    mocks.initialEditorValue = "stale();";

    render(
      <CodeEditorModal
        isOpen
        onClose={vi.fn()}
        title="Sync"
        initialValue="fresh();"
      />,
    );

    expect(mocks.setModelValue).toHaveBeenCalledWith("fresh();");
  });

  it("wires single-editor changes through the Monaco content listener", () => {
    const onChange = vi.fn();

    render(
      <CodeEditorModal
        isOpen
        onClose={vi.fn()}
        title="Single"
        initialValue="initial();"
        onChange={onChange}
      />,
    );

    fireEvent.change(screen.getByLabelText("Code editor"), {
      target: { value: "updated();" },
    });

    expect(onChange).toHaveBeenCalledWith("updated();");
  });

  it("updates split-view previews immediately and debounces tab saves", () => {
    vi.useFakeTimers();
    const onChange = vi.fn();

    render(
      <CodeEditorModal
        isOpen
        onClose={vi.fn()}
        title="Tabbed"
        tabs={[
          {
            key: "managed",
            label: "Managed",
            value: "old();",
            onChange,
            hint: "managed hint",
            isBuilderManaged: true,
            splitView: true,
            computeRightPanel: (userCode) => `preview:${userCode}`,
          },
          {
            key: "readonly",
            label: "Reference",
            value: "readOnly();",
            hint: "reference hint",
          },
        ]}
      />,
    );

    expect(screen.getByText("managed hint")).toBeInTheDocument();
    expect(mocks.setupMonacoJsPsychContext).toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("Code editor"), {
      target: { value: "newUserCode();" },
    });

    expect(
      (
        screen.getAllByLabelText(
          "Readonly code editor",
        )[0] as HTMLTextAreaElement
      ).value,
    ).toBe("preview:newUserCode();");
    expect(onChange).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(onChange).toHaveBeenCalledWith("newUserCode();");

    fireEvent.click(screen.getByRole("button", { name: /Reference/ }));

    expect(screen.getByText("reference hint")).toBeInTheDocument();
  });
});
