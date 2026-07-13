import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_CANVAS_STYLES } from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/types";
import type {
  CanvasStyles,
  TrialComponent,
} from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/types";

type EffectCallback = () => void | (() => void);

describe("useLoadComponents idempotency guard", () => {
  afterEach(() => {
    vi.doUnmock("react");
    vi.resetModules();
  });

  it("skips the second effect execution when a mount is replayed", async () => {
    vi.resetModules();
    const actualReact = await vi.importActual<typeof import("react")>("react");
    const effectSpy = vi.fn((callback: EffectCallback) => {
      callback();
      callback();
    });
    vi.doMock("react", () => ({
      ...actualReact,
      useEffect: effectSpy,
    }));

    const { default: useLoadComponents } = await import(
      "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/useLoadComponents"
    );
    const setComponents = vi.fn();
    const setSelectedId = vi.fn();
    const setCanvasStyles = vi.fn((updater) => {
      const previous: CanvasStyles = {
        ...DEFAULT_CANVAS_STYLES,
        backgroundColor: "#606060",
        fullScreen: false,
      };
      return typeof updater === "function" ? updater(previous) : updater;
    });

    renderHook(() =>
      useLoadComponents({
        isOpen: true,
        columnMapping: {
          components: {
            source: "typed",
            value: {
              type: "TextComponent",
              text: { source: "typed", value: "Replay once" },
            },
          },
        },
        fromJsPsychCoords: ({ x, y }) => ({ x, y }),
        CANVAS_WIDTH: 1000,
        CANVAS_HEIGHT: 700,
        setComponents,
        setSelectedId,
        setCanvasStyles,
      }),
    );

    expect(effectSpy).toHaveBeenCalledTimes(1);
    expect(setComponents).toHaveBeenCalledTimes(1);
    expect(setComponents.mock.calls[0][0]).toEqual([
      expect.objectContaining<Partial<TrialComponent>>({
        type: "TextComponent",
        x: 500,
        y: 350,
      }),
    ]);
    expect(setSelectedId).not.toHaveBeenCalled();
    expect(setCanvasStyles).toHaveBeenCalledTimes(1);
  });
});
