import { render } from "@testing-library/react";
import React from "react";
import { vi } from "vitest";
import KonvaParameterMapper from "../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/KonvaParameterMapper";
import type { TrialComponent } from "../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/types";

function createSetComponents(initial: TrialComponent[]) {
  let current = initial;
  const setComponents = vi.fn(
    (update: React.SetStateAction<TrialComponent[]>) => {
      current = typeof update === "function" ? update(current) : update;
    },
  );
  return { setComponents, getComponents: () => current };
}

export const selectedComponent: TrialComponent = {
  id: "button-1",
  type: "ButtonResponseComponent",
  x: 100,
  y: 100,
  width: 0,
  height: 0,
  zIndex: 2,
  config: {
    name: { source: "typed", value: "Button_1" },
    choices: { source: "typed", value: ["Continue"] },
  },
};

export const otherComponent: TrialComponent = {
  id: "text-1",
  type: "TextComponent",
  x: 20,
  y: 30,
  width: 100,
  height: 40,
  zIndex: 1,
  config: { text: { source: "typed", value: "Other" } },
};

export function createMapperProps(
  overrides: Partial<React.ComponentProps<typeof KonvaParameterMapper>> = {},
) {
  const state = createSetComponents(
    overrides.components ?? [selectedComponent, otherComponent],
  );
  const onAutoSave = vi.fn();
  const generateConfigFromComponents = vi.fn(() => ({ components: "config" }));
  const props: React.ComponentProps<typeof KonvaParameterMapper> = {
    rightPanelWidth: 320,
    selectedId: "button-1",
    selectedComponent,
    metadataLoading: false,
    componentMetadata: {
      name: "button-response-component",
      version: "1.0.0",
      parameters: {
        choices: { type: "string_array", pretty_name: "Choice Labels" },
        button_color: { type: "string" },
      },
    },
    components: state.getComponents(),
    setComponents: state.setComponents,
    fromJsPsychCoords: vi.fn(() => ({ x: 321, y: 123 })),
    canvasWidth: 1000,
    onAutoSave,
    generateConfigFromComponents,
    onRecordHistory: vi.fn(),
    isResizingRight: { current: false },
    setShowRightPanel: vi.fn(),
    setRightPanelWidth: vi.fn(),
    csvColumns: ["stimulus"],
    uploadedFiles: [
      { name: "img.png", url: "uploads/img/img.png", type: "img" },
    ],
    ...overrides,
  };
  return { props, state, onAutoSave, generateConfigFromComponents };
}

export function renderMapper(
  overrides: Partial<React.ComponentProps<typeof KonvaParameterMapper>> = {},
) {
  const setup = createMapperProps(overrides);
  return {
    ...render(<KonvaParameterMapper {...setup.props} />),
    ...setup,
  };
}
