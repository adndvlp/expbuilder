import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import EditorHitBox from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/experimentalScene/EditorHitBox";
import type { TrialComponent } from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/types";

vi.mock("konva", () => ({ default: {} }));

vi.mock("react-konva", () => ({
  Group: (props: any) => (
    <div>
      <button onClick={() => props.onTransformEnd?.()}>transform no ref</button>
      {props.children}
    </div>
  ),
  Rect: () => <div data-testid="rect" />,
  Transformer: () => <div data-testid="transformer" />,
}));

function component(type: TrialComponent["type"]): TrialComponent {
  return {
    id: `${type}-no-ref`,
    type,
    x: 100,
    y: 100,
    width: 100,
    height: 50,
    rotation: 0,
    zIndex: 1,
    config: {},
  };
}

describe("EditorHitBox null group ref", () => {
  it("ignores transform end when the Konva group ref is unavailable", () => {
    const onChange = vi.fn();

    render(
      <EditorHitBox
        shapeProps={component("SurveyComponent")}
        isSelected
        onSelect={vi.fn()}
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByText("transform no ref"));

    expect(onChange).not.toHaveBeenCalled();
  });
});
