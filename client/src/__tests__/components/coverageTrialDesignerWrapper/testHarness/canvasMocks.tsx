import { vi } from "vitest";

vi.mock(
  "../../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/CanvasStylesBar",
  () => ({
    default: ({
      canvasStyles,
      setCanvasStyles,
      isDemoRunning,
      onRunDemo,
      onStopDemo,
    }: any) => (
      <div data-testid="canvas-styles-bar">
        <span>canvas width:{canvasStyles.width}</span>
        <span>demo:{String(isDemoRunning)}</span>
        <button
          onClick={() =>
            setCanvasStyles((prev: any) => ({
              ...prev,
              width: prev.width + 100,
              height: prev.height + 50,
            }))
          }
        >
          resize canvas
        </button>
        <button
          onClick={() =>
            setCanvasStyles((prev: any) => ({
              ...prev,
              height: prev.height + 50,
            }))
          }
        >
          resize canvas height
        </button>
        <button onClick={onRunDemo}>run demo</button>
        <button onClick={onStopDemo}>stop demo</button>
      </div>
    ),
  }),
);

vi.mock(
  "../../../../pages/ExperimentBuilder/components/ExperimentPreview",
  () => ({
    default: ({ autoStart }: any) => (
      <div data-testid="experiment-preview">preview:{String(autoStart)}</div>
    ),
  }),
);

vi.mock(
  "../../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/KonvaCanvas",
  () => ({
    default: ({
      canvasContainerRef,
      components,
      selectedId,
      setSelectedId,
      editingTextId,
      onDrop,
      onRenderComponent,
      onCanvasContextMenu,
      onCommitTextEdit,
      onCancelTextEdit,
      onGuidesChange,
    }: any) => (
      <div
        data-testid="konva-canvas"
        ref={(node) => {
          if (!node) return;
          Object.defineProperty(node, "clientWidth", {
            configurable: true,
            value: 800,
          });
          Object.defineProperty(node, "clientHeight", {
            configurable: true,
            value: 600,
          });
          canvasContainerRef.current = node;
        }}
      >
        <div>canvas selected:{selectedId ?? "none"}</div>
        <div>editing:{editingTextId ?? "none"}</div>
        <div>canvas components:{components.length}</div>
        <button
          onClick={() =>
            setSelectedId((prev: string | null) => (prev ? null : "text-a"))
          }
        >
          canvas functional select
        </button>
        <button
          onClick={() =>
            components[0] &&
            onRenderComponent(
              components[0],
              {},
              vi.fn(() => undefined),
            )
          }
        >
          canvas render component
        </button>
        <button
          onClick={() =>
            onDrop(
              { preventDefault: vi.fn() },
              "file://drop.png",
              "ImageComponent",
            )
          }
        >
          canvas drop
        </button>
        <button
          onClick={() =>
            onCanvasContextMenu({
              clientX: 20,
              clientY: 30,
              canvasX: 120,
              canvasY: 140,
              componentId: components[0]?.id ?? null,
            })
          }
        >
          canvas context
        </button>
        <button onClick={() => onCommitTextEdit("text-a", "Edited text")}>
          canvas commit text
        </button>
        <button onClick={onCancelTextEdit}>canvas cancel text</button>
        <button
          onClick={() =>
            onGuidesChange([{ orientation: "horizontal", position: 200 }])
          }
        >
          canvas guide
        </button>
      </div>
    ),
  }),
);
