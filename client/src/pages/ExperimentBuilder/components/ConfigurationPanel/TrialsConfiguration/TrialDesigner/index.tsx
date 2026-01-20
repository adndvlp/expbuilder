import React, { useState, useRef, useEffect } from "react";
import Konva from "konva";
import Modal from "../Modal";
import { useComponentMetadata } from "../../hooks/useComponentMetadata";
import {
  ComponentType,
  TrialComponent,
  KonvaTrialDesignerProps,
} from "./types";
import ComponentSidebar from "./ComponentSidebar";
import useConfigComponents from "./useConfigFromComponents";
import renderComponent from "./RenderComponent";
import useLoadComponents from "./useLoadComponents";
import handleDrop from "./useHandleDrop";
import ActionButtons from "./ActionButtons";
import KonvaCanvas from "./KonvaCanvas";
import KonvaParameterMapper from "./KonvaParameterMapper";
import useHandleResize from "./useHandleResize";

const KonvaTrialDesigner: React.FC<KonvaTrialDesignerProps> = ({
  isOpen,
  onClose,
  isAutoSaving,
  onSave,
  onAutoSave,
  columnMapping,
  csvColumns,
}) => {
  const [components, setComponents] = useState<TrialComponent[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const stageRef = useRef<Konva.Stage>(null);

  const selectedComponent = components.find((c) => c.id === selectedId);
  const { metadata: componentMetadata, loading: metadataLoading } =
    useComponentMetadata(selectedComponent?.type || null);

  const [leftPanelWidth, setLeftPanelWidth] = useState(280);
  const [rightPanelWidth, setRightPanelWidth] = useState(400);
  const [showLeftPanel, setShowLeftPanel] = useState(true);
  const [showRightPanel, setShowRightPanel] = useState(true);
  const isResizingLeft = useRef(false);
  const isResizingRight = useRef(false);

  const CANVAS_WIDTH = 1024;
  const CANVAS_HEIGHT = 768;

  const [stageScale, setStageScale] = useState(1);
  const canvasContainerRef = useRef<HTMLDivElement>(null);

  // Convert jsPsych coordinates (-1 to 1) to canvas coordinates (px)
  const fromJsPsychCoords = (coords: { x: number; y: number }) => {
    const centerX = CANVAS_WIDTH / 2;
    const centerY = CANVAS_HEIGHT / 2;

    return {
      x: centerX + coords.x * (CANVAS_WIDTH / 2),
      y: centerY + coords.y * (CANVAS_HEIGHT / 2),
    };
  };

  // Calculate stage scale based on available space
  useEffect(() => {
    const updateScale = () => {
      if (!canvasContainerRef.current) return;

      const container = canvasContainerRef.current;
      const availableWidth = container.clientWidth - 32; // padding
      const availableHeight = container.clientHeight - 32;

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
  });

  const onRenderComponent = (comp: TrialComponent) => {
    renderComponent({
      comp,
      setComponents,
      toJsPsychCoords,
      selectedId,
      onAutoSave,
      generateConfigFromComponents,
      setSelectedId,
      components,
    });
  };

  const toJsPsychCoords = (x: number, y: number) => {
    const centerX = CANVAS_WIDTH / 2;
    const centerY = CANVAS_HEIGHT / 2;

    return {
      x: Math.max(-1, Math.min(1, (x - centerX) / (CANVAS_WIDTH / 2))),
      y: Math.max(-1, Math.min(1, (y - centerY) / (CANVAS_HEIGHT / 2))),
    };
  };

  const generateConfigFromComponents = useConfigComponents({
    toJsPsychCoords,
    columnMapping,
  });

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
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      return () => document.removeEventListener("keydown", handleEscape);
    }
  }, [isOpen, onClose]);

  const onDrop = (e: React.DragEvent, fileUrl: string, type: ComponentType) => {
    handleDrop({
      e,
      fileUrl,
      type,
      stageRef,
      components,
      setComponents,
      setSelectedId,
      toJsPsychCoords,
      getDefaultConfig,
      onAutoSave,
      generateConfigFromComponents,
    });
  };

  // Return empty object - let jsPsych handle defaults
  const getDefaultConfig = (_type: ComponentType): Record<string, any> => {
    return {};
  };

  // Wrapper for setComponents to trigger autosave from Sidebar
  const setComponentsWrapper: React.Dispatch<
    React.SetStateAction<TrialComponent[]>
  > = (value) => {
    setComponents((prev) => {
      const nextComponents =
        typeof value === "function"
          ? (value as (prev: TrialComponent[]) => TrialComponent[])(prev)
          : value;

      // Trigger autosave
      if (onAutoSave) {
        const config = generateConfigFromComponents(nextComponents);
        setTimeout(() => onAutoSave(config), 100);
      }

      return nextComponents;
    });
  };

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
            setSelectedId={setSelectedId}
            components={components}
          />
          {/* Canvas */}
          <KonvaCanvas
            canvasContainerRef={canvasContainerRef}
            CANVAS_HEIGHT={CANVAS_HEIGHT}
            CANVAS_WIDTH={CANVAS_WIDTH}
            stageScale={stageScale}
            stageRef={stageRef}
            onDrop={onDrop}
            setSelectedId={setSelectedId}
            components={components}
            onRenderComponent={onRenderComponent}
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
              onAutoSave={onAutoSave}
              generateConfigFromComponents={generateConfigFromComponents}
              columnMapping={columnMapping}
              isResizingRight={isResizingRight}
              setShowRightPanel={setShowRightPanel}
              setRightPanelWidth={setRightPanelWidth}
              csvColumns={csvColumns}
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
