import { useCallback, useEffect, useRef, useState } from "react";
import type React from "react";
import {
  buildPastedComponents,
  cloneTrialComponents,
  getSelectedTrialComponents,
} from "../designerComponentClipboard";
import type { TrialComponent } from "../types";

const MAX_HISTORY_ENTRIES = 80;

interface Args {
  autoSaveComponents: (components: TrialComponent[]) => void;
  canvasHeight: number;
  canvasWidth: number;
  componentsRef: React.MutableRefObject<TrialComponent[]>;
  isOpen: boolean;
  selectedIds: string[];
  setComponents: React.Dispatch<React.SetStateAction<TrialComponent[]>>;
  setEditingTextId: React.Dispatch<React.SetStateAction<string | null>>;
  setSelectedIds: React.Dispatch<React.SetStateAction<string[]>>;
  toJsPsychCoords: (x: number, y: number) => { x: number; y: number };
}

export function useDesignerClipboard({
  autoSaveComponents,
  canvasHeight,
  canvasWidth,
  componentsRef,
  isOpen,
  selectedIds,
  setComponents,
  setEditingTextId,
  setSelectedIds,
  toJsPsychCoords,
}: Args) {
  const clipboardComponentsRef = useRef<TrialComponent[]>([]);
  const historyRef = useRef<TrialComponent[][]>([]);
  const pasteCountRef = useRef(0);
  const [clipboardCount, setClipboardCount] = useState(0);
  const [historyCount, setHistoryCount] = useState(0);

  useEffect(() => {
    if (!isOpen) return;
    clipboardComponentsRef.current = [];
    historyRef.current = [];
    pasteCountRef.current = 0;
    setClipboardCount(0);
    setHistoryCount(0);
  }, [isOpen]);

  const pushHistory = useCallback((snapshot = componentsRef.current) => {
    historyRef.current = [
      ...historyRef.current,
      cloneTrialComponents(snapshot),
    ].slice(-MAX_HISTORY_ENTRIES);
    setHistoryCount(historyRef.current.length);
  }, []);

  const setWithHistory = useCallback(
    (value: React.SetStateAction<TrialComponent[]>, autoSave: boolean) => {
      const previous = componentsRef.current;
      const next = typeof value === "function" ? value(previous) : value;
      if (next === previous) return;
      pushHistory(previous);
      componentsRef.current = next;
      setComponents(next);
      if (autoSave) autoSaveComponents(next);
    },
    [autoSaveComponents, pushHistory],
  );

  const setComponentsWithHistory = useCallback(
    (value: React.SetStateAction<TrialComponent[]>) =>
      setWithHistory(value, false),
    [setWithHistory],
  );
  const setComponentsWithHistoryAndAutoSave = useCallback(
    (value: React.SetStateAction<TrialComponent[]>) =>
      setWithHistory(value, true),
    [setWithHistory],
  );

  const copySelectedComponents = useCallback(() => {
    if (selectedIds.length === 0) return false;
    const selected = getSelectedTrialComponents(
      componentsRef.current,
      selectedIds,
    );
    if (selected.length === 0) return false;
    clipboardComponentsRef.current = cloneTrialComponents(selected);
    pasteCountRef.current = 0;
    setClipboardCount(selected.length);
    return true;
  }, [selectedIds]);

  const deleteSelectedComponents = useCallback(() => {
    if (selectedIds.length === 0) return false;
    const ids = new Set(selectedIds);
    const previous = componentsRef.current;
    const next = previous.filter((component) => !ids.has(component.id));
    if (next.length === previous.length) return false;
    pushHistory(previous);
    componentsRef.current = next;
    setComponents(next);
    setSelectedIds([]);
    setEditingTextId(null);
    autoSaveComponents(next);
    return true;
  }, [autoSaveComponents, pushHistory, selectedIds]);

  const pasteClipboardComponents = useCallback(
    (pasteAt?: { x: number; y: number }) => {
      if (clipboardComponentsRef.current.length === 0) return false;
      pasteCountRef.current += 1;
      const previous = componentsRef.current;
      const pasted = buildPastedComponents({
        clipboardComponents: clipboardComponentsRef.current,
        existingComponents: previous,
        canvasWidth,
        canvasHeight,
        toJsPsychCoords,
        pasteAt,
        pasteCount: pasteCountRef.current,
      });
      /* v8 ignore start -- empty clipboard is guarded above. */
      if (pasted.length === 0) return false;
      /* v8 ignore stop */
      const next = [...previous, ...pasted];
      pushHistory(previous);
      componentsRef.current = next;
      setComponents(next);
      setSelectedIds(pasted.map((component) => component.id));
      setEditingTextId(null);
      autoSaveComponents(next);
      return true;
    },
    [
      autoSaveComponents,
      canvasHeight,
      canvasWidth,
      pushHistory,
      toJsPsychCoords,
    ],
  );

  const cutSelectedComponents = useCallback(() => {
    if (!copySelectedComponents()) return false;
    return deleteSelectedComponents();
  }, [copySelectedComponents, deleteSelectedComponents]);

  const selectAllComponents = useCallback(() => {
    const ids = componentsRef.current.map((component) => component.id);
    if (ids.length === 0) return false;
    setSelectedIds(ids);
    setEditingTextId(null);
    return true;
  }, []);

  const undoLastChange = useCallback(() => {
    const previous = historyRef.current.pop();
    if (!previous) return false;
    const restored = cloneTrialComponents(previous);
    historyRef.current = [...historyRef.current];
    setHistoryCount(historyRef.current.length);
    componentsRef.current = restored;
    setComponents(restored);
    setSelectedIds((ids) => {
      const restoredIds = new Set(restored.map((component) => component.id));
      return ids.filter((id) => restoredIds.has(id));
    });
    setEditingTextId(null);
    autoSaveComponents(restored);
    return true;
  }, [autoSaveComponents]);

  return {
    clipboardCount,
    copySelectedComponents,
    cutSelectedComponents,
    deleteSelectedComponents,
    historyCount,
    pasteClipboardComponents,
    pushHistory,
    selectAllComponents,
    setComponentsWithHistory,
    setComponentsWithHistoryAndAutoSave,
    undoLastChange,
  };
}
