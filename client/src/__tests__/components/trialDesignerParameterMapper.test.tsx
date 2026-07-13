import { act, fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import KonvaParameterMapper from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/KonvaParameterMapper";
import {
  createMapperProps,
  otherComponent,
  renderMapper,
  selectedComponent,
} from "./trialDesignerParameterMapper/testHarness";

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
              props.setColumnMapping({
                height: { source: "typed", value: 12 },
                rotation: { source: "typed", value: 45 },
              })
            }
          >
            Replace mapping
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
      screen.getByText(
        "Select a component from the canvas to edit its parameters",
      ),
    ).toBeInTheDocument();

    const loadingSetup = createMapperProps({
      metadataLoading: true,
      componentMetadata: null,
    });
    rerender(<KonvaParameterMapper {...loadingSetup.props} />);
    expect(
      screen.getByText("Loading component parameters..."),
    ).toBeInTheDocument();

    const errorSetup = createMapperProps({
      metadataLoading: false,
      componentMetadata: null,
    });
    rerender(<KonvaParameterMapper {...errorSetup.props} />);
    expect(
      screen.getByText("Error loading component metadata"),
    ).toBeInTheDocument();
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
    expect(generateConfigFromComponents).toHaveBeenCalledWith(
      state.getComponents(),
    );

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

  it("supports direct object mapping updates without autosave", () => {
    const { state, generateConfigFromComponents } = renderMapper({
      onAutoSave: undefined,
    });

    fireEvent.click(screen.getByText("Replace mapping"));

    expect(state.getComponents()[0]).toEqual(
      expect.objectContaining({
        height: 120,
        rotation: 45,
        config: {
          height: { source: "typed", value: 12 },
          rotation: { source: "typed", value: 45 },
        },
      }),
    );
    expect(generateConfigFromComponents).not.toHaveBeenCalled();
  });

  it("passes an empty mapping when selectedId does not exist in components", () => {
    renderMapper({ selectedId: "missing-component", components: [] });

    expect(mapperMock.props.columnMapping).toEqual({});
  });

  it("starts and updates a selected component whose config is absent", () => {
    const configlessComponent = {
      ...selectedComponent,
      config: undefined as any,
    };
    const { state } = renderMapper({
      selectedComponent: configlessComponent,
      components: [configlessComponent, otherComponent],
    });

    expect(mapperMock.props.columnMapping).toEqual({});
    fireEvent.click(screen.getByText("Change mapping"));
    expect(state.getComponents()[0].config).toEqual(
      expect.objectContaining({
        coordinates: { source: "typed", value: { x: 10, y: 20 } },
      }),
    );
  });

  it("resizes and hides the right parameter panel from the resize handle", () => {
    const setup = createMapperProps();
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 1000,
    });
    const { container } = render(<KonvaParameterMapper {...setup.props} />);
    const resizeHandle = container.querySelector(
      '[style*="col-resize"]',
    ) as HTMLElement;

    fireEvent.mouseOver(resizeHandle);
    expect(resizeHandle.style.background).toBe("rgb(0, 0, 0)");
    fireEvent.mouseOut(resizeHandle);
    expect(resizeHandle.style.background).toBe("transparent");

    fireEvent.mouseDown(resizeHandle);
    fireEvent.mouseMove(document, { clientX: 500 });

    expect(setup.props.isResizingRight.current).toBe(true);
    expect(setup.props.setRightPanelWidth).toHaveBeenCalledWith(450);
    expect(setup.props.setShowRightPanel).toHaveBeenCalledWith(true);

    fireEvent.mouseMove(document, { clientX: 800 });
    expect(setup.props.setShowRightPanel).toHaveBeenCalledWith(false);

    fireEvent.mouseUp(document);
    expect(setup.props.isResizingRight.current).toBe(false);

    fireEvent.mouseMove(document, { clientX: 400 });
    expect(setup.props.setRightPanelWidth).toHaveBeenCalledTimes(1);
  });
});
