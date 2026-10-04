import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TrialDesigner from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner";
import ExperimentAppearanceContext from "../../pages/ExperimentBuilder/contexts/ExperimentAppearanceContext";
import { DEFAULT_EXPERIMENT_APPEARANCE } from "../../pages/ExperimentBuilder/appearance";
import { DEVICE_PRESETS } from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/previewViewport/devicePresets";

import { trialMapping } from "./trialDesignerViewport/fixtures";

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
    const { default: PreviewViewportBar } = await import(
      "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/PreviewViewportBar"
    );
    return {
      default: ({ modalProps, toolbarProps, canvasProps, actionProps }: any) =>
        modalProps.isOpen ? (
          <div>
            <PreviewViewportBar {...toolbarProps} />
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
    <ExperimentAppearanceContext.Provider
      value={{
        appearance: DEFAULT_EXPERIMENT_APPEARANCE,
        setAppearance,
      }}
    >
      {children}
    </ExperimentAppearanceContext.Provider>
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
  const canvas = screen.getByTestId("canvas");
  expect(Number(canvas.dataset.scale)).toBeCloseTo(fit);
  expect(Number(canvas.dataset.viewportWidth)).toBeCloseTo(width * fit);
  expect(Number(canvas.dataset.viewportHeight)).toBeCloseTo(height * fit);
}

describe("TrialDesigner screen preview", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("screen", { width: 1440, height: 900 });
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

  it("projects relative geometry for every preset without changing the export or autosaving", () => {
    const mapping = trialMapping();
    const originalMapping = structuredClone(mapping);
    const { onSave, onAutoSave, setAppearance } = renderDesigner(mapping);
    const originalComponents = screen.getByTestId("canvas").textContent;
    const baseline = save(onSave);
    expect(baseline.__canvasStyles.value).toEqual(DEFAULT_EXPERIMENT_APPEARANCE);
    expect(JSON.parse(originalComponents!)[0]).toMatchObject({
      x: expect.closeTo(792),
      y: 360,
      width: 360,
      height: 144,
      textFontSize: 36,
    });
    expect(screen.getByTestId("canvas")).toHaveAttribute(
      "data-design-width",
      "1440",
    );
    const toggle = screen.getByRole("button", { name: "Grid" });
    expect(toggle).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByTestId("canvas").textContent).toBe(originalComponents);
    expect(save(onSave)).toEqual(baseline);
    fireEvent.click(toggle);

    for (const preset of DEVICE_PRESETS) {
      fireEvent.click(
        screen.getByTitle(`${preset.label} — ${preset.description}`),
      );
      act(() => vi.advanceTimersByTime(200));
      expectViewport(preset.width, preset.height);
      const projected = JSON.parse(
        screen.getByTestId("canvas").textContent!,
      )[0];
      expect(projected.x).toBeCloseTo(preset.width * 0.55);
      expect(projected.y).toBeCloseTo(preset.height * 0.4);
      expect(projected.width).toBeCloseTo(preset.width * 0.25);
      expect(projected.height).toBeCloseTo(preset.width * 0.1);
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
    rerender(<TrialDesigner {...props} columnMapping={baseline} />);
    expect(screen.getByText("900×600px")).toBeInTheDocument();
    expectViewport(900, 600);
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

  it("keeps screen choices local for new trials", () => {
    vi.stubGlobal("screen", { width: 1440, height: 900 });
    const { onSave, onAutoSave } = renderDesigner({});
    const baseline = save(onSave);
    expect(baseline.__canvasStyles).toEqual({
      source: "typed",
      value: DEFAULT_EXPERIMENT_APPEARANCE,
    });
    for (const preset of DEVICE_PRESETS) {
      fireEvent.click(
        screen.getByTitle(`${preset.label} — ${preset.description}`),
      );
      expect(save(onSave)).toEqual(baseline);
    }
    vi.stubGlobal("screen", { width: 1063, height: 696 });
    fireEvent.click(screen.getByTitle("Mobile — 375 × 725"));
    expect(save(onSave)).toEqual(baseline);
    act(() => vi.advanceTimersByTime(200));
    expect(onAutoSave).not.toHaveBeenCalled();
  });

  it("reinitializes the viewport on a new mount without writing to storage", () => {
    const writeStorage = vi.spyOn(Storage.prototype, "setItem");
    const first = renderDesigner();
    fireEvent.click(screen.getByTitle("Mobile — 375 × 725"));
    expectViewport(375, 725);
    first.unmount();

    vi.stubGlobal("screen", { width: 1063, height: 696 });
    const second = renderDesigner();
    expect(screen.getByText("1063×696px")).toBeInTheDocument();
    expectViewport(1063, 696);
    expect(writeStorage).not.toHaveBeenCalled();
    expect(second.onAutoSave).not.toHaveBeenCalled();
    writeStorage.mockRestore();
  });
});
