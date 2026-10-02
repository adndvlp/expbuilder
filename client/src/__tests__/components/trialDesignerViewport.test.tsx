import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TrialDesigner from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner";
import CanvasStylesContext from "../../pages/ExperimentBuilder/contexts/CanvasStylesContext";
import { DEFAULT_CANVAS_STYLES } from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/types";
import { DEVICE_PRESETS } from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/canvasStyles/devicePresets";

const viewport = vi.hoisted(() => ({
  width: 800,
  height: 600,
  resize: () => {},
}));

vi.mock(
  "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/hooks/useComponentMetadata",
  () => ({ useComponentMetadata: () => ({ metadata: null, loading: false }) }),
);

// Keep component loading, serialization, editing, and viewport calculations real.
// Replace only the layout to inspect the values sent to both rendering layers.
vi.mock(
  "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/components/TrialDesignerLayout",
  async () => {
    const { default: CanvasStylesBar } = await import(
      "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/CanvasStylesBar"
    );
    return {
      default: ({ modalProps, toolbarProps, canvasProps, actionProps }: any) =>
        modalProps.isOpen ? (
          <div>
            <CanvasStylesBar {...toolbarProps} />
            <div
              data-testid="canvas"
              data-scale={canvasProps.stageScale}
              data-viewport-width={canvasProps.viewportWidth}
              data-viewport-height={canvasProps.viewportHeight}
              data-design-width={canvasProps.CANVAS_WIDTH}
              data-design-height={canvasProps.CANVAS_HEIGHT}
              ref={(node) => {
                if (!node) return;
                Object.defineProperties(node, {
                  clientWidth: {
                    configurable: true,
                    get: () => viewport.width,
                  },
                  clientHeight: {
                    configurable: true,
                    get: () => viewport.height,
                  },
                });
                canvasProps.canvasContainerRef.current = node;
              }}
            >
              {JSON.stringify(canvasProps.components)}
            </div>
            <button
              onClick={() =>
                actionProps.onSave(
                  actionProps.generateConfigFromComponents(
                    canvasProps.components,
                  ),
                )
              }
            >
              Save
            </button>
            <button
              onClick={() =>
                canvasProps.onCommitTextEdit(
                  canvasProps.components[0].id,
                  "Edited on mobile",
                )
              }
            >
              Edit text
            </button>
          </div>
        ) : null,
    };
  },
);

function trialMapping() {
  return {
    __canvasStyles: { source: "typed", value: { width: 1000, height: 700 } },
    components: {
      source: "typed",
      value: [
        {
          type: "TextComponent",
          coordinates: { x: 10, y: 20 },
          width: 25,
          height: 10,
          text: { source: "typed", value: "Hello" },
          font_size: { source: "typed", value: 36 },
          border_radius: { source: "typed", value: 8 },
        },
        {
          type: "ImageComponent",
          coordinates: { x: -40, y: -30 },
          width: 30,
          height: 20,
          stimulus: { source: "typed", value: "image.png" },
        },
      ],
    },
    response_components: {
      source: "typed",
      value: [
        {
          type: "InputResponseComponent",
          component_id: "input",
          coordinates: { x: 20, y: -50 },
          width: 20,
          height: 5,
          input_font_size: { source: "typed", value: 24 },
        },
        {
          type: "ButtonResponseComponent",
          component_id: "button",
          coordinates: { x: 50, y: -50 },
          width: 18,
          height: 8,
          button_font_size: { source: "typed", value: 20 },
          button_border_radius: { source: "typed", value: 12 },
        },
      ],
    },
  };
}

function renderDesigner(columnMapping: Record<string, any> = trialMapping()) {
  const onSave = vi.fn();
  const onAutoSave = vi.fn();
  const setAppearance = vi.fn();
  const props = {
    isOpen: true,
    onClose: vi.fn(),
    onSave,
    onAutoSave,
    columnMapping,
    parameters: [],
    csvColumns: [],
    pluginName: "plugin-dynamic",
  };
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <CanvasStylesContext.Provider
      value={{
        canvasStyles: DEFAULT_CANVAS_STYLES,
        setCanvasStyles: setAppearance,
      }}
    >
      {children}
    </CanvasStylesContext.Provider>
  );
  const result = render(<TrialDesigner {...props} />, { wrapper });
  return { ...result, props, onSave, onAutoSave, setAppearance };
}

function save(onSave: ReturnType<typeof vi.fn>) {
  fireEvent.click(screen.getByText("Save"));
  return onSave.mock.calls.at(-1)![0];
}

