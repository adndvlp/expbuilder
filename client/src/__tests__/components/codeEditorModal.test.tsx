import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import CodeEditorModal from "../../pages/ExperimentBuilder/components/CodeEditorModal";

const mocks = vi.hoisted(() => ({
  setupMonacoJsPsychContext: vi.fn(),
  modelValue: undefined as string | undefined,
  setModelValue: vi.fn(),
  skipMount: false,
}));

vi.mock("../../pages/ExperimentBuilder/components/monacoJsPsychContext", () => ({
  setupMonacoJsPsychContext: mocks.setupMonacoJsPsychContext,
}));

vi.mock("monaco-editor", () => ({}));

vi.mock("@monaco-editor/react", () => ({
  default: ({
    value,
    defaultValue,
    onMount,
    options,
  }: {
    value?: string;
    defaultValue?: string;
    onMount?: (editor: any, monaco: any) => void;
    options?: { readOnly?: boolean };
  }) => {
    const listeners: Array<() => void> = [];
    const editor = {
      value: mocks.modelValue ?? value ?? defaultValue ?? "",
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
      onDidChangeModelContent(listener: () => void) {
        listeners.push(listener);
      },
    };
    if (!mocks.skipMount) onMount?.(editor, {});
    return (
      <textarea
        aria-label={options?.readOnly ? "readonly editor" : "editable editor"}
        readOnly={options?.readOnly}
        value={value ?? defaultValue ?? ""}
        onChange={(event) => {
          editor.value = event.target.value;
          listeners.forEach((listener) => listener());
        }}
      />
    );
  },
}));

describe("CodeEditorModal", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    mocks.modelValue = undefined;
    mocks.skipMount = false;
  });

  it("renders nothing when closed", () => {
    const { container } = render(
      <CodeEditorModal isOpen={false} onClose={vi.fn()} title="Closed" />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("wires single-editor changes, hints, escape and backdrop close", () => {
    vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: true })));
    const onClose = vi.fn();
    const onChange = vi.fn();

    const { rerender } = render(
      <CodeEditorModal
        isOpen
        onClose={onClose}
        title="Single code"
        initialValue="initial()"
        onChange={onChange}
        hint="Single hint"
      />,
    );

    expect(screen.getByText("Single hint")).toBeInTheDocument();
    fireEvent.keyDown(screen.getByText("Single code").parentElement!.parentElement!, {
      key: "a",
    });
    fireEvent.change(screen.getByLabelText("editable editor"), {
      target: { value: "changed()" },
    });
    expect(onChange).toHaveBeenCalledWith("changed()");

    rerender(
      <CodeEditorModal
        isOpen
        onClose={onClose}
        title="Single code"
        initialValue="updated()"
        onChange={onChange}
      />,
    );

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.click(document.body.querySelector("div[style*='position: fixed']")!);
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("renders multi-tab split view and debounces tab saves", () => {
    vi.useFakeTimers();
    const onSave = vi.fn();

    render(
      <CodeEditorModal
        isOpen
        onClose={vi.fn()}
        title="Tabs"
        tabs={[
          {
            key: "builder",
            label: "Builder",
            value: "user()",
            hint: "Builder hint",
            isBuilderManaged: true,
            splitView: true,
            computeRightPanel: (code) => `wrapped(${code})`,
            rightPanelHint: "Generated preview",
            onChange: onSave,
          },
          {
            key: "readonly",
            label: "Readonly",
            value: "readOnly()",
            hint: "Readonly hint",
          },
          {
            key: "plain",
            label: "Plain",
            value: "plain()",
            onChange: onSave,
          },
        ]}
      />,
    );

    expect(screen.getByText("Generated preview")).toBeInTheDocument();
    expect(screen.getByText("Builder hint")).toBeInTheDocument();
    expect(screen.getAllByLabelText("readonly editor")[0]).toHaveValue(
      "wrapped(user())",
    );

    fireEvent.change(screen.getAllByLabelText("editable editor")[0], {
      target: { value: "edited()" },
    });
    expect(screen.getAllByLabelText("readonly editor")[0]).toHaveValue(
      "wrapped(edited())",
    );
    expect(onSave).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1000);
    expect(onSave).toHaveBeenCalledWith("edited()");

    fireEvent.click(screen.getByRole("button", { name: /Readonly/ }));
    expect(screen.getByText("Readonly hint")).toBeInTheDocument();
    expect(screen.getAllByLabelText("readonly editor")[1]).toHaveValue("readOnly()");

    fireEvent.click(screen.getByRole("button", { name: "Plain" }));
    fireEvent.change(screen.getAllByLabelText("editable editor")[1], {
      target: { value: "plainEdited()" },
    });
    vi.advanceTimersByTime(1000);
    expect(onSave).toHaveBeenCalledWith("plainEdited()");
  });

  it("renders light-mode multi-tab fallbacks", () => {
    vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: true })));

    render(
      <CodeEditorModal
        isOpen
        onClose={vi.fn()}
        title="Light tabs"
        tabs={[
          {
            key: "split",
            label: "Split",
            value: "split()",
            hint: "Light split hint",
            splitView: true,
            computeRightPanel: (code) => `preview(${code})`,
            onChange: vi.fn(),
          },
          {
            key: "plain",
            label: "Plain",
            value: "plain()",
            onChange: vi.fn(),
          },
        ]}
      />,
    );

    expect(
      screen.getByText("Full generated block — read-only · matches HTML output"),
    ).toBeInTheDocument();
    expect(screen.getAllByLabelText("readonly editor")[0]).toHaveValue(
      "preview(split())",
    );
    expect(screen.getByText("Light split hint")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Plain" }));
    expect(screen.getAllByLabelText("editable editor")[1]).toHaveValue("plain()");
  });

  it("clears a stale single-editor model and ignores non-Escape keys", () => {
    vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false })));
    mocks.modelValue = "stale()";
    const onClose = vi.fn();

    render(
      <CodeEditorModal
        isOpen
        onClose={onClose}
        title="Empty single code"
        initialValue={undefined}
        readOnly
      />,
    );

    expect(mocks.setModelValue).toHaveBeenCalledWith("");
    expect(screen.getByLabelText("readonly editor")).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Enter" });
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("waits for the single editor ref before synchronizing", () => {
    mocks.skipMount = true;

    render(
      <CodeEditorModal
        isOpen
        onClose={vi.fn()}
        title="Unmounted editor"
        initialValue="pending()"
      />,
    );

    expect(screen.getByLabelText("editable editor")).toBeInTheDocument();
    expect(mocks.setModelValue).not.toHaveBeenCalled();
  });
});
