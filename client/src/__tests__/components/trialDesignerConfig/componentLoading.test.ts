import {
  DEFAULT_CANVAS_STYLES,
  describe,
  expect,
  fromJsPsychCoords,
  it,
  renderHook,
  useLoadComponents,
  vi,
  waitFor,
} from "./testHarness";
import type { CanvasStyles, TrialComponent } from "./testHarness";

describe("useLoadComponents", () => {
  it("loads saved stimulus and response components back into Konva component state", async () => {
    const setComponents = vi.fn();
    const setSelectedId = vi.fn();
    let currentCanvasStyles: CanvasStyles = {
      ...DEFAULT_CANVAS_STYLES,
      backgroundColor: "#202020",
      fullScreen: false,
    };
    const setCanvasStyles = vi.fn((updater) => {
      currentCanvasStyles =
        typeof updater === "function" ? updater(currentCanvasStyles) : updater;
    });

    renderHook(() =>
      useLoadComponents({
        isOpen: true,
        columnMapping: {
          components: {
            source: "typed",
            value: [
              {
                type: "TextComponent",
                coordinates: { x: 12, y: 8 },
                width: 30,
                height: 9,
                rotation: 15,
                zIndex: 2,
                text: { source: "typed", value: "Hello" },
                font_color: { source: "typed", value: "#ff0000" },
                font_size: { source: "typed", value: 20 },
              },
            ],
          },
          response_components: {
            source: "typed",
            value: [
              {
                type: "ButtonResponseComponent",
                coordinates: { x: 50, y: 40 },
                width: 20,
                height: 6,
                zIndex: 3,
                button_text: { source: "typed", value: "Continue" },
                button_color: { source: "typed", value: "#0088ff" },
              },
            ],
          },
          __canvasStyles: {
            source: "typed",
            value: {
              width: 1000,
              height: 700,
              progressBar: true,
            },
          },
        },
        fromJsPsychCoords,
        CANVAS_WIDTH: 1000,
        CANVAS_HEIGHT: 700,
        setComponents,
        setSelectedId,
        setCanvasStyles,
      }),
    );

    await waitFor(() => {
      expect(setComponents).toHaveBeenCalled();
      expect(setCanvasStyles).toHaveBeenCalled();
    });

    const loadedComponents = setComponents.mock.calls[0][0] as TrialComponent[];

    expect(setSelectedId).not.toHaveBeenCalled();
    expect(loadedComponents).toHaveLength(2);
    expect(loadedComponents[0]).toEqual(
      expect.objectContaining({
        type: "TextComponent",
        x: 120,
        y: 80,
        width: 300,
        height: 90,
        rotation: 15,
        zIndex: 2,
        textFontColor: "#ff0000",
        textFontSize: 20,
      }),
    );
    expect(loadedComponents[1]).toEqual(
      expect.objectContaining({
        type: "ButtonResponseComponent",
        x: 500,
        y: 400,
        width: 200,
        height: 60,
        zIndex: 3,
        buttonColor: "#0088ff",
      }),
    );
    expect(currentCanvasStyles).toEqual(
      expect.objectContaining({
        width: 1000,
        height: 700,
        progressBar: true,
        backgroundColor: "#202020",
        fullScreen: false,
      }),
    );
  });

  it("resets loaded state when closed and auto-sizes an empty trial on reopen", async () => {
    const setComponents = vi.fn();
    const setSelectedId = vi.fn();
    let currentCanvasStyles: CanvasStyles = {
      ...DEFAULT_CANVAS_STYLES,
      backgroundColor: "#303030",
      fullScreen: true,
    };
    const setCanvasStyles = vi.fn((updater) => {
      currentCanvasStyles =
        typeof updater === "function" ? updater(currentCanvasStyles) : updater;
    });
    Object.defineProperty(window, "screen", {
      configurable: true,
      value: { width: 1366, height: 768 },
    });

    const props = {
      isOpen: true,
      columnMapping: {},
      fromJsPsychCoords,
      CANVAS_WIDTH: 1000,
      CANVAS_HEIGHT: 700,
      setComponents,
      setSelectedId,
      setCanvasStyles,
    };
    const { rerender } = renderHook(
      ({ isOpen }) => useLoadComponents({ ...props, isOpen }),
      { initialProps: { isOpen: true } },
    );

    await waitFor(() => {
      expect(setComponents).toHaveBeenCalledWith([]);
      expect(setSelectedId).toHaveBeenCalledWith(null);
    });
    expect(currentCanvasStyles).toEqual(
      expect.objectContaining({
        width: 1366,
        height: 768,
        backgroundColor: "#303030",
        fullScreen: true,
      }),
    );

    rerender({ isOpen: true });
    expect(setComponents).toHaveBeenCalledTimes(1);

    rerender({ isOpen: false });
    rerender({ isOpen: true });

    await waitFor(() => {
      expect(setComponents).toHaveBeenCalledTimes(2);
    });
  });
});