function expectViewport(width: number, height: number) {
  const fit = Math.min(viewport.width / width, viewport.height / height, 1);
  const runtimeScale = Math.min(width / 1000, height / 700);
  const canvas = screen.getByTestId("canvas");
  expect(Number(canvas.dataset.scale)).toBeCloseTo(runtimeScale * fit);
  expect(Number(canvas.dataset.viewportWidth)).toBeCloseTo(width * fit);
  expect(Number(canvas.dataset.viewportHeight)).toBeCloseTo(height * fit);
}

describe("TrialDesigner screen preview", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    viewport.width = 800;
    viewport.height = 600;
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(callback: () => void) {
          viewport.resize = callback;
        }
        observe() {}
        disconnect() {}
      },
    );
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("matches runtime scaling for every preset without changing or saving the design", () => {
    const mapping = trialMapping();
    const originalMapping = structuredClone(mapping);
    const { onSave, onAutoSave, setAppearance } = renderDesigner(mapping);
    const originalComponents = screen.getByTestId("canvas").textContent;
    const baseline = save(onSave);
    expect(JSON.parse(originalComponents!)[0]).toMatchObject({
      x: 550,
      y: 280,
      width: 250,
      height: 100,
      textFontSize: 36,
    });
    expect(screen.getByTestId("canvas")).toHaveAttribute(
      "data-design-width",
      "1000",
    );

    for (const preset of DEVICE_PRESETS) {
      fireEvent.click(
        screen.getByTitle(`${preset.label} — ${preset.description}`),
      );
      act(() => vi.advanceTimersByTime(200));
      expectViewport(preset.width, preset.height);
      expect(screen.getByTestId("canvas").textContent).toBe(originalComponents);
      expect(save(onSave)).toEqual(baseline);
    }

    expect(onAutoSave).not.toHaveBeenCalled();
    expect(setAppearance).not.toHaveBeenCalled();
    expect(mapping).toEqual(originalMapping);
  });

  it("keeps custom sizes and panel resizes transient, and restores the preview on reopen", () => {
    const { onSave, onAutoSave, props, rerender } = renderDesigner();
    const baseline = save(onSave);
    fireEvent.click(screen.getByTitle("Custom size"));
    fireEvent.change(screen.getByPlaceholderText("W"), {
      target: { value: "900" },
    });
    fireEvent.change(screen.getByPlaceholderText("H"), {
      target: { value: "600" },
    });
    fireEvent.click(screen.getByText("Apply"));
    expectViewport(900, 600);

    act(() => {
      viewport.width = 400;
      viewport.resize();
    });
    expectViewport(900, 600);
    expect(save(onSave)).toEqual(baseline);
    rerender(<TrialDesigner {...props} isOpen={false} />);
    rerender(<TrialDesigner {...props} />);
    expect(screen.getByText("1000×700px")).toBeInTheDocument();
    expectViewport(1000, 700);
    expect(save(onSave)).toEqual(baseline);
    act(() => vi.advanceTimersByTime(200));
    expect(onAutoSave).not.toHaveBeenCalled();
  });

  it("autosaves actual edits on a mobile preview in the original coordinate system", () => {
    const { onSave, onAutoSave } = renderDesigner();
    const baseline = save(onSave);
    fireEvent.click(screen.getByTitle("Mobile — 375 × 725"));
    fireEvent.click(screen.getByText("Edit text"));
    act(() => vi.advanceTimersByTime(200));
    const edited = onAutoSave.mock.calls.at(-1)![0];
    expect(edited.__canvasStyles).toEqual(baseline.__canvasStyles);
    expect(edited.response_components).toEqual(baseline.response_components);
    expect(edited.components.value[0]).toEqual({
      ...baseline.components.value[0],
      text: { source: "typed", value: "Edited on mobile" },
    });
  });

  it("preserves the original screen size for new trials without exporting preview sizes", () => {
    vi.stubGlobal("screen", { width: 1440, height: 900 });
    const { onSave, onAutoSave } = renderDesigner({});
    const baseline = save(onSave);
    expect(baseline.__canvasStyles.value).toEqual({ width: 1440, height: 900 });
    for (const preset of DEVICE_PRESETS) {
      fireEvent.click(screen.getByTitle(`${preset.label} — ${preset.description}`));
      expect(save(onSave)).toEqual(baseline);
    }
    vi.stubGlobal("screen", { width: 1063, height: 696 });
    fireEvent.click(screen.getByTitle("Mobile — 375 × 725"));
    expect(save(onSave)).toEqual(baseline);
    act(() => vi.advanceTimersByTime(200));
    expect(onAutoSave).not.toHaveBeenCalled();
  });
});
