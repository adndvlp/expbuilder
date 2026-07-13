import React, { useState, useRef, useCallback } from "react";
import Konva from "konva";
import { useComponentMetadata } from "../hooks/useComponentMetadata";
import { TrialComponent, KonvaTrialDesignerProps } from "./types";
import useConfigComponents from "./useConfigFromComponents";
import type { CanvasContextMenuState } from "./CanvasContextMenu";
import useCanvasStyles from "../../../../hooks/useCanvasStyles";
import { CanvasGuide } from "./editorGuides";
import { getDefaultConfig } from "./utils/getDefaultConfig";
import TrialDesignerLayout from "./components/TrialDesignerLayout";
import { useDesignerClipboard } from "./hooks/useDesignerClipboard";
import { useDesignerKeyboard } from "./hooks/useDesignerKeyboard";
import { useDesignerPanels } from "./hooks/useDesignerPanels";
import { useDesignerLifecycle } from "./hooks/useDesignerLifecycle";
import { useDesignerActions } from "./hooks/useDesignerActions";
import { useComponentSelection } from "./hooks/useComponentSelection";

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
  const { selectedId, selectedIds, setSelectedId, setSelectedIds } =
    useComponentSelection();
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [activeGuides, setActiveGuides] = useState<CanvasGuide[]>([]);
  const [contextMenu, setContextMenu] = useState<CanvasContextMenuState | null>(
    null,
  );
  const { canvasStyles, setCanvasStyles } = useCanvasStyles();
  const [isDemoRunning, setIsDemoRunning] = useState(false);

  const stageRef = useRef<Konva.Stage>(null);
  const componentsRef = useRef<TrialComponent[]>([]);

  const selectedComponent = components.find((c) => c.id === selectedId);
  const { metadata: componentMetadata, loading: metadataLoading } =
    useComponentMetadata(selectedComponent?.type || null);

  const CANVAS_WIDTH = canvasStyles.width;
  const CANVAS_HEIGHT = canvasStyles.height;
  const {
    canvasContainerRef,
    fromJsPsychCoords,
    isResizingLeft,
    isResizingRight,
    leftPanelWidth,
    rightPanelWidth,
    setLeftPanelWidth,
    setRightPanelWidth,
    setShowLeftPanel,
    setShowRightPanel,
    showLeftPanel,
    showRightPanel,
    stageScale,
  } = useDesignerPanels(CANVAS_WIDTH, CANVAS_HEIGHT);

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

  const {
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
  } = useDesignerClipboard({
    autoSaveComponents,
    canvasHeight: CANVAS_HEIGHT,
    canvasWidth: CANVAS_WIDTH,
    componentsRef,
    isOpen,
    selectedIds,
    setComponents,
    setEditingTextId,
    setSelectedIds,
    toJsPsychCoords,
  });

  useDesignerLifecycle({
    canvasHeight: CANVAS_HEIGHT,
    canvasStyles,
    canvasWidth: CANVAS_WIDTH,
    columnMapping,
    components,
    componentsRef,
    editingTextId,
    fromJsPsychCoords,
    generateConfig: generateConfigFromComponents,
    isOpen,
    onAutoSave,
    selectedId,
    setActiveGuides,
    setCanvasStyles,
    setComponents,
    setContextMenu,
    setEditingTextId,
    setSelectedId,
    setSelectedIds,
  });

  const { commitTextEdit, handleCanvasContextMenu, onDrop, onRenderComponent } =
    useDesignerActions({
      canvasStyles,
      components,
      editingTextId,
      generateConfig: generateConfigFromComponents,
      onAutoSave,
      pushHistory,
      selectedId,
      selectedIds,
      setActiveGuides,
      setComponents,
      setComponentsWithHistory,
      setContextMenu,
      setEditingTextId,
      setSelectedId,
      setSelectedIds,
      stageRef,
      toJsPsychCoords,
      uploadedFiles,
    });

  useDesignerKeyboard({
    contextMenu,
    copy: copySelectedComponents,
    cut: cutSelectedComponents,
    editingTextId,
    isDemoRunning,
    isOpen,
    onClose,
    paste: pasteClipboardComponents,
    selectAll: selectAllComponents,
    setContextMenu,
    setEditingTextId,
    undo: undoLastChange,
  });

  // Wrapper for setComponents to trigger autosave from Sidebar
  const setComponentsWrapper: React.Dispatch<
    React.SetStateAction<TrialComponent[]>
  > = setComponentsWithHistoryAndAutoSave;

  return (
    <TrialDesignerLayout
      modalProps={{ isOpen, onClose }}
      toolbarProps={{
        canvasStyles,
        setCanvasStyles,
        stageScale,
        isDemoRunning,
        onRunDemo: () => setIsDemoRunning(true),
        onStopDemo: () => setIsDemoRunning(false),
      }}
      isDemoRunning={isDemoRunning}
      previewProps={{ uploadedFiles, canvasStyles, autoStart: true }}
      sidebarProps={{
        setLeftPanelWidth,
        leftPanelWidth,
        showLeftPanel,
        setShowLeftPanel,
        isResizingLeft,
        isOpen,
        CANVAS_WIDTH,
        CANVAS_HEIGHT,
        toJsPsychCoords,
        setComponents: setComponentsWrapper,
        getDefaultConfig,
        selectedId,
        selectedIds,
        setSelectedId,
        setSelectedIds,
        components,
      }}
      canvasProps={{
        canvasContainerRef,
        CANVAS_HEIGHT,
        CANVAS_WIDTH,
        stageScale,
        stageRef,
        selectedId,
        onDrop,
        setSelectedId,
        components,
        uploadedFiles,
        activeGuides,
        onGuidesChange: setActiveGuides,
        editingTextId,
        onCommitTextEdit: commitTextEdit,
        onCancelTextEdit: () => setEditingTextId(null),
        onCanvasContextMenu: handleCanvasContextMenu,
        onRenderComponent,
        canvasStyles,
      }}
      showRightPanel={showRightPanel}
      setShowRightPanel={setShowRightPanel}
      mapperProps={{
        rightPanelWidth,
        selectedId,
        selectedComponent,
        metadataLoading,
        componentMetadata,
        components,
        setComponents,
        fromJsPsychCoords,
        canvasWidth: CANVAS_WIDTH,
        onAutoSave,
        generateConfigFromComponents,
        onRecordHistory: pushHistory,
        isResizingRight,
        setShowRightPanel,
        setRightPanelWidth,
        csvColumns,
        uploadedFiles,
      }}
      contextMenuProps={{
        state: contextMenu,
        canCopy: selectedIds.length > 0,
        canPaste: clipboardCount > 0,
        canUndo: historyCount > 0,
        hasComponents: components.length > 0,
        onCopy: copySelectedComponents,
        onCut: cutSelectedComponents,
        onPaste: () =>
          pasteClipboardComponents(
            contextMenu
              ? { x: contextMenu.canvasX, y: contextMenu.canvasY }
              : undefined,
          ),
        onDelete: deleteSelectedComponents,
        onSelectAll: selectAllComponents,
        onUndo: undoLastChange,
        onClose: () => setContextMenu(null),
      }}
      actionProps={{
        onAutoSave,
        onClose,
        isAutoSaving,
        generateConfigFromComponents,
        onSave,
        components,
      }}
    />
  );
};

export default KonvaTrialDesigner;
