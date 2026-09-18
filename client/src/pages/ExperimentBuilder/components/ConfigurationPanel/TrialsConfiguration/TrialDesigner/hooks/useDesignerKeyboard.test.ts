import { fireEvent, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useDesignerKeyboard } from "./useDesignerKeyboard";
import {
  registerEditorModal,
  unregisterEditorModal,
} from "../../ParameterMapper/modalMarker";

type Args = Parameters<typeof useDesignerKeyboard>[0];

function renderKeyboard(overrides: Partial<Args> = {}) {
  const del = vi.fn(() => true);
  const args: Args = {
    contextMenu: null,
    copy: vi.fn(() => true),
    cut: vi.fn(() => true),
    del,
    editingTextId: null,
    isDemoRunning: false,
    isOpen: true,
    onClose: vi.fn(),
    paste: vi.fn(() => true),
    selectAll: vi.fn(() => true),
    setContextMenu: vi.fn(),
    setEditingTextId: vi.fn(),
    undo: vi.fn(() => true),
    ...overrides,
  };
  const view = renderHook((props: Args) => useDesignerKeyboard(props), {
    initialProps: args,
  });
  return { del, view };
}

let editorToken: symbol | null = null;

afterEach(() => {
  if (editorToken) {
    unregisterEditorModal(editorToken);
    editorToken = null;
  }
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

describe("designer delete shortcut", () => {
  it("deletes the selection with Backspace/Delete when the canvas has focus", () => {
    const { del } = renderKeyboard();

    fireEvent.keyDown(document.body, { key: "Backspace" });
    fireEvent.keyDown(document.body, { key: "Delete" });

    expect(del).toHaveBeenCalledTimes(2);
  });

  it("ignores Backspace while a component text edit is active", () => {
    const { del } = renderKeyboard({ editingTextId: "comp-1" });

    fireEvent.keyDown(document.body, { key: "Backspace" });
    fireEvent.keyDown(document.body, { key: "Delete" });

    expect(del).not.toHaveBeenCalled();
  });

  it("ignores Backspace typed inside the inline text editor", () => {
    const { del } = renderKeyboard();
    const textarea = document.createElement("textarea");
    document.body.appendChild(textarea);
    textarea.focus();

    fireEvent.keyDown(textarea, { key: "Backspace" });

    expect(del).not.toHaveBeenCalled();
  });

  it("ignores Backspace when the focused field differs from the event target", () => {
    // Retargeted events (shadow DOM, portals) can point at the body while
    // the user is actually typing into a field.
    const { del } = renderKeyboard();
    const input = document.createElement("input");
    document.body.appendChild(input);
    input.focus();

    fireEvent.keyDown(document.body, { key: "Backspace" });

    expect(del).not.toHaveBeenCalled();
  });

  it("ignores Backspace while interacting with a DOM-activated component", () => {
    const { del } = renderKeyboard();
    const node = document.createElement("div");
    node.setAttribute("data-scene-node-id", "comp-1");
    const field = document.createElement("div");
    node.appendChild(field);
    document.body.appendChild(node);
    field.focus();

    fireEvent.keyDown(node, { key: "Backspace" });

    expect(del).not.toHaveBeenCalled();
  });

  it("ignores modified Backspace and leaves inputs alone", () => {
    const { del } = renderKeyboard();

    fireEvent.keyDown(document.body, { key: "Backspace", ctrlKey: true });
    fireEvent.keyDown(document.body, { key: "Backspace", metaKey: true });
    fireEvent.keyDown(document.body, { key: "Backspace", altKey: true });

    expect(del).not.toHaveBeenCalled();
  });

  it("stays inert while a demo runs or the designer is closed", () => {
    const demo = renderKeyboard({ isDemoRunning: true });
    fireEvent.keyDown(document.body, { key: "Backspace" });
    expect(demo.del).not.toHaveBeenCalled();
    demo.view.unmount();

    const closed = renderKeyboard({ isOpen: false });
    fireEvent.keyDown(document.body, { key: "Backspace" });
    expect(closed.del).not.toHaveBeenCalled();
    closed.view.unmount();
  });

  it("stays inert while a content editor modal is open", () => {
    const selectAll = vi.fn(() => true);
    const onClose = vi.fn();
    const { del } = renderKeyboard({ onClose, selectAll });
    editorToken = Symbol("editor-modal");
    registerEditorModal(editorToken);

    fireEvent.keyDown(document.body, { key: "Backspace" });
    fireEvent.keyDown(document.body, { key: "Delete" });
    fireEvent.keyDown(document.body, { key: "a", ctrlKey: true });
    fireEvent.keyDown(document.body, { key: "Escape" });

    expect(del).not.toHaveBeenCalled();
    expect(selectAll).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();

    unregisterEditorModal(editorToken);
    editorToken = null;

    fireEvent.keyDown(document.body, { key: "Backspace" });
    expect(del).toHaveBeenCalledTimes(1);
  });

  it("lets the inline editor win even with an empty field list", () => {
    const { del } = renderKeyboard();
    const editable = document.createElement("div");
    editable.setAttribute("contenteditable", "true");
    document.body.appendChild(editable);
    editable.focus();

    fireEvent.keyDown(editable, { key: "Delete" });

    expect(del).not.toHaveBeenCalled();
  });
});
