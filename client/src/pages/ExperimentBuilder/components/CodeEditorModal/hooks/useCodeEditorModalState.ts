import { useEffect, useRef, useState } from "react";
import * as monaco from "monaco-editor";
import { setupMonacoJsPsychContext } from "../../monacoJsPsychContext";
import type { CodeEditorModalProps, ModalTabDef } from "../types";

type StateOptions = Pick<
  CodeEditorModalProps,
  "initialValue" | "isOpen" | "onChange" | "readOnly" | "tabs"
>;

export function useCodeEditorModalState({
  initialValue,
  isOpen,
  onChange,
  readOnly,
  tabs,
}: StateOptions) {
  const [isLightMode] = useState(
    window.matchMedia?.("(prefers-color-scheme: light)").matches ?? false,
  );
  const [activeTabKey, setActiveTabKey] = useState(tabs?.[0]?.key ?? "");
  const [rightPanelValues, setRightPanelValues] = useState<
    Record<string, string>
  >({});
  const singleEditorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(
    null,
  );
  const onChangeTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>(
    {},
  );
  const isMultiTab = !!tabs && tabs.length > 0;

  useEffect(() => {
    if (isOpen && isMultiTab && tabs) {
      setRightPanelValues(
        Object.fromEntries(tabs.map((tab) => [tab.key, tab.value])),
      );
      setActiveTabKey(tabs[0].key);
    }
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!isOpen || isMultiTab) return;
    const editor = singleEditorRef.current;
    if (!editor) return;
    const model = editor.getModel();
    if (model && model.getValue() !== (initialValue ?? "")) {
      model.setValue(initialValue ?? "");
    }
  }, [isOpen, initialValue, isMultiTab]);

  const handleSingleMount = (editor: monaco.editor.IStandaloneCodeEditor) => {
    singleEditorRef.current = editor;
    if (!readOnly && onChange) {
      editor.onDidChangeModelContent(() => onChange(editor.getValue()));
    }
  };

  const handleTabMount =
    (tab: ModalTabDef) =>
    (
      editor: monaco.editor.IStandaloneCodeEditor,
      monacoInstance: typeof monaco,
    ) => {
      setupMonacoJsPsychContext(monacoInstance);
      if (tab.onChange) {
        editor.onDidChangeModelContent(() => {
          const value = editor.getValue();
          setRightPanelValues((previous) => ({
            ...previous,
            [tab.key]: value,
          }));
          clearTimeout(onChangeTimers.current[tab.key]);
          onChangeTimers.current[tab.key] = setTimeout(() => {
            tab.onChange!(value);
          }, 1000);
        });
      }
    };

  return {
    activeTabKey,
    handleSingleMount,
    handleTabMount,
    isLightMode,
    isMultiTab,
    rightPanelValues,
    setActiveTabKey,
  };
}
