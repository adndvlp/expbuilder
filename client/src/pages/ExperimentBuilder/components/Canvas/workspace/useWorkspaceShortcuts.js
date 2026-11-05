import { layout } from "./layout.js";
import { useEffect, useRef } from "react";
import { copyWorkspaceItems } from "../../../../../../../shared/experiment-workspace/commands.js";
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
}) {
  const clipboard = useRef({ text: "", pastes: 0 });
  useEffect(() => {
    const disallowed = (e) =>
      (typeof blocked === "function" ? blocked() : blocked) ||
      drag.frame.current ||
      e.defaultPrevented ||
      e.isComposing ||
      e.altKey ||
      !element.current?.contains(window.document.activeElement) ||
      e
        .composedPath()
        .some(
          (el) =>
            el?.isContentEditable ||
            el?.matches?.(
              'input:not([type="checkbox"]),textarea,select,[role="textbox"]',
            ),
        );
    const key = (e) => {
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
    const copy = (e) => {
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
    const paste = (e) => {
      if (disallowed(e) || !e.clipboardData) return;
      const text =
        e.clipboardData.getData("application/x-expbuilder-workspace+json") ||
        e.clipboardData.getData("text/plain");
      let fragment;
      try {
        fragment = JSON.parse(text);
      } catch {
        return;
      }
      if (fragment?.schema !== "branching-workspace-fragment/1") return;
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
