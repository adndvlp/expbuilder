import React, { useState, useRef, useEffect, useCallback } from "react";
import Konva from "konva";
import Modal from "../ParameterMapper/Modal";
import { useComponentMetadata } from "../hooks/useComponentMetadata";
import {
  ComponentType,
  TrialComponent,
  KonvaTrialDesignerProps,
} from "./types";
import ComponentSidebar from "./ComponentSidebar";
import useConfigComponents from "./useConfigFromComponents";
import renderComponent from "./renderComponent";
import useLoadComponents from "./useLoadComponents";
import handleDrop from "./useHandleDrop";
import ActionButtons from "./ActionButtons";
import KonvaCanvas, { CanvasContextMenuRequest } from "./KonvaCanvas";
import KonvaParameterMapper from "./KonvaParameterMapper";
import useHandleResize from "./useHandleResize";
import CanvasStylesBar from "./CanvasStylesBar";
import CanvasContextMenu, { CanvasContextMenuState } from "./CanvasContextMenu";
import ExperimentPreview from "../../../ExperimentPreview";
import useCanvasStyles from "../../../../hooks/useCanvasStyles";
import { HtmlSceneMetrics } from "./experimentalScene/sceneModel";
import { CanvasGuide, SnapBox, snapComponentBox } from "./editorGuides";
import {
  applyComponentConfigPatch,
  ConfigPatch,
  typedValue,
} from "./componentConfigUpdates";
import {
  buildPastedComponents,
  cloneTrialComponents,
  getSelectedTrialComponents,
} from "./designerComponentClipboard";

const MAX_HISTORY_ENTRIES = 80;

function isEditableShortcutTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;

  return Boolean(
    target.closest(
      'input, textarea, select, [contenteditable="true"], [role="textbox"]',
    ),
  );
}

