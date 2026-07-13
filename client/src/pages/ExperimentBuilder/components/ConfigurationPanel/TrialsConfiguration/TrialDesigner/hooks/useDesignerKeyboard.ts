import { useEffect } from "react";
import type { CanvasContextMenuState } from "../CanvasContextMenu";

interface Args {
  contextMenu: CanvasContextMenuState | null;
  copy: () => boolean;
  cut: () => boolean;
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

function isEditableShortcutTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  return Boolean(
    target.closest(
      'input, textarea, select, [contenteditable="true"], [role="textbox"]',
    ),
  );
}

export function useDesignerKeyboard({
  contextMenu,
  copy,
  cut,
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
}
