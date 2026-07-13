import "./reactKonvaMock";
import "./componentMocks";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import KonvaCanvas from "../../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/KonvaCanvas";
import renderComponent from "../../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/renderComponent";
import EditorHitBox from "../../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/experimentalScene/EditorHitBox";
import { TrialComponent } from "../../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/types";

function component(
  type: TrialComponent["type"],
  overrides: Partial<TrialComponent> = {},
): TrialComponent {
  return {
    id: `${type}-a`,
    type,
    x: 100,
    y: 100,
    width: 100,
    height: 50,
    rotation: 0,
    zIndex: 1,
    config: {},
    ...overrides,
  };
}

function RenderComponentHarness({
  initial,
  selectedId = initial.id,
}: {
  initial: TrialComponent;
  selectedId?: string | null;
}) {
  const [components, setComponents] = useState([initial]);
  const [selected, setSelected] = useState<string | null>(selectedId);
  const onAutoSave = vi.fn();
  const node = renderComponent({
    comp: components[0],
    components,
    setComponents,
    selectedId: selected,
    selectedIds: selected ? [selected] : [],
    setSelectedId: setSelected,
    toJsPsychCoords: (x, y) => ({ x: x - 50, y: 50 - y }),
    onAutoSave,
    generateConfigFromComponents: (next) => ({ components: next }),
    canvasStyles: {
      width: 500,
      height: 400,
      fullScreen: false,
      progressBar: false,
      backgroundColor: "#fff",
    },
    htmlSceneMetrics: {
      [initial.id]: { width: initial.width, height: initial.height },
    },
    onRecordHistory: vi.fn(),
    setActiveDomId: vi.fn(),
    onEditTextStart: vi.fn(),
  });

  return (
    <div>
      {node}
      <output data-testid="render-state">
        {JSON.stringify(components[0])}
      </output>
      <output data-testid="render-selected">{selected ?? "none"}</output>
    </div>
  );
}

export {
  EditorHitBox,
  KonvaCanvas,
  RenderComponentHarness,
  afterEach,
  beforeEach,
  component,
  describe,
  expect,
  fireEvent,
  it,
  render,
  renderComponent,
  screen,
  vi,
  waitFor,
};
