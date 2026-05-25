import { act, fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import KonvaParameterMapper from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/KonvaParameterMapper";
import type { TrialComponent } from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/types";

const mapperMock = vi.hoisted(() => ({
  props: undefined as any,
}));

vi.mock(
  "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/ParameterMapper",
  () => ({
    default: (props: any) => {
      mapperMock.props = props;
      return (
        <div data-testid="parameter-mapper">
          <button
            type="button"
            onClick={() =>
              props.setColumnMapping((prev: Record<string, any>) => ({
                ...prev,
                coordinates: { source: "typed", value: { x: 10, y: 20 } },
                width: { source: "typed", value: 25 },
                zIndex: { source: "typed", value: 7 },
                button_color: { source: "typed", value: "#ff0000" },
              }))
            }
          >
            Change mapping
          </button>
          <button
            type="button"
            onClick={() =>
              props.onComponentConfigChange("button-1", {
                name: { source: "typed", value: "ButtonRenamed" },
              })
            }
          >
            Direct config change
          </button>
        </div>
      );
    },
  }),
);

function createSetComponents(initial: TrialComponent[]) {
  let current = initial;
  const setComponents = vi.fn((update: React.SetStateAction<TrialComponent[]>) => {
    current = typeof update === "function" ? update(current) : update;
  });

  return {
    setComponents,
    getComponents: () => current,
  };
}

const selectedComponent: TrialComponent = {
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

function createMapperProps(
  overrides: Partial<React.ComponentProps<typeof KonvaParameterMapper>> = {},
) {
  const state = createSetComponents([selectedComponent]);
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
    isResizingRight: { current: false },
    setShowRightPanel: vi.fn(),
    setRightPanelWidth: vi.fn(),
    csvColumns: ["stimulus"],
    uploadedFiles: [{ name: "img.png", url: "uploads/img/img.png", type: "img" }],
    ...overrides,
  };

  return { props, state, onAutoSave, generateConfigFromComponents };
}

function renderMapper(overrides: Partial<React.ComponentProps<typeof KonvaParameterMapper>> = {}) {
  const setup = createMapperProps(overrides);

  return {
    ...render(<KonvaParameterMapper {...setup.props} />),
    ...setup,
  };
}

describe("KonvaParameterMapper", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mapperMock.props = undefined;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("shows empty, loading and metadata-error states", () => {
    const { rerender } = renderMapper({
      selectedId: null,
      selectedComponent: undefined,
      componentMetadata: null,
    });

    expect(
      screen.getByText("Select a component from the canvas to edit its parameters"),
    ).toBeInTheDocument();

    const loadingSetup = createMapperProps({
      metadataLoading: true,
      componentMetadata: null,
    });
    rerender(
      <KonvaParameterMapper
        {...loadingSetup.props}
      />,
    );
    expect(screen.getByText("Loading component parameters...")).toBeInTheDocument();

    const errorSetup = createMapperProps({
      metadataLoading: false,
      componentMetadata: null,
    });
    rerender(
      <KonvaParameterMapper
        {...errorSetup.props}
      />,
    );
    expect(screen.getByText("Error loading component metadata")).toBeInTheDocument();
  });

  it("passes component metadata into ParameterMapper and syncs mapping changes to the visual component", () => {
    const { state, onAutoSave, generateConfigFromComponents } = renderMapper();

    expect(screen.getByText("ButtonResponse")).toBeInTheDocument();
    expect(mapperMock.props.parameters).toEqual([
      { key: "choices", label: "Choice Labels", type: "string_array" },
      { key: "button_color", label: "Button Color", type: "string" },
    ]);
    expect(mapperMock.props.columnMapping).toEqual(selectedComponent.config);
    expect(mapperMock.props.componentMode).toBe(true);
    expect(mapperMock.props.selectedComponentId).toBe("button-1");
    expect(mapperMock.props.csvColumns).toEqual(["stimulus"]);
    expect(mapperMock.props.uploadedFiles).toEqual([
      { name: "img.png", url: "uploads/img/img.png", type: "img" },
    ]);

    fireEvent.click(screen.getByText("Change mapping"));

    expect(state.getComponents()[0]).toEqual(
      expect.objectContaining({
        x: 321,
        y: 123,
        width: 250,
        zIndex: 7,
        buttonColor: "#ff0000",
        config: expect.objectContaining({
          coordinates: { source: "typed", value: { x: 10, y: 20 } },
          width: { source: "typed", value: 25 },
          zIndex: { source: "typed", value: 7 },
          button_color: { source: "typed", value: "#ff0000" },
        }),
      }),
    );
    expect(generateConfigFromComponents).toHaveBeenCalledWith(state.getComponents());

    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(onAutoSave).toHaveBeenCalledWith({ components: "config" });
  });

  it("supports direct component config replacement from ParameterMapper", () => {
    const { state } = renderMapper();

    fireEvent.click(screen.getByText("Direct config change"));

    expect(state.getComponents()[0].config).toEqual({
      name: { source: "typed", value: "ButtonRenamed" },
    });
  });
});