const KonvaTrialDesigner: React.FC<KonvaTrialDesignerProps> = ({
  isOpen,
  onClose,
  isAutoSaving,
  onSave,
  onAutoSave,
  columnMapping,
  csvColumns,
  uploadedFiles = [],
}) => {
  const [components, setComponents] = useState<TrialComponent[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const selectedId = selectedIds[0] ?? null;
  const setSelectedId = useCallback<
    React.Dispatch<React.SetStateAction<string | null>>
  >((value) => {
    setSelectedIds((prevSelectedIds) => {
      const prevSelectedId = prevSelectedIds[0] ?? null;
      const nextSelectedId =
        typeof value === "function" ? value(prevSelectedId) : value;

      return nextSelectedId ? [nextSelectedId] : [];
    });
  }, []);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [activeGuides, setActiveGuides] = useState<CanvasGuide[]>([]);
  const [contextMenu, setContextMenu] = useState<CanvasContextMenuState | null>(
    null,
  );
  const [clipboardCount, setClipboardCount] = useState(0);
  const [historyCount, setHistoryCount] = useState(0);
  const { canvasStyles, setCanvasStyles } = useCanvasStyles();
  const [isDemoRunning, setIsDemoRunning] = useState(false);

  const stageRef = useRef<Konva.Stage>(null);
  const componentsRef = useRef<TrialComponent[]>([]);
  const clipboardComponentsRef = useRef<TrialComponent[]>([]);
  const historyRef = useRef<TrialComponent[][]>([]);
  const pasteCountRef = useRef(0);
  // Track previous canvas size to rescale component positions on resize
  const prevCanvasSizeRef = useRef<{ width: number; height: number } | null>(
    null,
  );

  const selectedComponent = components.find((c) => c.id === selectedId);
  const { metadata: componentMetadata, loading: metadataLoading } =
    useComponentMetadata(selectedComponent?.type || null);

  useEffect(() => {
    componentsRef.current = components;
    setSelectedIds((prevSelectedIds) => {
      const existingIds = new Set(components.map((component) => component.id));
      const nextSelectedIds = prevSelectedIds.filter((id) =>
        existingIds.has(id),
      );

      return nextSelectedIds.length === prevSelectedIds.length
        ? prevSelectedIds
        : nextSelectedIds;
    });
  }, [components]);

  useEffect(() => {
    if (!isOpen) return;

    clipboardComponentsRef.current = [];
    historyRef.current = [];
    pasteCountRef.current = 0;
    setClipboardCount(0);
    setHistoryCount(0);
    setContextMenu(null);
  }, [isOpen]);

  useEffect(() => {
    if (!editingTextId) return;
    const stillExists = components.some(
      (component) => component.id === editingTextId,
    );
    if (!stillExists || selectedId !== editingTextId) {
      setEditingTextId(null);
    }
  }, [components, editingTextId, selectedId]);

  useEffect(() => {
    setActiveGuides([]);
  }, [selectedId]);

  const [leftPanelWidth, setLeftPanelWidth] = useState(280);
  const [rightPanelWidth, setRightPanelWidth] = useState(400);
  const [showLeftPanel, setShowLeftPanel] = useState(true);
  const [showRightPanel, setShowRightPanel] = useState(true);
  const isResizingLeft = useRef(false);
  const isResizingRight = useRef(false);

  const CANVAS_WIDTH = canvasStyles.width;
  const CANVAS_HEIGHT = canvasStyles.height;

  const [stageScale, setStageScale] = useState(1);
  const canvasContainerRef = useRef<HTMLDivElement>(null);

  // Convert jsPsych coordinates (-100 to 100) to canvas coordinates (px)
  const fromJsPsychCoords = (coords: { x: number; y: number }) => {
    const centerX = CANVAS_WIDTH / 2;
    const centerY = CANVAS_HEIGHT / 2;

    return {
      x: centerX + (coords.x / 100) * (CANVAS_WIDTH / 2),
      y: centerY - (coords.y / 100) * (CANVAS_HEIGHT / 2),
    };
  };

  // Calculate stage scale based on available space
  useEffect(() => {
    const updateScale = () => {
      if (!canvasContainerRef.current) return;

      const container = canvasContainerRef.current;
      const availableWidth = container.clientWidth;
      const availableHeight = container.clientHeight;

      // Calculate scale to fit canvas in available space
      const scaleX = availableWidth / CANVAS_WIDTH;
      const scaleY = availableHeight / CANVAS_HEIGHT;
      const scale = Math.min(scaleX, scaleY, 1); // Never scale up, only down

      setStageScale(scale);
    };

    updateScale();
    window.addEventListener("resize", updateScale);

    // Update scale when panels resize
    const intervalId = setInterval(updateScale, 100);

    return () => {
      window.removeEventListener("resize", updateScale);
      clearInterval(intervalId);
    };
  }, [
    CANVAS_WIDTH,
    CANVAS_HEIGHT,
    leftPanelWidth,
    rightPanelWidth,
    showLeftPanel,
    showRightPanel,
  ]);

  useLoadComponents({
    isOpen,
    columnMapping,
    setComponents,
    setSelectedId,
    CANVAS_HEIGHT,
    CANVAS_WIDTH,
    fromJsPsychCoords,
    setCanvasStyles,
  });

  // When canvas size changes, keep the current layout proportional.
  // Do not store per-screen layout overrides; runtime uses the base layout only.
  useEffect(() => {
    const prev = prevCanvasSizeRef.current;
    if (
      prev &&
      (prev.width !== CANVAS_WIDTH || prev.height !== CANVAS_HEIGHT)
    ) {
      setComponents((comps) => {
        if (comps.length === 0) return comps;

        const rescaled = comps.map((comp) => {
          return {
            ...comp,
            x: (comp.x / prev.width) * CANVAS_WIDTH,
            y: (comp.y / prev.height) * CANVAS_HEIGHT,
            width: (comp.width / prev.width) * CANVAS_WIDTH,
            height: (comp.height / prev.width) * CANVAS_WIDTH,
          };
        });

        if (onAutoSave) {
          const config = generateConfigFromComponents(rescaled);
          setTimeout(() => onAutoSave(config), 100);
        }
        return rescaled;
      });
    }
    prevCanvasSizeRef.current = { width: CANVAS_WIDTH, height: CANVAS_HEIGHT };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [CANVAS_WIDTH, CANVAS_HEIGHT]);

  const onRenderComponent = (
    comp: TrialComponent,
    htmlSceneMetrics: HtmlSceneMetrics,
    setActiveDomId?: React.Dispatch<React.SetStateAction<string | null>>,
  ) => {
    return renderComponent({
      comp,
      setComponents,
      toJsPsychCoords,
      selectedId,
      selectedIds,
      onAutoSave,
      generateConfigFromComponents,
      setSelectedId,
      components,
      uploadedFiles,
      canvasStyles,
      htmlSceneMetrics,
      setActiveDomId,
      editingTextId,
      onEditTextStart: setEditingTextId,
      onRecordHistory: pushHistory,
      onSnap: handleSnap,
      onGuidesChange: setActiveGuides,
    });
  };

  const toJsPsychCoords = useCallback(
    (x: number, y: number) => {
      const centerX = CANVAS_WIDTH / 2;
      const centerY = CANVAS_HEIGHT / 2;

      return {
        x: Math.max(
          -100,
          Math.min(100, ((x - centerX) / (CANVAS_WIDTH / 2)) * 100),
        ),
        y: Math.max(
          -100,
          Math.min(100, ((centerY - y) / (CANVAS_HEIGHT / 2)) * 100),
        ),
      };
    },
    [CANVAS_HEIGHT, CANVAS_WIDTH],
  );

  const generateConfigFromComponents = useConfigComponents({
    toJsPsychCoords,
    columnMapping,
    canvasStyles,
  });

  const autoSaveComponents = useCallback(
    (nextComponents: TrialComponent[]) => {
      if (!onAutoSave) return;

      const config = generateConfigFromComponents(nextComponents);
      setTimeout(() => onAutoSave(config), 100);
    },
    [generateConfigFromComponents, onAutoSave],
  );

  const pushHistory = useCallback((snapshot = componentsRef.current) => {
    historyRef.current = [
      ...historyRef.current,
      cloneTrialComponents(snapshot),
    ].slice(-MAX_HISTORY_ENTRIES);
    setHistoryCount(historyRef.current.length);
  }, []);

  const setComponentsWithHistory: React.Dispatch<
    React.SetStateAction<TrialComponent[]>
  > = useCallback(
    (value) => {
      const prevComponents = componentsRef.current;
      const nextComponents =
        typeof value === "function"
          ? (value as (prev: TrialComponent[]) => TrialComponent[])(
              prevComponents,
            )
          : value;

      if (nextComponents === prevComponents) return;

      pushHistory(prevComponents);
      componentsRef.current = nextComponents;
      setComponents(nextComponents);
    },
    [pushHistory],
  );

  const setComponentsWithHistoryAndAutoSave: React.Dispatch<
    React.SetStateAction<TrialComponent[]>
  > = useCallback(
    (value) => {
      const prevComponents = componentsRef.current;
      const nextComponents =
        typeof value === "function"
          ? (value as (prev: TrialComponent[]) => TrialComponent[])(
              prevComponents,
            )
          : value;

      if (nextComponents === prevComponents) return;

      pushHistory(prevComponents);
      componentsRef.current = nextComponents;
      setComponents(nextComponents);
      autoSaveComponents(nextComponents);
    },
    [autoSaveComponents, pushHistory],
  );

  const getSelectedIdsForCommand = useCallback(() => {
    return selectedIds;
  }, [selectedIds]);

  const copySelectedComponents = useCallback(() => {
    const idsToCopy = getSelectedIdsForCommand();
    if (idsToCopy.length === 0) return false;

    const selectedComponents = getSelectedTrialComponents(
      componentsRef.current,
      idsToCopy,
    );
    if (selectedComponents.length === 0) return false;

    clipboardComponentsRef.current = cloneTrialComponents(selectedComponents);
    pasteCountRef.current = 0;
    setClipboardCount(selectedComponents.length);
    return true;
  }, [getSelectedIdsForCommand]);

  const deleteSelectedComponents = useCallback(() => {
    const idsToDelete = getSelectedIdsForCommand();
    if (idsToDelete.length === 0) return false;

    const selectedIdSet = new Set(idsToDelete);
    const prevComponents = componentsRef.current;
    const nextComponents = prevComponents.filter(
      (component) => !selectedIdSet.has(component.id),
    );
    if (nextComponents.length === prevComponents.length) return false;

    pushHistory(prevComponents);
    componentsRef.current = nextComponents;
    setComponents(nextComponents);
    setSelectedIds([]);
    setEditingTextId(null);
    autoSaveComponents(nextComponents);
    return true;
  }, [autoSaveComponents, getSelectedIdsForCommand, pushHistory]);

  const pasteClipboardComponents = useCallback(
    (pasteAt?: { x: number; y: number }) => {
      if (clipboardComponentsRef.current.length === 0) return false;

      pasteCountRef.current += 1;
      const prevComponents = componentsRef.current;
      const pastedComponents = buildPastedComponents({
        clipboardComponents: clipboardComponentsRef.current,
        existingComponents: prevComponents,
        canvasWidth: CANVAS_WIDTH,
        canvasHeight: CANVAS_HEIGHT,
        toJsPsychCoords,
        pasteAt,
        pasteCount: pasteCountRef.current,
      });

      /* v8 ignore start -- empty clipboard is already guarded above. */
      if (pastedComponents.length === 0) return false;
      /* v8 ignore stop */

      const nextComponents = [...prevComponents, ...pastedComponents];
      pushHistory(prevComponents);
      componentsRef.current = nextComponents;
      setComponents(nextComponents);
      setSelectedIds(pastedComponents.map((component) => component.id));
      setEditingTextId(null);
      autoSaveComponents(nextComponents);
      return true;
    },
    [
      CANVAS_HEIGHT,
      CANVAS_WIDTH,
      autoSaveComponents,
      pushHistory,
      toJsPsychCoords,
    ],
  );

  const cutSelectedComponents = useCallback(() => {
    if (!copySelectedComponents()) return false;
    return deleteSelectedComponents();
  }, [copySelectedComponents, deleteSelectedComponents]);

  const selectAllComponents = useCallback(() => {
    const nextSelectedIds = componentsRef.current.map(
      (component) => component.id,
    );
    if (nextSelectedIds.length === 0) return false;

    setSelectedIds(nextSelectedIds);
    setEditingTextId(null);
    return true;
  }, []);

  const undoLastChange = useCallback(() => {
    const previousComponents = historyRef.current.pop();
    if (!previousComponents) return false;

    const restoredComponents = cloneTrialComponents(previousComponents);
    historyRef.current = [...historyRef.current];
    setHistoryCount(historyRef.current.length);
    componentsRef.current = restoredComponents;
    setComponents(restoredComponents);
    setSelectedIds((prevSelectedIds) => {
      const restoredIdSet = new Set(
        restoredComponents.map((component) => component.id),
      );
      return prevSelectedIds.filter((id) => restoredIdSet.has(id));
    });
    setEditingTextId(null);
    autoSaveComponents(restoredComponents);
    return true;
  }, [autoSaveComponents]);

  const handleCanvasContextMenu = useCallback(
    (request: CanvasContextMenuRequest) => {
      if (editingTextId) return;

      if (request.componentId) {
        const componentId = request.componentId;
        setSelectedIds((prevSelectedIds) =>
          prevSelectedIds.includes(componentId)
            ? prevSelectedIds
            : [componentId],
        );
      }

      setContextMenu({
        x: request.clientX,
        y: request.clientY,
        canvasX: request.canvasX,
        canvasY: request.canvasY,
        componentId: request.componentId,
      });
    },
    [editingTextId],
  );

  const handleSnap = useCallback(
    (box: SnapBox) => snapComponentBox(box, components, canvasStyles),
    [components, canvasStyles],
  );

  const patchTextComponent = useCallback(
    (
      id: string,
      patch: ConfigPatch,
      visualPatch: Partial<TrialComponent> = {},
    ) => {
      setComponents((prevComponents) => {
        const updatedComponents = prevComponents.map((component) =>
          component.id === id
            ? applyComponentConfigPatch(component, patch, visualPatch)
            : component,
        );

        if (onAutoSave) {
          const config = generateConfigFromComponents(updatedComponents);
          setTimeout(() => onAutoSave(config), 100);
        }

        return updatedComponents;
      });
    },
    [generateConfigFromComponents, onAutoSave],
  );

  const commitTextEdit = useCallback(
    (id: string, text: string) => {
      pushHistory();
      patchTextComponent(id, { text: typedValue(text) });
      setEditingTextId(null);
    },
    [patchTextComponent, pushHistory],
  );

  useHandleResize({
    isResizingLeft,
    setShowLeftPanel,
    setLeftPanelWidth,
    isResizingRight,
    setRightPanelWidth,
    setShowRightPanel,
  });

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        if (contextMenu) {
          setContextMenu(null);
          return;
        }
        if (editingTextId) {
          setEditingTextId(null);
          return;
        }
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      return () => document.removeEventListener("keydown", handleEscape);
    }
  }, [contextMenu, editingTextId, isOpen, onClose]);

  useEffect(() => {
    if (!contextMenu) return;

    const closeContextMenu = () => setContextMenu(null);
    window.addEventListener("click", closeContextMenu);
    window.addEventListener("blur", closeContextMenu);
    window.addEventListener("resize", closeContextMenu);
    window.addEventListener("scroll", closeContextMenu, true);

    return () => {
      window.removeEventListener("click", closeContextMenu);
      window.removeEventListener("blur", closeContextMenu);
      window.removeEventListener("resize", closeContextMenu);
      window.removeEventListener("scroll", closeContextMenu, true);
    };
  }, [contextMenu]);

  useEffect(() => {
    if (!isOpen || isDemoRunning || editingTextId) return;

    const handleKeyboardCommand = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
      if (isEditableShortcutTarget(event.target)) return;

      const key = event.key.toLowerCase();
      if (key === "c") {
        if (copySelectedComponents()) {
          event.preventDefault();
        }
      } else if (key === "x") {
        if (cutSelectedComponents()) {
          event.preventDefault();
        }
      } else if (key === "v") {
        if (pasteClipboardComponents()) {
          event.preventDefault();
        }
      } else if (key === "z") {
        if (undoLastChange()) {
          event.preventDefault();
        }
      } else if (key === "a") {
        if (selectAllComponents()) {
          event.preventDefault();
        }
      }
    };

    document.addEventListener("keydown", handleKeyboardCommand);
    return () => {
      document.removeEventListener("keydown", handleKeyboardCommand);
    };
  }, [
    copySelectedComponents,
    cutSelectedComponents,
    editingTextId,
    isDemoRunning,
    isOpen,
    pasteClipboardComponents,
    selectAllComponents,
    undoLastChange,
  ]);

  const onDrop = (e: React.DragEvent, fileUrl: string, type: ComponentType) => {
    handleDrop({
      e,
      fileUrl,
      type,
      stageRef,
      components,
      setComponents: setComponentsWithHistory,
      setSelectedId,
      toJsPsychCoords,
      getDefaultConfig,
      onAutoSave,
      generateConfigFromComponents,
    });
  };

  // Per-component-type default config values so components work on first drop
  const getDefaultConfig = (type: ComponentType): Record<string, any> => {
    const v = (value: any) => ({ source: "typed" as const, value });

    const defaults: Partial<Record<ComponentType, Record<string, any>>> = {
      ButtonResponseComponent: {
        choices: v(["Button"]),
        button_color: v("#e7e7e7"),
        button_text_color: v("#000000"),
        button_font_size: v(14),
        button_border_radius: v(3),
        button_border_color: v("#999999"),
        button_border_width: v(1),
        button_padding: v("6px 14px"),
      },
      TextComponent: {
        text: v("Text"),
        font_color: v("#000000"),
        font_size: v(16),
        font_family: v("sans-serif"),
        font_weight: v("normal"),
        font_style: v("normal"),
        text_align: v("center"),
        line_height: v(1.5),
        background_color: v("transparent"),
        padding: v("0px"),
        border_radius: v(0),
        border_color: v("transparent"),
        border_width: v(0),
      },
      HtmlComponent: {
        stimulus: v("<p>HTML</p>"),
      },
      ImageComponent: {
        stimulus: v(""),
      },
      SliderResponseComponent: {
        min: v(0),
        max: v(100),
        slider_start: v(50),
        step: v(1),
        labels: v(["0", "50", "100"]),
        slider_width: v(300),
      },
      KeyboardResponseComponent: {
        choices: v("ALL_KEYS"),
      },
      InputResponseComponent: {
        text: v("%%"),
        check_answers: v(false),
        allow_blanks: v(true),
      },
      FileUploadResponseComponent: {
        accept: v("pdf, csv"),
        multiple: v(false),
        button_label: v("Upload File"),
        show_preview: v(true),
      },
      AudioComponent: {
        stimulus: v(""),
      },
      VideoComponent: {
        stimulus: v([""]),
      },
      SketchpadComponent: {
        canvas_shape: v("rectangle"),
        canvas_width: v(400),
        canvas_height: v(300),
        canvas_border_width: v(2),
        canvas_border_color: v("#000000"),
        background_color: v("#ffffff"),
        stroke_width: v(3),
        stroke_color: v("#000000"),
        show_clear_button: v(true),
        clear_button_label: v("Clear"),
        show_undo_button: v(true),
        undo_button_label: v("Undo"),
      },
      SurveyComponent: {
        survey_json: v({
          pages: [
            {
              elements: [
                {
                  type: "text",
                  name: "question1",
                  title: "Your question here",
                },
              ],
            },
          ],
        }),
      },
      ClickResponseComponent: {
        capture_full_screen: v(true),
        show_click_marker: v(false),
        marker_color: v("#e74c3c"),
        marker_radius: v(8),
        zIndex: v(10),
      },
    };

    return defaults[type] ?? {};
  };

  // Wrapper for setComponents to trigger autosave from Sidebar
  const setComponentsWrapper: React.Dispatch<
    React.SetStateAction<TrialComponent[]>
  > = setComponentsWithHistoryAndAutoSave;

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          height: "100%",
          width: "100%",
        }}
      >
        {/* Global styles toolbar */}
        <CanvasStylesBar
          canvasStyles={canvasStyles}
          setCanvasStyles={setCanvasStyles}
          stageScale={stageScale}
          isDemoRunning={isDemoRunning}
          onRunDemo={() => setIsDemoRunning(true)}
          onStopDemo={() => setIsDemoRunning(false)}
        />

        {/* Demo preview overlay */}
        {isDemoRunning && (
          <div
            style={{
              position: "absolute",
              top: 42,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 50,
              background: "var(--neutral-light)",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            <ExperimentPreview
              uploadedFiles={uploadedFiles}
              canvasStyles={canvasStyles}
              autoStart={true}
            />
          </div>
        )}

        {/* Main content area with 3 panels */}
        <div style={{ display: "flex", flex: 1, gap: 0, overflow: "hidden" }}>
          <ComponentSidebar
            setLeftPanelWidth={setLeftPanelWidth}
            leftPanelWidth={leftPanelWidth}
            showLeftPanel={showLeftPanel}
            setShowLeftPanel={setShowLeftPanel}
            isResizingLeft={isResizingLeft}
            isOpen={isOpen}
            CANVAS_WIDTH={CANVAS_WIDTH}
            CANVAS_HEIGHT={CANVAS_HEIGHT}
            toJsPsychCoords={toJsPsychCoords}
            setComponents={setComponentsWrapper}
            getDefaultConfig={getDefaultConfig}
            selectedId={selectedId}
            selectedIds={selectedIds}
            setSelectedId={setSelectedId}
            setSelectedIds={setSelectedIds}
            components={components}
          />

          {/* Canvas */}
          <KonvaCanvas
            canvasContainerRef={canvasContainerRef}
            CANVAS_HEIGHT={CANVAS_HEIGHT}
            CANVAS_WIDTH={CANVAS_WIDTH}
            stageScale={stageScale}
            stageRef={stageRef}
            selectedId={selectedId}
            onDrop={onDrop}
            setSelectedId={setSelectedId}
            components={components}
            uploadedFiles={uploadedFiles}
            activeGuides={activeGuides}
            onGuidesChange={setActiveGuides}
            editingTextId={editingTextId}
            onCommitTextEdit={commitTextEdit}
            onCancelTextEdit={() => setEditingTextId(null)}
            onCanvasContextMenu={handleCanvasContextMenu}
            onRenderComponent={onRenderComponent}
            canvasStyles={canvasStyles}
          />

          {/* Right Panel - Parameter Mapper */}
          {showRightPanel && (
            <KonvaParameterMapper
              rightPanelWidth={rightPanelWidth}
              selectedId={selectedId}
              selectedComponent={selectedComponent}
              metadataLoading={metadataLoading}
              componentMetadata={componentMetadata}
              components={components}
              setComponents={setComponents}
              fromJsPsychCoords={fromJsPsychCoords}
              canvasWidth={CANVAS_WIDTH}
              onAutoSave={onAutoSave}
              generateConfigFromComponents={generateConfigFromComponents}
              onRecordHistory={pushHistory}
              isResizingRight={isResizingRight}
              setShowRightPanel={setShowRightPanel}
              setRightPanelWidth={setRightPanelWidth}
              csvColumns={csvColumns}
              uploadedFiles={uploadedFiles}
            />
          )}

          {/* Toggle button for right panel */}
          {!showRightPanel && (
            <button
              onClick={() => setShowRightPanel(true)}
              style={{
                position: "absolute",
                right: 0,
                top: "50%",
                transform: "translateY(-50%)",
                background: "var(--primary-blue)",
                color: "var(--text-light)",
                border: "none",
                borderRadius: "8px 0 0 8px",
                padding: "16px 8px",
                cursor: "pointer",
                zIndex: 20,
                fontSize: "18px",
                fontWeight: "bold",
              }}
            >
              ‹
            </button>
          )}
        </div>

        <CanvasContextMenu
          state={contextMenu}
          canCopy={selectedIds.length > 0}
          canPaste={clipboardCount > 0}
          canUndo={historyCount > 0}
          hasComponents={components.length > 0}
          onCopy={copySelectedComponents}
          onCut={cutSelectedComponents}
          onPaste={() =>
            pasteClipboardComponents(
              contextMenu
                ? { x: contextMenu.canvasX, y: contextMenu.canvasY }
                : undefined,
            )
          }
          onDelete={deleteSelectedComponents}
          onSelectAll={selectAllComponents}
          onUndo={undoLastChange}
          onClose={() => setContextMenu(null)}
        />

        <ActionButtons
          onAutoSave={onAutoSave}
          onClose={onClose}
          isAutoSaving={isAutoSaving}
          generateConfigFromComponents={generateConfigFromComponents}
          onSave={onSave}
          components={components}
        />
      </div>
    </Modal>
  );
};

export default KonvaTrialDesigner;
