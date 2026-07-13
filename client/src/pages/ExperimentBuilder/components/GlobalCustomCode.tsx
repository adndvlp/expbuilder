import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Editor, { OnMount } from "@monaco-editor/react";
import * as monaco from "monaco-editor";
import {
  setupMonacoJsPsychContext,
  updateCustomPluginContext,
} from "./monacoJsPsychContext";
import useDevMode from "../hooks/useDevMode";
import usePlugins from "../hooks/usePlugins";
import useCanvasStyles from "../hooks/useCanvasStyles";
import { useExperimentID } from "../hooks/useExperimentID";
import {
  getLocalOnDataUpdatePreview,
  getLocalOnFinishPreview,
  getPublicOnTrialStartPreview,
  getPublicOnDataUpdatePreview,
  getPublicOnFinishPreview,
  getPreInitLocalPreview,
  getPreInitPublicPreview,
} from "./Timeline/ExperimentCode/getInitJsPsychPreview";

type ParamDef = {
  key: string;
  description: string;
  type: "function" | "value";
  builderUsed?: { local?: boolean; public?: boolean };
};

const JSPSYCH_PARAMS: ParamDef[] = [
  {
    key: "on_finish",
    description: "Function executed when experiment ends.",
    type: "function",
    builderUsed: { local: true, public: true },
  },
  {
    key: "on_data_update",
    description: "Function executed every time trial data is stored.",
    type: "function",
    builderUsed: { local: true, public: true },
  },
  {
    key: "on_trial_start",
    description: "Function executed when a new trial begins.",
    type: "function",
    builderUsed: { public: true },
  },
  {
    key: "on_trial_finish",
    description: "Function executed when a trial ends.",
    type: "function",
  },
  {
    key: "on_interaction_data_update",
    description: "Function executed on blur/focus/fullscreen events.",
    type: "function",
  },
  {
    key: "on_close",
    description: "Function executed when user leaves page.",
    type: "function",
  },
  {
    key: "display_element",
    description: "ID of HTML element to display experiment in.",
    type: "value",
  },
  {
    key: "message_progress_bar",
    description: "Message next to progress bar (string or function).",
    type: "value",
  },
  {
    key: "auto_update_progress_bar",
    description: "Boolean — auto-update progress bar per top-level trial.",
    type: "value",
  },
  {
    key: "use_webaudio",
    description: "Boolean — use WebAudio API for audio (default: true).",
    type: "value",
  },
  {
    key: "default_iti",
    description: "Default inter-trial interval in ms (default: 0).",
    type: "value",
  },
  {
    key: "experiment_width",
    description: "Width of jsPsych container in pixels.",
    type: "value",
  },
  {
    key: "minimum_valid_rt",
    description: "Minimum valid keyboard response time in ms.",
    type: "value",
  },
  {
    key: "override_safe_mode",
    description: "Boolean — override file:// protocol safe mode.",
    type: "value",
  },
  {
    key: "case_sensitive_responses",
    description:
      "Boolean — treat uppercase/lowercase keyboard responses differently.",
    type: "value",
  },
];

type Variant = "local" | "public";

function isBuilderUsed(param: ParamDef, variant: Variant): boolean {
  return !!param.builderUsed?.[variant];
}

function getBuilderPreview(
  param: ParamDef,
  variant: Variant,
  eid: string,
  userCode: string,
): string {
  if (variant === "local") {
    const localPreviews: Record<string, () => string> = {
      on_data_update: () => getLocalOnDataUpdatePreview(eid, userCode),
      on_finish: () => getLocalOnFinishPreview(eid, userCode),
    };
    return localPreviews[param.key]!();
  }

  const publicPreviews: Record<string, () => string> = {
    on_trial_start: () => getPublicOnTrialStartPreview(userCode),
    on_data_update: () => getPublicOnDataUpdatePreview(eid, userCode),
    on_finish: () => getPublicOnFinishPreview(eid, userCode),
  };
  return publicPreviews[param.key]!();
}

