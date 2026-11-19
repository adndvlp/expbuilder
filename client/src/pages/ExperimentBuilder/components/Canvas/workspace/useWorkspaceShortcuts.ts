import type { RefObject } from "react";
import type { WorkspaceDocument } from "../../../../../../../shared/experiment-workspace/dist/types.js";
import { isWorkspaceFragment } from "../../../../../../../shared/experiment-workspace/dist/fragment.js";
import type { Execute, WorkspaceSelection } from "./types";
import type { useWorkspaceDrag } from "./useWorkspaceDrag";
type Options = {
  element: RefObject<HTMLDivElement | null>;
  selection: WorkspaceSelection;
  document: WorkspaceDocument;
  blocked: () => boolean;
  onDelete: () => Promise<void>;
  execute: Execute;
  undo: () => Promise<void>;
  redo: () => Promise<void>;
  drag: ReturnType<typeof useWorkspaceDrag>;
};
import { layout } from "./layout.js";
import { useEffect, useRef } from "react";
import { copyWorkspaceItems } from "../../../../../../../shared/experiment-workspace/dist/commands.js";
export function useWorkspaceShortcuts({
  element,
  selection,
  document,
  blocked,
  onDelete,
  execute,
  undo,
  redo,
  drag,
}: Options) {
  const clipboard = useRef({ text: "", pastes: 0 });
  useEffect(() => {
    const disallowed = (e: KeyboardEvent | ClipboardEvent) =>
      (typeof blocked === "function" ? blocked() : blocked) ||
      drag.frame.current ||
      e.defaultPrevented ||
      (e instanceof KeyboardEvent && (e.isComposing || e.altKey)) ||
      !element.current?.contains(window.document.activeElement) ||
      e
        .composedPath()
        .some(
          (el) =>
            (el instanceof HTMLElement && el.isContentEditable) ||
            (el instanceof Element &&
              el.matches(
                'input:not([type="checkbox"]),textarea,select,[role="textbox"]',
              )),
        );
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape" && drag.frame.current) {
        e.preventDefault();
        drag.cancel();
        return;
      }
      if (disallowed(e)) return;
      const cmd = e.ctrlKey || e.metaKey,
        k = e.key.toLowerCase();
      if (cmd && k === "z") {
        e.preventDefault();
        void (e.shiftKey ? redo() : undo());
      } else if (e.ctrlKey && k === "y") {
        e.preventDefault();
        void redo();
      } else if (
        !cmd &&
        !e.repeat &&
        (k === "delete" || k === "backspace") &&
        selection
      ) {
        e.preventDefault();
        void onDelete();
      }
    };
    const copy = (e: ClipboardEvent) => {
      if (
        disallowed(e) ||
        !e.clipboardData ||
        !window.getSelection()?.isCollapsed
      )
        return;
      const ids =
          selection?.type === "items"
            ? selection.ids
            : selection?.type === "item"
              ? [selection.id]
              : [],
        fragment = copyWorkspaceItems(document, ids, { layout });
      if (!fragment) return;
      const text = JSON.stringify(fragment);
      e.clipboardData.setData("application/x-expbuilder-workspace+json", text);
      e.clipboardData.setData("text/plain", text);
      e.preventDefault();
      clipboard.current = { text, pastes: 0 };
    };
    const paste = (e: ClipboardEvent) => {
      if (disallowed(e) || !e.clipboardData) return;
      const text =
        e.clipboardData.getData("application/x-expbuilder-workspace+json") ||
        e.clipboardData.getData("text/plain");
      let fragment: unknown;
      try {
        fragment = JSON.parse(text);
      } catch {
        return;
      }
      if (!isWorkspaceFragment(fragment)) return;
      e.preventDefault();
      const pastes =
        text === clipboard.current.text ? clipboard.current.pastes + 1 : 1;
      clipboard.current = { text, pastes };
      void execute("pasteItems", {
        fragment,
        offset: { x: 48 * pastes, y: 48 * pastes },
      });
    };
    window.addEventListener("keydown", key);
    window.addEventListener("copy", copy);
    window.addEventListener("paste", paste);
    return () => {
      window.removeEventListener("keydown", key);
      window.removeEventListener("copy", copy);
      window.removeEventListener("paste", paste);
    };
  }, [
    element,
    selection,
    document,
    blocked,
    onDelete,
    execute,
    undo,
    redo,
    drag,
  ]);
}
