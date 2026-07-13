import { vi } from "vitest";

vi.mock(
  "../../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/snapKonvaNode",
  () => ({
    snapKonvaNode: ({ node, onGuidesChange }: any) => {
      onGuidesChange?.([{ orientation: "vertical", position: 100 }]);
      return { x: node.x(), y: node.y() };
    },
  }),
);

vi.mock(
  "../../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/VisualComponents",
  () => {
    const visualMock =
      (name: string) =>
      ({ shapeProps, onSelect, onChange }: any) => (
        <button
          data-testid={`visual-${name}-${shapeProps.id}`}
          onClick={() => {
            onSelect();
            onChange({
              x: 210,
              y: 190,
              width: 320,
              height: 120,
              rotation: 12,
              zIndex: 7,
              textFontSize: 24,
              inputFontSize: 19,
              buttonFontSize: 18,
            });
          }}
        >
          {name}
        </button>
      );

    return {
      ImageComponent: visualMock("ImageComponent"),
      VideoComponent: visualMock("VideoComponent"),
      AudioComponent: visualMock("AudioComponent"),
      TextComponent: visualMock("TextComponent"),
      ButtonResponseComponent: visualMock("ButtonResponseComponent"),
      KeyboardResponseComponent: visualMock("KeyboardResponseComponent"),
      SliderResponseComponent: visualMock("SliderResponseComponent"),
      InputResponseComponent: visualMock("InputResponseComponent"),
      SketchpadComponent: visualMock("SketchpadComponent"),
      AudioResponseComponent: visualMock("AudioResponseComponent"),
      FileUploadResponseComponent: visualMock("FileUploadResponseComponent"),
      ClickResponseComponent: visualMock("ClickResponseComponent"),
    };
  },
);

vi.mock(
  "../../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/AlignmentGuidesLayer",
  () => ({
    default: ({ guides }: any) => (
      <div data-testid="alignment-guides">{guides.length}</div>
    ),
  }),
);

vi.mock(
  "../../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/experimentalScene/ExperimentalHtmlSceneLayer",
  () => ({
    default: ({ components, onMetricsChange, activeDomId }: any) => (
      <div>
        <button
          data-testid="html-scene-layer"
          onClick={() =>
            onMetricsChange({
              [components.find(
                (component: TrialComponent) => component.id === "front",
              )?.id ??
              components[0]?.id ??
              "missing"]: {
                width: 80,
                height: 40,
              },
            })
          }
        >
          html scene
        </button>
        <span data-testid="active-dom-id">{activeDomId ?? "none"}</span>
      </div>
    ),
  }),
);

vi.mock(
  "../../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/TextEditingOverlay",
  () => ({
    default: ({ component, onCommit, onCancel }: any) => (
      <div data-testid="text-editing-overlay">
        <span>{component?.id ?? "none"}</span>
        <button onClick={() => onCommit("Edited text")}>commit text</button>
        <button onClick={onCancel}>cancel text</button>
      </div>
    ),
  }),
);
