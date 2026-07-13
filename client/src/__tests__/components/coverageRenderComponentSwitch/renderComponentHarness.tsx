import { vi } from "vitest";
import {
  component as buildComponent,
  RenderComponentHarness,
  type RenderComponentHarnessProps,
} from "./testHarness";
import type { TrialComponent } from "../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/types";

vi.mock("konva", () => ({ default: {} }));

vi.mock("react-konva", () => ({
  Rect: (props: any) => (
    <div data-testid={`rect-${props.id}`} data-stroke={props.stroke}>
      <button onClick={props.onClick}>select rect</button>
      <button
        onClick={() =>
          props.onDragEnd?.({
            target: {
              x: () => 66,
              y: () => 77,
            },
          })
        }
      >
        drag rect
      </button>
    </div>
  ),
}));

vi.mock(
  "../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/experimentalScene/sceneModel",
  () => ({
    isHtmlSceneComponent: (type: string) => type === "HtmlComponent",
  }),
);

vi.mock(
  "../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/experimentalScene/EditorHitBox",
  () => ({
    default: ({
      shapeProps,
      onSelect,
      onChange,
      onActivateDom,
      onEditText,
    }: any) => (
      <button
        data-testid={`hitbox-${shapeProps.id}`}
        onClick={() => {
          onSelect();
          onActivateDom();
          onEditText();
          onChange({ x: 40, y: 50, __transient: true });
        }}
      >
        hitbox
      </button>
    ),
  }),
);

vi.mock(
  "../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/VisualComponents",
  () => {
    const visual =
      (name: string) =>
      ({ shapeProps, onSelect, onChange, onEditStart }: any) => (
        <button
          data-testid={`visual-${name}-${shapeProps.id}`}
          onClick={() => {
            onSelect();
            onEditStart?.();
            if (shapeProps.id.includes("only-x")) {
              onChange({ x: 310 });
              return;
            }
            if (shapeProps.id.includes("only-y")) {
              onChange({ y: 410 });
              return;
            }
            if (shapeProps.id.includes("size-only")) {
              onChange({ width: 260 });
              return;
            }
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
      ImageComponent: visual("ImageComponent"),
      VideoComponent: visual("VideoComponent"),
      AudioComponent: visual("AudioComponent"),
      TextComponent: visual("TextComponent"),
      ButtonResponseComponent: visual("ButtonResponseComponent"),
      KeyboardResponseComponent: visual("KeyboardResponseComponent"),
      SliderResponseComponent: visual("SliderResponseComponent"),
      InputResponseComponent: visual("InputResponseComponent"),
      SketchpadComponent: visual("SketchpadComponent"),
      AudioResponseComponent: visual("AudioResponseComponent"),
      FileUploadResponseComponent: visual("FileUploadResponseComponent"),
      ClickResponseComponent: visual("ClickResponseComponent"),
    };
  },
);

import renderComponent from "../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/renderComponent";

export function component(
  type: TrialComponent["type"] | "HtmlComponent" | "UnknownComponent",
  overrides: Partial<TrialComponent> = {},
) {
  return buildComponent(type, overrides);
}

export function Harness(props: RenderComponentHarnessProps) {
  return (
    <RenderComponentHarness {...props} renderComponentFn={renderComponent} />
  );
}
