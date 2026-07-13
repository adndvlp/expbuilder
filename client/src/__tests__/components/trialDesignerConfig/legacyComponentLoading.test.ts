import {
  DEFAULT_CANVAS_STYLES,
  React,
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
  it("loads single legacy component entries and non-editor-sized components", async () => {
    const setComponents = vi.fn();
    const setSelectedId = vi.fn();
    let currentCanvasStyles: CanvasStyles = {
      ...DEFAULT_CANVAS_STYLES,
      backgroundColor: "#404040",
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
            value: {
              type: "HtmlComponent",
              stimulus: { source: "typed", value: "<p>Hello</p>" },
              width: 50,
              height: 10,
              rotation: 0,
            },
          },
          response_components: {
            source: "typed",
            value: {
              type: "FileUploadResponseComponent",
              button_label: "Upload legacy",
              coordinates: { x: 20, y: 30 },
              width: 40,
              height: 12,
            },
          },
          __canvasStyles: { source: "typed", value: {} },
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
    });
    const loadedComponents = setComponents.mock.calls[0][0] as TrialComponent[];

    expect(loadedComponents).toHaveLength(2);
    expect(loadedComponents[0]).toEqual(
      expect.objectContaining({
        type: "HtmlComponent",
        x: 500,
        y: 350,
        width: 0,
        height: 0,
        rotation: 0,
        zIndex: 0,
        config: {
          stimulus: { source: "typed", value: "<p>Hello</p>" },
        },
      }),
    );
    expect(loadedComponents[1]).toEqual(
      expect.objectContaining({
        type: "FileUploadResponseComponent",
        x: 200,
        y: 300,
        width: 0,
        height: 0,
        config: {
          button_label: { source: "typed", value: "Upload legacy" },
          coordinates: { source: "typed", value: { x: 20, y: 30 } },
        },
      }),
    );
    expect(setSelectedId).not.toHaveBeenCalled();
    expect(currentCanvasStyles).toEqual(
      expect.objectContaining({
        backgroundColor: "#404040",
        fullScreen: false,
      }),
    );
  });

  it("keeps loading idempotent in StrictMode and restores response rotation", async () => {
    const setComponents = vi.fn();
    const setSelectedId = vi.fn();
    const setCanvasStyles = vi.fn((updater) => {
      const previous: CanvasStyles = {
        ...DEFAULT_CANVAS_STYLES,
        backgroundColor: "#505050",
        fullScreen: false,
      };
      return typeof updater === "function" ? updater(previous) : updater;
    });
    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(React.StrictMode, null, children);

    renderHook(
      () =>
        useLoadComponents({
          isOpen: true,
          columnMapping: {
            components: {
              source: "typed",
              value: {
                type: "TextComponent",
                legacyText: "ignored",
              },
            },
            response_components: {
              source: "typed",
              value: {
                type: "ButtonResponseComponent",
                button_text: "Continue",
                width: 20,
                height: 6,
                rotation: 12,
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
      { wrapper },
    );

    await waitFor(() => {
      expect(setComponents).toHaveBeenCalledTimes(1);
    });
    const loadedComponents = setComponents.mock.calls[0][0] as TrialComponent[];

    expect(loadedComponents[0].config).not.toHaveProperty("legacyText");
    expect(loadedComponents[1]).toEqual(
      expect.objectContaining({
        type: "ButtonResponseComponent",
        x: 500,
        y: 350,
        width: 200,
        height: 60,
        rotation: 12,
        config: expect.objectContaining({
          button_text: { source: "typed", value: "Continue" },
          rotation: { source: "typed", value: 12 },
        }),
      }),
    );
    expect(setSelectedId).not.toHaveBeenCalled();
  });
});
