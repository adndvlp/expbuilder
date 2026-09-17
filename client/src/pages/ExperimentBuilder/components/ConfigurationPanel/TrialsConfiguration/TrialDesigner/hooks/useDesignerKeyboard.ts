import { useEffect } from "react";
import type { CanvasContextMenuState } from "../CanvasContextMenu";

interface Args {
  contextMenu: CanvasContextMenuState | null;
  copy: () => boolean;
  cut: () => boolean;
  del: () => boolean;
  editingTextId: string | null;
  isDemoRunning: boolean;
  isOpen: boolean;
  onClose: () => void;
  paste: () => boolean;
  selectAll: () => boolean;
  setContextMenu: (menu: CanvasContextMenuState | null) => void;
  setEditingTextId: (id: string | null) => void;
  undo: () => boolean;
}

const EDITABLE_SELECTOR =
  'input, textarea, select, [contenteditable="true"], [role="textbox"]';

/**
 * True when the shortcut belongs to a text field instead of the canvas.
 *
 * Checks the event target AND the currently focused element: components
 * edited by double click (inline text overlay, DOM-activated scene nodes)
 * can retarget or lose the event target, and deleting the selected
 * component while the user is deleting typed characters is never intended.
 * Focus inside the live scene overlay (`[data-scene-node-id]`) also counts
 * as editing, because that DOM only becomes interactive when the user
 * activated the component.
 */
function isEditableShortcutTarget(target: EventTarget | null): boolean {
  const candidates: Array<EventTarget | Element | null> = [
    target,
    typeof document !== "undefined" ? document.activeElement : null,
  ];
  return candidates.some((candidate) => {
    if (!(candidate instanceof HTMLElement)) return false;
    if (candidate.isContentEditable) return true;
    if (candidate.closest(EDITABLE_SELECTOR)) return true;
    return Boolean(
      candidate.closest('[data-scene-node-id], [data-html-scene-overlay]'),
    );
  });
}

export function useDesignerKeyboard({
  contextMenu,
  copy,
  cut,
  del,
  editingTextId,
  isDemoRunning,
  isOpen,
  onClose,
  paste,
  selectAll,
  setContextMenu,
  setEditingTextId,
  undo,
}: Args) {
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || !isOpen) return;
      if (contextMenu) {
        setContextMenu(null);
      } else if (editingTextId) {
        setEditingTextId(null);
      } else {
        onClose();
      }
    };
    if (!isOpen) return;
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [contextMenu, editingTextId, isOpen, onClose]);

  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    window.addEventListener("click", close);
    window.addEventListener("blur", close);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("blur", close);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [contextMenu]);

  useEffect(() => {
    if (!isOpen || isDemoRunning || editingTextId) return;
    const handleCommand = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
      if (isEditableShortcutTarget(event.target)) return;
      const commands: Record<string, () => boolean> = {
        a: selectAll,
        c: copy,
        v: paste,
        x: cut,
        z: undo,
      };
      if (commands[event.key.toLowerCase()]?.()) event.preventDefault();
    };
    document.addEventListener("keydown", handleCommand);
    return () => document.removeEventListener("keydown", handleCommand);
  }, [copy, cut, editingTextId, isDemoRunning, isOpen, paste, selectAll, undo]);

  useEffect(() => {
    if (!isOpen || isDemoRunning || editingTextId) return;
    const handleDelete = (event: KeyboardEvent) => {
      if (event.key !== "Delete" && event.key !== "Backspace") return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (isEditableShortcutTarget(event.target)) return;
      if (del()) {
        event.preventDefault();
        setContextMenu(null);
      }
    };
    document.addEventListener("keydown", handleDelete);
    return () => document.removeEventListener("keydown", handleDelete);
  }, [del, editingTextId, isDemoRunning, isOpen, setContextMenu]);
}