export function resolveRightPreviewValue({
  param,
  previewVariant,
  eid,
  liveValue,
  localParams,
  publicParams,
  activeParam,
  editVariant,
}: {
  param: ParamDef;
  previewVariant: Variant;
  eid: string;
  liveValue: string;
  localParams: Record<string, string | undefined>;
  publicParams: Record<string, string | undefined>;
  activeParam: string;
  editVariant: Variant;
}) {
  if (isBuilderUsed(param, previewVariant)) {
    return getBuilderPreview(param, previewVariant, eid, liveValue);
  }
  const savedParams =
    previewVariant === "local" ? localParams : publicParams;
  const savedValue = savedParams[activeParam] ?? "";
  const value = previewVariant === editVariant ? liveValue : savedValue;
  return value || `// No user code for this param in ${previewVariant}`;
}

// ── Shared mini-components ────────────────────────────────────────────────────

export function PreviewTabs({
  value,
  onChange,
  isLightMode,
  borderColor,
  panelHeaderBg,
  panelHeaderColor,
  hideLabel,
}: {
  value: Variant;
  onChange: (v: Variant) => void;
  isLightMode: boolean;
  borderColor: string;
  panelHeaderBg: string;
  panelHeaderColor: string;
  hideLabel?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        padding: "0 10px",
        background: panelHeaderBg,
        borderBottom: `1px solid ${borderColor}`,
        flexShrink: 0,
        gap: 0,
      }}
    >
      {!hideLabel && (
        <span style={{ fontSize: 9, color: panelHeaderColor, marginRight: 8 }}>
          preview
        </span>
      )}
      {(["local", "public"] as Variant[]).map((v) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          style={{
            padding: "3px 10px",
            border: "none",
            borderBottom:
              value === v
                ? `2px solid ${isLightMode ? "#3d92b4" : "#3d92b4"}`
                : "2px solid transparent",
            background: "transparent",
            color:
              value === v ? (isLightMode ? "#333" : "#ccc") : panelHeaderColor,
            fontSize: 9,
            fontWeight: value === v ? 600 : 400,
            cursor: "pointer",
          }}
        >
          {v === "local" ? "Local" : "Public"}
        </button>
      ))}
      <span
        style={{
          marginLeft: "auto",
          fontSize: 9,
          color: panelHeaderColor,
          fontStyle: "italic",
        }}
      >
        read-only · matches HTML
      </span>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

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

  // Keep Monaco linter in sync with custom plugins whenever the list changes
  useEffect(() => {
    updateCustomPluginContext(
      monaco,
      plugins.map((p) => p.name),
    );
  }, [plugins]);
  const eid = experimentID ?? "[experimentID]";
  const progressBar = canvasStyles?.progressBar ?? false;

  const [modalOpen, setModalOpen] = useState(false);
  const [preInitModalOpen, setPreInitModalOpen] = useState(false);
  const [saveIndicator, setSaveIndicator] = useState(false);

  const [isLightMode] = useState(
    window.matchMedia?.("(prefers-color-scheme: light)").matches ?? false,
  );

  // initJsPsych modal state
  const [activeParam, setActiveParam] = useState<string>(JSPSYCH_PARAMS[0].key);
  const editVariant: Variant = "local";
  const [rightPreviewVariant, setRightPreviewVariant] =
    useState<Variant>("local");

  // Pre-init modal state
  const preInitEditVariant: Variant = "local";
  const [preInitRightVariant, setPreInitRightVariant] =
    useState<Variant>("local");

  const localParams = customInitJsPsychParams.local;
  const publicParams = customInitJsPsychParams.public;

  const hasLocalCode = Object.values(localParams).some((v) => v?.trim());
  const hasPublicCode = Object.values(publicParams).some((v) => v?.trim());
  const hasPreInitLocal = !!customPreInitCode.local?.trim();
  const hasPreInitPublic = !!customPreInitCode.public?.trim();
  const hasAnyPreInit = hasPreInitLocal || hasPreInitPublic;

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flashSave = () => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      setSaveIndicator(true);
      setTimeout(() => setSaveIndicator(false), 1500);
    }, 1200);
  };

  // Active param state
  const activeDef = JSPSYCH_PARAMS.find((p) => p.key === activeParam)!;
  const isBuilderParam = isBuilderUsed(activeDef, editVariant);
  const isBuilderAnyVariant =
    isBuilderUsed(activeDef, "local") || isBuilderUsed(activeDef, "public");
  const currentEditParams = localParams;
  const currentValue = currentEditParams[activeParam] ?? "";

  // Live value for right-panel preview (reset on param/variant switch)
  const [liveValue, setLiveValue] = useState(currentValue);
  const editorKey = `${editVariant}-${activeParam}`;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    setLiveValue(currentValue);
  }, [editorKey]);

  // Pre-init live value
  const preInitCurrentValue = customPreInitCode.local ?? "";
  const [preInitLiveValue, setPreInitLiveValue] = useState(preInitCurrentValue);
  const preInitEditorKey = `preinit-${preInitEditVariant}`;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    setPreInitLiveValue(preInitCurrentValue);
  }, [preInitEditorKey]);

  const handleEditorMount: OnMount = (_editor, monacoInst) => {
    setupMonacoJsPsychContext(monacoInst);
  };

  const handleReadonlyMount: OnMount = (editor) => {
    const lineCount = editor.getModel()?.getLineCount() ?? 1;
    editor.revealLine(lineCount);
  };

  // Right panel value for initJsPsych
  const getRightValue = (previewVariant: Variant) => {
    return resolveRightPreviewValue({
      param: activeDef,
      previewVariant,
      eid,
      liveValue,
      localParams,
      publicParams,
      activeParam,
      editVariant,
    });
  };

  // Right panel value for pre-init: always use live value in both preview tabs
  const getPreInitRightValue = (previewVariant: Variant) => {
    return previewVariant === "local"
      ? getPreInitLocalPreview(eid, preInitLiveValue)
      : getPreInitPublicPreview(eid, preInitLiveValue);
  };

  // Styles
  const tabBg = isLightMode ? "#ececec" : "#252526";
  const activeTabBg = isLightMode ? "#ffffff" : "#1e1e1e";
  const editorBg = isLightMode ? "#fff" : "#1e1e1e";
  const borderColor = isLightMode ? "#ddd" : "#3c3c3c";
  const panelHeaderBg = isLightMode ? "#f5f5f5" : "#2d2d2d";
  const panelHeaderColor = isLightMode ? "#666" : "#888";

  const paramHasCode = (key: string) =>
    !!(localParams[key]?.trim() || publicParams[key]?.trim());

  const editorOptions = (readOnly: boolean) => ({
    readOnly,
    automaticLayout: true,
    minimap: { enabled: false },
    scrollBeyondLastLine: false,
    fontSize: 13,
    lineNumbers: "on" as const,
    tabSize: 2,
    wordWrap: "on" as const,
    folding: true,
    fixedOverflowWidgets: true,
    glyphMargin: readOnly,
    suggest: !readOnly
      ? { showKeywords: true, showFunctions: true, showVariables: true }
      : undefined,
    quickSuggestions: !readOnly
      ? ({ other: true, strings: true } as const)
      : (false as const),
  });

  const hasAnyInit = hasLocalCode || hasPublicCode;

  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ display: "flex", gap: 8 }}>
        <button
          type="button"
          onClick={() => setPreInitModalOpen(true)}
          style={{
            flex: 1,
            padding: "8px 14px",
            border: `1px solid ${hasAnyPreInit ? "#fff" : "var(--neutral-mid)"}`,
            borderRadius: 6,
            cursor: "pointer",
            background: hasAnyPreInit
              ? "rgba(255,255,255,0.07)"
              : "var(--neutral-light)",
            color: hasAnyPreInit ? "#fff" : "var(--text-dark)",
            fontSize: 12,
            fontWeight: 500,
          }}
        >
          Before initJsPsych
        </button>

        <button
          type="button"
          onClick={() => setModalOpen(true)}
          style={{
            flex: 1,
            padding: "8px 14px",
            border: `1px solid ${hasAnyInit ? "#fff" : "var(--neutral-mid)"}`,
            borderRadius: 6,
            cursor: "pointer",
            background: hasAnyInit
              ? "rgba(255,255,255,0.07)"
              : "var(--neutral-light)",
            color: hasAnyInit ? "#fff" : "var(--text-dark)",
            fontSize: 12,
            fontWeight: 500,
          }}
        >
          initJsPsych
        </button>
      </div>

      {/* ── initJsPsych params modal ─────────────────────────────────────────── */}
      {modalOpen &&
        createPortal(
          <div
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 9999,
              background: "rgba(0,0,0,0.65)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            onClick={(e) => {
              if (e.target === e.currentTarget) setModalOpen(false);
            }}
          >
            <div
              style={{
                width: "88vw",
                height: "88vh",
                background: editorBg,
                borderRadius: 6,
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
                border: `1px solid ${borderColor}`,
                boxShadow: "0 16px 56px rgba(0,0,0,0.7)",
              }}
              onKeyDown={(e) => e.stopPropagation()}
            >
              {/* Title bar */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "8px 14px",
                  background: isLightMode ? "#f3f3f3" : "#323233",
                  borderBottom: `1px solid ${isLightMode ? "#ddd" : "#2b2b2b"}`,
                  flexShrink: 0,
                }}
              >
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: isLightMode ? "#444" : "#ccc",
                  }}
                >
                  initJsPsych {progressBar ? "· progress bar on" : ""}
                </span>
                <span
                  style={{
                    marginLeft: "auto",
                    fontSize: 10,
                    color: "#22c55e",
                    fontWeight: 600,
                    opacity: saveIndicator ? 1 : 0,
                    transition: "opacity 0.3s",
                  }}
                >
                  ✓ Saved
                </span>
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  style={{
                    marginLeft: 8,
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    fontSize: 20,
                    lineHeight: 1,
                    color: isLightMode ? "#666" : "#888",
                    padding: "0 4px",
                  }}
                >
                  ×
                </button>
              </div>

              {/* Param tab strip */}
              <div
                style={{
                  display: "flex",
                  background: tabBg,
                  borderBottom: `1px solid ${isLightMode ? "#ddd" : "#1e1e1e"}`,
                  overflowX: "auto",
                  flexShrink: 0,
                }}
              >
                {JSPSYCH_PARAMS.map((param) => {
                  const isActive = param.key === activeParam;
                  const hasCode = paramHasCode(param.key);
                  const builderLocal = isBuilderUsed(param, "local");
                  const builderPublic = isBuilderUsed(param, "public");
                  const isBuilderAny = builderLocal || builderPublic;
                  return (
                    <button
                      key={param.key}
                      type="button"
                      onClick={() => setActiveParam(param.key)}
                      title={param.description}
                      style={{
                        padding: "7px 14px",
                        border: "none",
                        borderTop: isActive
                          ? `2px solid ${isBuilderAny ? "#f59e0b" : "#3d92b4"}`
                          : "2px solid transparent",
                        borderRight: `1px solid ${isLightMode ? "#ddd" : "#1e1e1e"}`,
                        background: isActive ? activeTabBg : "transparent",
                        color: isActive
                          ? isLightMode
                            ? "#222"
                            : "#ccc"
                          : isLightMode
                            ? "#666"
                            : "#888",
                        fontSize: 11,
                        fontWeight: isActive ? 600 : 400,
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      {param.key}
                      {hasCode && (
                        <span
                          style={{
                            width: 5,
                            height: 5,
                            borderRadius: "50%",
                            background: "#3d92b4",
                            display: "inline-block",
                          }}
                        />
                      )}
                      {isBuilderAny && (
                        <span
                          style={{
                            fontSize: 9,
                            color: "#f59e0b",
                            fontWeight: 700,
                            marginLeft: 2,
                          }}
                        >
                          bld
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Param description */}
              <div
                style={{
                  padding: "4px 14px",
                  fontSize: 10,
                  color: "#888",
                  background: panelHeaderBg,
                  borderBottom: `1px solid ${borderColor}`,
                  flexShrink: 0,
                  display: "flex",
                  gap: 12,
                  alignItems: "center",
                }}
              >
                <span>{activeDef.description}</span>
                {isBuilderParam && (
                  <span style={{ color: "#f59e0b", fontWeight: 600 }}>
                    ⚠ Builder-managed — your code appended inside function
                  </span>
                )}
              </div>

              {/* Editor area */}
              <div style={{ flex: 1, overflow: "hidden", display: "flex" }}>
                {/* Left: editable */}
                <div
                  style={{
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    borderRight: `1px solid ${borderColor}`,
                  }}
                >
                  <div
                    style={{
                      padding: "3px 10px",
                      fontSize: 10,
                      color: panelHeaderColor,
                      background: panelHeaderBg,
                      borderBottom: `1px solid ${borderColor}`,
                      flexShrink: 0,
                      display: "flex",
                      alignItems: "center",
                    }}
                  >
                    <span>
                      {isBuilderParam
                        ? "Your code — injected at bottom of function"
                        : "Value — added as param to initJsPsych"}
                    </span>
                  </div>
                  <div style={{ flex: 1 }}>
                    <Editor
                      key={editorKey}
                      height="100%"
                      defaultLanguage="javascript"
                      theme={isLightMode ? "vs-light" : "vs-dark"}
                      defaultValue={currentValue}
                      onMount={handleEditorMount}
                      onChange={(val) => {
                        const v = val ?? "";
                        setLiveValue(v);
                        setCustomInitJsPsychParam(editVariant, activeParam, v);
                        flashSave();
                      }}
                      options={editorOptions(false)}
                    />
                  </div>
                </div>

                {/* Right: readonly preview — only for builder-managed params */}
                {isBuilderAnyVariant && (
                  <div
                    style={{
                      flex: 1,
                      display: "flex",
                      flexDirection: "column",
                    }}
                  >
                    <PreviewTabs
                      value={rightPreviewVariant}
                      onChange={setRightPreviewVariant}
                      isLightMode={isLightMode}
                      borderColor={borderColor}
                      panelHeaderBg={panelHeaderBg}
                      panelHeaderColor={panelHeaderColor}
                      hideLabel
                    />
                    <div style={{ flex: 1 }}>
                      <Editor
                        key={`right-${activeParam}-${rightPreviewVariant}`}
                        height="100%"
                        defaultLanguage="javascript"
                        theme={isLightMode ? "vs-light" : "vs-dark"}
                        value={getRightValue(rightPreviewVariant)}
                        onMount={handleReadonlyMount}
                        options={editorOptions(true)}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div
                style={{
                  padding: "4px 14px",
                  fontSize: 10,
                  color: "#888",
                  background: panelHeaderBg,
                  borderTop: `1px solid ${borderColor}`,
                  flexShrink: 0,
                }}
              >
                {isBuilderParam
                  ? `Editing ${editVariant} · ${activeParam}: appended inside function. Right panel shows full generated block.`
                  : `Editing ${editVariant} · ${activeParam}: value added as key to initJsPsych({}).`}
              </div>
            </div>
          </div>,
          document.body,
        )}

      {/* ── Before initJsPsych modal ─────────────────────────────────────────── */}
      {preInitModalOpen &&
        createPortal(
          <div
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 9999,
              background: "rgba(0,0,0,0.65)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            onClick={(e) => {
              if (e.target === e.currentTarget) setPreInitModalOpen(false);
            }}
          >
            <div
              style={{
                width: "88vw",
                height: "82vh",
                background: editorBg,
                borderRadius: 6,
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
                border: `1px solid ${borderColor}`,
                boxShadow: "0 16px 56px rgba(0,0,0,0.7)",
              }}
              onKeyDown={(e) => e.stopPropagation()}
            >
              {/* Title bar */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "8px 14px",
                  background: isLightMode ? "#f3f3f3" : "#323233",
                  borderBottom: `1px solid ${isLightMode ? "#ddd" : "#2b2b2b"}`,
                  flexShrink: 0,
                }}
              >
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: isLightMode ? "#444" : "#ccc",
                  }}
                >
                  Before initJsPsych
                </span>
                <span style={{ fontSize: 10, color: panelHeaderColor }}>
                  — inside async IIFE, after session setup
                </span>
                <span
                  style={{
                    marginLeft: "auto",
                    fontSize: 10,
                    color: "#22c55e",
                    fontWeight: 600,
                    opacity: saveIndicator ? 1 : 0,
                    transition: "opacity 0.3s",
                  }}
                >
                  ✓ Saved
                </span>
                <button
                  type="button"
                  onClick={() => setPreInitModalOpen(false)}
                  style={{
                    marginLeft: 8,
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    fontSize: 20,
                    lineHeight: 1,
                    color: isLightMode ? "#666" : "#888",
                    padding: "0 4px",
                  }}
                >
                  ×
                </button>
              </div>

              {/* Split view */}
              <div style={{ flex: 1, overflow: "hidden", display: "flex" }}>
                {/* Left: editable */}
                <div
                  style={{
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    borderRight: `1px solid ${borderColor}`,
                  }}
                >
                  <div
                    style={{
                      padding: "3px 10px",
                      fontSize: 10,
                      color: panelHeaderColor,
                      background: panelHeaderBg,
                      borderBottom: `1px solid ${borderColor}`,
                      flexShrink: 0,
                      display: "flex",
                      alignItems: "center",
                    }}
                  >
                    <span>Your code — runs before initJsPsych</span>
                  </div>
                  <div style={{ flex: 1 }}>
                    <Editor
                      key={preInitEditorKey}
                      height="100%"
                      defaultLanguage="javascript"
                      theme={isLightMode ? "vs-light" : "vs-dark"}
                      defaultValue={preInitCurrentValue}
                      onMount={handleEditorMount}
                      onChange={(val) => {
                        const v = val ?? "";
                        setPreInitLiveValue(v);
                        setCustomPreInitCode(preInitEditVariant, v);
                        flashSave();
                      }}
                      options={editorOptions(false)}
                    />
                  </div>
                </div>

                {/* Right: readonly with Local/Public tabs */}
                <div
                  style={{ flex: 1, display: "flex", flexDirection: "column" }}
                >
                  <PreviewTabs
                    value={preInitRightVariant}
                    onChange={setPreInitRightVariant}
                    isLightMode={isLightMode}
                    borderColor={borderColor}
                    panelHeaderBg={panelHeaderBg}
                    panelHeaderColor={panelHeaderColor}
                    hideLabel
                  />
                  <div style={{ flex: 1 }}>
                    <Editor
                      key={`preinit-right-${preInitRightVariant}`}
                      height="100%"
                      defaultLanguage="javascript"
                      theme={isLightMode ? "vs-light" : "vs-dark"}
                      value={getPreInitRightValue(preInitRightVariant)}
                      onMount={handleReadonlyMount}
                      options={editorOptions(true)}
                    />
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div
                style={{
                  padding: "4px 14px",
                  fontSize: 10,
                  color: "#888",
                  background: panelHeaderBg,
                  borderTop: `1px solid ${borderColor}`,
                  flexShrink: 0,
                }}
              >
                Editing {preInitEditVariant}. Right panel shows full async IIFE
                context around injection point.
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
