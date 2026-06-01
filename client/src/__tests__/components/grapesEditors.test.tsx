import { act, fireEvent, render, screen } from "@testing-library/react";
import grapesjs from "grapesjs";
import juice from "juice";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import GrapesButtonEditor from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/GrapesEditors/GrapesButtonEditor";
import GrapesHtmlEditor from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/GrapesEditors/GrapesHtmlEditor";

vi.mock("juice", () => ({
  default: {
    inlineContent: vi.fn((html: string, css: string) => `inlined:${html}|${css}`),
  },
}));

type EditorMock = ReturnType<typeof createEditorMock>;

function createEditorMock() {
  const handlers: Record<string, () => void> = {};
  const blockManager = {
    add: vi.fn(),
    remove: vi.fn(),
    get: vi.fn((id: string) => ({ id })),
    getAll: vi.fn(() => [{ id: "column1" }, { id: "image" }]),
  };
  return {
    handlers,
    BlockManager: blockManager,
    getHtml: vi.fn(() => "<body><div>Saved</div></body>"),
    getCss: vi.fn(() => ".saved{color:red;}"),
    destroy: vi.fn(),
    on: vi.fn((event: string, cb: () => void) => {
      handlers[event] = cb;
    }),
  };
}

function mockNextEditor(editor: EditorMock) {
  vi.mocked(grapesjs.init).mockReturnValue(editor as any);
}

describe("Grapes editors", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(juice.inlineContent).mockImplementation(
      (html: string, css: string) => `inlined:${html}|${css}`,
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("does not initialize GrapesJS while the HTML editor is closed", () => {
    render(
      <GrapesHtmlEditor
        isOpen={false}
        onClose={vi.fn()}
        onChange={vi.fn()}
      />,
    );

    expect(grapesjs.init).not.toHaveBeenCalled();
    expect(screen.queryByText("Save HTML")).not.toBeInTheDocument();
  });

  it("initializes the HTML editor, autosaves updates, saves processed HTML and destroys on unmount", () => {
    vi.useFakeTimers();
    const editor = createEditorMock();
    const onAutoSave = vi.fn();
    const onChange = vi.fn();
    const onClose = vi.fn();
    mockNextEditor(editor);

    const { unmount } = render(
      <GrapesHtmlEditor
        isOpen
        value="<p>Initial</p>"
        onClose={onClose}
        onChange={onChange}
        onAutoSave={onAutoSave}
      />,
    );

    expect(grapesjs.init).toHaveBeenCalledWith(
      expect.objectContaining({
        components: "<p>Initial</p>",
        height: "500px",
        storageManager: false,
      }),
    );
    expect(editor.BlockManager.add).toHaveBeenCalledWith(
      "title",
      expect.objectContaining({ label: "Title" }),
    );
    expect(editor.BlockManager.add).toHaveBeenCalledWith(
      "button",
      expect.objectContaining({ category: "Controls" }),
    );
    expect(editor.on).toHaveBeenCalledWith("update", expect.any(Function));

    act(() => {
      editor.handlers.update();
      vi.advanceTimersByTime(1000);
    });

    expect(onAutoSave).toHaveBeenCalledWith(
      "inlined:<div>Saved</div>|.saved{color:red;}",
    );

    fireEvent.click(screen.getByText("Save HTML"));

    expect(onChange).toHaveBeenCalledWith(
      "inlined:<div>Saved</div>|.saved{color:red;}",
    );
    expect(onClose).toHaveBeenCalledTimes(1);

    unmount();
    expect(editor.destroy).toHaveBeenCalledTimes(1);
  });

  it("configures the button editor with template defaults and restricted blocks", () => {
    const editor = createEditorMock();
    mockNextEditor(editor);
    const onChange = vi.fn();
    const onClose = vi.fn();

    render(
      <GrapesButtonEditor
        isOpen
        onClose={onClose}
        onChange={onChange}
      />,
    );

    expect(grapesjs.init).toHaveBeenCalledWith(
      expect.objectContaining({
        components: expect.stringContaining("{{choice}}"),
        height: "500px",
        storageManager: false,
      }),
    );
    expect(screen.getByText(/Button Template Mode:/)).toBeInTheDocument();
    expect(editor.BlockManager.getAll).toHaveBeenCalled();
    expect(editor.BlockManager.remove).toHaveBeenCalledWith("column1");
    expect(editor.BlockManager.remove).toHaveBeenCalledWith("image");
    expect(editor.BlockManager.add).toHaveBeenCalledWith(
      "button",
      expect.objectContaining({ label: "Button" }),
    );
    expect(editor.BlockManager.add).toHaveBeenCalledWith(
      "flex-container",
      expect.objectContaining({ category: "Layout" }),
    );

    fireEvent.click(screen.getByText("Save Button"));

    expect(onChange).toHaveBeenCalledWith(
      "inlined:<div>Saved</div>|.saved{color:red;}",
    );
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("debounces button editor autosave and cleans up pending timers", () => {
    vi.useFakeTimers();
    const editor = createEditorMock();
    const onAutoSave = vi.fn();
    mockNextEditor(editor);

    const { unmount } = render(
      <GrapesButtonEditor
        isOpen
        value="<button>Ready</button>"
        onClose={vi.fn()}
        onChange={vi.fn()}
        onAutoSave={onAutoSave}
      />,
    );

    act(() => {
      editor.handlers.update();
      editor.handlers.update();
      vi.advanceTimersByTime(999);
    });
    expect(onAutoSave).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(onAutoSave).toHaveBeenCalledTimes(1);

    unmount();
    expect(editor.destroy).toHaveBeenCalledTimes(1);
  });
});
