import { OnMount } from "@monaco-editor/react";
import * as monaco from "monaco-editor";
import { useEffect, useRef, useState } from "react";
import useCanvasStyles from "../hooks/useCanvasStyles";
import useDevMode from "../hooks/useDevMode";
import { useExperimentID } from "../hooks/useExperimentID";
import usePlugins from "../hooks/usePlugins";
import {
  getPreInitLocalPreview,
  getPreInitPublicPreview,
} from "./Timeline/ExperimentCode/getInitJsPsychPreview";
import InitJsPsychModal from "./GlobalCustomCode/components/InitJsPsychModal";
import PreInitModal from "./GlobalCustomCode/components/PreInitModal";
import {
  JSPSYCH_PARAMS,
  isBuilderUsed,
  Variant,
} from "./GlobalCustomCode/config";
import { getEditorTheme } from "./GlobalCustomCode/editorConfig";
import { resolveRightPreviewValue } from "./GlobalCustomCode/previewValues";
import {
  setupMonacoJsPsychContext,
  updateCustomPluginContext,
} from "./monacoJsPsychContext";

export { PreviewTabs } from "./GlobalCustomCode/components/PreviewTabs";
export { resolveRightPreviewValue } from "./GlobalCustomCode/previewValues";

export default function GlobalCustomCode() {
  const {
    customInitJsPsychParams,
    setCustomInitJsPsychParam,
    customPreInitCode,
    setCustomPreInitCode,
  } = useDevMode();
  const { plugins } = usePlugins();
  const { canvasStyles } = useCanvasStyles();
  const experimentID = useExperimentID();
  const [modalOpen, setModalOpen] = useState(false);
  const [preInitModalOpen, setPreInitModalOpen] = useState(false);
  const [saveIndicator, setSaveIndicator] = useState(false);
  const [isLightMode] = useState(
    window.matchMedia?.("(prefers-color-scheme: light)").matches ?? false,
  );
  const [activeParam, setActiveParam] = useState(JSPSYCH_PARAMS[0].key);
  const editVariant: Variant = "local";
  const [rightPreviewVariant, setRightPreviewVariant] =
    useState<Variant>("local");
  const preInitEditVariant: Variant = "local";
  const [preInitRightVariant, setPreInitRightVariant] =
    useState<Variant>("local");
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    updateCustomPluginContext(
      monaco,
      plugins.map((plugin) => plugin.name),
    );
  }, [plugins]);

  const localParams = customInitJsPsychParams.local;
  const publicParams = customInitJsPsychParams.public;
  const activeDef = JSPSYCH_PARAMS.find((param) => param.key === activeParam)!;
  const isBuilderParam = isBuilderUsed(activeDef, editVariant);
  const isBuilderAnyVariant =
    isBuilderUsed(activeDef, "local") || isBuilderUsed(activeDef, "public");
  const currentValue = localParams[activeParam] ?? "";
  const [liveValue, setLiveValue] = useState(currentValue);
  const editorKey = `${editVariant}-${activeParam}`;
  const preInitCurrentValue = customPreInitCode.local ?? "";
  const [preInitLiveValue, setPreInitLiveValue] = useState(preInitCurrentValue);
  const preInitEditorKey = `preinit-${preInitEditVariant}`;
  const eid = experimentID ?? "[experimentID]";
  const progressBar = canvasStyles?.progressBar ?? false;
  const theme = getEditorTheme(isLightMode);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => setLiveValue(currentValue), [editorKey]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => setPreInitLiveValue(preInitCurrentValue), [preInitEditorKey]);

  const flashSave = () => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      setSaveIndicator(true);
      setTimeout(() => setSaveIndicator(false), 1500);
    }, 1200);
  };
  const handleEditorMount: OnMount = (_editor, monacoInstance) => {
    setupMonacoJsPsychContext(monacoInstance);
  };
  const handleReadonlyMount: OnMount = (editor) => {
    editor.revealLine(editor.getModel()?.getLineCount() ?? 1);
  };
  const getRightValue = (previewVariant: Variant) =>
    resolveRightPreviewValue({
      param: activeDef,
      previewVariant,
      eid,
      liveValue,
      localParams,
      publicParams,
      activeParam,
      editVariant,
    });
  const getPreInitRightValue = (previewVariant: Variant) =>
    previewVariant === "local"
      ? getPreInitLocalPreview(eid, preInitLiveValue)
      : getPreInitPublicPreview(eid, preInitLiveValue);
  const paramHasCode = (key: string) =>
    !!(localParams[key]?.trim() || publicParams[key]?.trim());
  const hasAnyInit =
    Object.values(localParams).some((value) => value?.trim()) ||
    Object.values(publicParams).some((value) => value?.trim());
  const hasAnyPreInit =
    !!customPreInitCode.local?.trim() || !!customPreInitCode.public?.trim();
  const openButtonStyle = (hasCode: boolean) => ({
    flex: 1,
    padding: "8px 14px",
    border: `1px solid ${hasCode ? "#fff" : "var(--neutral-mid)"}`,
    borderRadius: 6,
    cursor: "pointer",
    background: hasCode ? "rgba(255,255,255,0.07)" : "var(--neutral-light)",
    color: hasCode ? "#fff" : "var(--text-dark)",
    fontSize: 12,
    fontWeight: 500,
  });

  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ display: "flex", gap: 8 }}>
        <button
          type="button"
          onClick={() => setPreInitModalOpen(true)}
          style={openButtonStyle(hasAnyPreInit)}
        >
          Before initJsPsych
        </button>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          style={openButtonStyle(hasAnyInit)}
        >
          initJsPsych
        </button>
      </div>

      {modalOpen && (
        <InitJsPsychModal
          onClose={() => setModalOpen(false)}
          progressBar={progressBar}
          saveIndicator={saveIndicator}
          isLightMode={isLightMode}
          theme={theme}
          activeDef={activeDef}
          activeParam={activeParam}
          setActiveParam={setActiveParam}
          paramHasCode={paramHasCode}
          editorKey={editorKey}
          currentValue={currentValue}
          isBuilderParam={isBuilderParam}
          isBuilderAnyVariant={isBuilderAnyVariant}
          rightPreviewVariant={rightPreviewVariant}
          setRightPreviewVariant={setRightPreviewVariant}
          getRightValue={getRightValue}
          onMount={handleEditorMount}
          onReadonlyMount={handleReadonlyMount}
          onChange={(value) => {
            setLiveValue(value);
            setCustomInitJsPsychParam(editVariant, activeParam, value);
            flashSave();
          }}
          editVariant={editVariant}
        />
      )}
      {preInitModalOpen && (
        <PreInitModal
          onClose={() => setPreInitModalOpen(false)}
          isLightMode={isLightMode}
          theme={theme}
          saveIndicator={saveIndicator}
          editorKey={preInitEditorKey}
          currentValue={preInitCurrentValue}
          editVariant={preInitEditVariant}
          rightVariant={preInitRightVariant}
          setRightVariant={setPreInitRightVariant}
          getRightValue={getPreInitRightValue}
          onMount={handleEditorMount}
          onReadonlyMount={handleReadonlyMount}
          onChange={(value) => {
            setPreInitLiveValue(value);
            setCustomPreInitCode(preInitEditVariant, value);
            flashSave();
          }}
        />
      )}
    </div>
  );
}
