import { vi } from "vitest";

vi.mock(
  "../../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/KonvaParameterMapper",
  () => ({
    default: ({
      selectedId,
      selectedComponent,
      fromJsPsychCoords,
      setComponents,
      onRecordHistory,
      setShowRightPanel,
    }: any) => (
      <div data-testid="konva-parameter-mapper">
        <div>mapper selected:{selectedId ?? "none"}</div>
        <div>mapper component:{selectedComponent?.id ?? "none"}</div>
        <div>
          mapper coords:{JSON.stringify(fromJsPsychCoords({ x: 10, y: -20 }))}
        </div>
        <button
          onClick={() => {
            onRecordHistory();
            setComponents((prev: any[]) =>
              prev.map((component) =>
                component.id === selectedId
                  ? { ...component, width: component.width + 10 }
                  : component,
              ),
            );
          }}
        >
          mapper mutate
        </button>
        <button onClick={() => setShowRightPanel(false)}>
          mapper hide right
        </button>
      </div>
    ),
  }),
);

vi.mock(
  "../../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/CanvasContextMenu",
  () => ({
    default: ({
      state,
      canCopy,
      canPaste,
      canUndo,
      hasComponents,
      onCopy,
      onCut,
      onPaste,
      onDelete,
      onSelectAll,
      onUndo,
      onClose,
    }: any) => (
      <div data-testid="canvas-context-menu">
        <div>menu:{state ? `${state.componentId ?? "canvas"}` : "closed"}</div>
        <div>can-copy:{String(canCopy)}</div>
        <div>can-paste:{String(canPaste)}</div>
        <div>can-undo:{String(canUndo)}</div>
        <div>has-components:{String(hasComponents)}</div>
        <button onClick={onCopy}>menu copy</button>
        <button onClick={onCut}>menu cut</button>
        <button onClick={onPaste}>menu paste</button>
        <button onClick={onDelete}>menu delete</button>
        <button onClick={onSelectAll}>menu select all</button>
        <button onClick={onUndo}>menu undo</button>
        <button onClick={onClose}>menu close</button>
      </div>
    ),
  }),
);

vi.mock(
  "../../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/ActionButtons",
  () => ({
    default: ({
      onClose,
      onSave,
      onAutoSave,
      generateConfigFromComponents,
      components,
    }: any) => (
      <div data-testid="action-buttons">
        <button
          onClick={() => onSave(generateConfigFromComponents(components))}
        >
          action save
        </button>
        <button
          onClick={() => onAutoSave?.(generateConfigFromComponents(components))}
        >
          action autosave
        </button>
        <button onClick={onClose}>action close</button>
      </div>
    ),
  }),
);
