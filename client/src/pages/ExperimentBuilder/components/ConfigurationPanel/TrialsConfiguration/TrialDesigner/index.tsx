import React, { useState, useRef, useEffect } from "react";
import Konva from "konva";
import Modal from "../ParameterMapper/Modal";
import { useComponentMetadata } from "../hooks/useComponentMetadata";
import {
  ComponentType,
  TrialComponent,
  KonvaTrialDesignerProps,
  CanvasStyles,
  DEFAULT_CANVAS_STYLES,
} from "./types";
import ComponentSidebar from "./ComponentSidebar";
import useConfigComponents from "./useConfigFromComponents";
import renderComponent from "./renderComponent";
import useLoadComponents from "./useLoadComponents";
import handleDrop from "./useHandleDrop";
import ActionButtons from "./ActionButtons";
import KonvaCanvas from "./KonvaCanvas";
import KonvaParameterMapper from "./KonvaParameterMapper";
import useHandleResize from "./useHandleResize";
import CanvasStylesBar from "./CanvasStylesBar";
import ExperimentPreview from "../../../ExperimentPreview";

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
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [canvasStyles, setCanvasStyles] = useState<CanvasStyles>(
    DEFAULT_CANVAS_STYLES,
  );
  const [isDemoRunning, setIsDemoRunning] = useState(false);

  const stageRef = useRef<Konva.Stage>(null);
  // Track previous canvas size to rescale component positions on resize
  const prevCanvasSizeRef = useRef<{ width: number; height: number } | null>(
    null,
  );

  const selectedComponent = components.find((c) => c.id === selectedId);
  const { metadata: componentMetadata, loading: metadataLoading } =
    useComponentMetadata(selectedComponent?.type || null);

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
    setCanvasStyles,
  });

  // When canvas size changes (device preset switch), proportionally rescale
  // all component pixel positions AND sizes to maintain their relative layout.
  useEffect(() => {
    const prev = prevCanvasSizeRef.current;
    if (
      prev &&
      (prev.width !== CANVAS_WIDTH || prev.height !== CANVAS_HEIGHT)
    ) {
      setComponents((comps) => {
        if (comps.length === 0) return comps;
        const rescaled = comps.map((comp) => {
          // All components store both width AND height as vw (% of canvas width),
          // so both dimensions rescale relative to CANVAS_WIDTH.
          return {
            ...comp,
            x: (comp.x / prev.width) * CANVAS_WIDTH,
            y: (comp.y / prev.height) * CANVAS_HEIGHT,
            width:
              comp.width > 0
                ? (comp.width / prev.width) * CANVAS_WIDTH
                : comp.width,
            height:
              comp.height > 0
                ? (comp.height / prev.width) * CANVAS_WIDTH // vw — same denominator
                : comp.height,
          };
        });
        // Trigger autosave with updated positions
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

  const onRenderComponent = (comp: TrialComponent) => {
    return renderComponent({
      comp,
      setComponents,
      toJsPsychCoords,
      selectedId,
      onAutoSave,
      generateConfigFromComponents,
      setSelectedId,
      components,
      uploadedFiles,
      canvasStyles,
    });
  };

  const toJsPsychCoords = (x: number, y: number) => {
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
  };

  const generateConfigFromComponents = useConfigComponents({
    toJsPsychCoords,
    columnMapping,
    canvasStyles,
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
        text: v("Input: %%"),
        check_answers: v(false),
        allow_blanks: v(true),
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
    };

    return defaults[type] ?? {};
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
