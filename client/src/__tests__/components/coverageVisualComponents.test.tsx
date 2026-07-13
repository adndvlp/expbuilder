import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AudioComponent from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/VisualComponents/AudioComponent";
import AudioResponseComponent from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/VisualComponents/AudioResponseComponent";
import ButtonResponseComponent from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/VisualComponents/ButtonResponseComponent";
import ClickResponseComponent from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/VisualComponents/ClickResponseComponent";
import FileUploadResponseComponent from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/VisualComponents/FileUploadResponseComponent";
import ImageComponent from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/VisualComponents/ImageComponent";
import InputResponseComponent from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/VisualComponents/InputResponseComponent";
import KeyboardResponseComponent from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/VisualComponents/KeyboardResponseComponent";
import SketchpadComponent from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/VisualComponents/SketchpadComponent";
import SliderResponseComponent from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/VisualComponents/SliderResponseComponent";
import TextComponent from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/VisualComponents/TextComponent";
import VideoComponent from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/VisualComponents/VideoComponent";
import { TrialComponent } from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/types";

vi.mock("konva", () => ({ default: {} }));

const imageMockState = vi.hoisted(() => ({
  loaded: true,
}));

const konvaMockState = vi.hoisted(() => ({
  nullRefNames: new Set<string>(),
  activeAnchor: "middle-right" as string | undefined,
  scaleX: 1.4,
  scaleY: 1.3,
}));

vi.mock("use-image", () => ({
  default: (src?: string) =>
    src && imageMockState.loaded
      ? [
          {
            width: 120,
            height: 90,
            naturalWidth: 120,
            naturalHeight: 90,
          },
          "loaded",
        ]
      : [null, "unloaded"],
}));

vi.mock(
  "../../pages/ExperimentBuilder/utils/mapFileToUrl",
  () => ({
    mapFileToUrl: (value: string) => `mapped/${value}`,
  }),
);

vi.mock(
  "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/snapKonvaNode",
  () => ({
    snapKonvaNode: ({ node, onGuidesChange }: any) => {
      onGuidesChange?.([{ orientation: "vertical", position: 100 }]);
      return { x: node.x(), y: node.y() };
    },
  }),
);

vi.mock("react-konva", async () => {
  const React = await vi.importActual<typeof import("react")>("react");

  function createNode(props: any) {
    let x = props.x ?? 20;
    let y = props.y ?? 30;
    let width = props.width ?? 120;
    let height = props.height ?? 60;
    let scaleX = konvaMockState.scaleX;
    let scaleY = konvaMockState.scaleY;
    let rotation = props.rotation ?? 7;
    return {
      x: (next?: number) => {
        if (next !== undefined) x = next;
        return x + 10;
      },
      y: (next?: number) => {
        if (next !== undefined) y = next;
        return y + 12;
      },
      width: (next?: number) => {
        if (next !== undefined) width = next;
        return width;
      },
      height: (next?: number) => {
        if (next !== undefined) height = next;
        return height;
      },
      scaleX: (next?: number) => {
        if (next !== undefined) scaleX = next;
        return scaleX;
      },
      scaleY: (next?: number) => {
        if (next !== undefined) scaleY = next;
        return scaleY;
      },
      rotation: (next?: number) => {
        if (next !== undefined) rotation = next;
        return rotation;
      },
      offsetX: vi.fn(),
      offsetY: vi.fn(),
      getLayer: () => ({ batchDraw: vi.fn() }),
    };
  }

  const eventFor = (node: any) => ({
    target: node,
    cancelBubble: false,
    evt: { preventDefault: vi.fn() },
  });

  const mockElement = (name: string) =>
    React.forwardRef<any, any>((props, ref) => {
      const node = createNode(props);
      React.useImperativeHandle(ref, () =>
        konvaMockState.nullRefNames.has(name) ? null : node,
      );
      const event = eventFor(node);
      return (
        <div data-testid={`konva-${name}`}>
          <button onClick={() => props.onClick?.(event)}>{name} click</button>
          <button onClick={() => props.onTap?.(event)}>{name} tap</button>
          <button onClick={() => props.onDblClick?.(event)}>
            {name} double
          </button>
          <button onClick={() => props.onDragMove?.(event)}>
            {name} drag move
          </button>
          <button onClick={() => props.onDragEnd?.(event)}>
            {name} drag end
          </button>
          <button onClick={() => props.onTransform?.(event)}>
            {name} transform
          </button>
          <button onClick={() => props.onTransformEnd?.(event)}>
            {name} transform end
          </button>
          {props.text && <span>{props.text}</span>}
          {props.children}
        </div>
      );
    });

  const Transformer = React.forwardRef<any, any>((props, ref) => {
    React.useImperativeHandle(ref, () => ({
      nodes: vi.fn(),
      getLayer: () => ({ batchDraw: vi.fn() }),
      getActiveAnchor: () => konvaMockState.activeAnchor,
    }));
    return (
      <div data-testid="konva-Transformer">
        <button
          onClick={() =>
            props.boundBoxFunc?.(
              { width: 60, height: 40 },
              { width: 2, height: 2 },
            )
          }
        >
          Transformer bound small
        </button>
        <button
          onClick={() =>
            props.boundBoxFunc?.(
              { width: 60, height: 40 },
              { width: 200, height: 2 },
            )
          }
        >
          Transformer bound short
        </button>
        <button
          onClick={() =>
            props.boundBoxFunc?.(
              { width: 60, height: 40 },
              { width: 200, height: 120 },
            )
          }
        >
          Transformer bound large
        </button>
      </div>
    );
  });

  return {
    Image: mockElement("Image"),
    Rect: mockElement("Rect"),
    Text: mockElement("Text"),
    Group: mockElement("Group"),
    Line: mockElement("Line"),
    Circle: mockElement("Circle"),
    Transformer,
  };
});

function value(value: unknown) {
  return { source: "typed", value };
}

function shape(
  type: TrialComponent["type"],
  config: Record<string, unknown> = {},
  overrides: Partial<TrialComponent> = {},
): TrialComponent {
  return {
    id: `${type}-id`,
    type,
    x: 100,
    y: 120,
    width: 160,
    height: 80,
    rotation: 4,
    config,
    ...overrides,
  };
}

const componentCases = [
  {
    name: "TextComponent",
    Component: TextComponent,
    props: {
      shapeProps: shape("TextComponent", {
        text: value("Prompt %answer% here"),
        font_size: value(18),
        line_height: value(1.4),
        background_color: value("#ffffff"),
        border_width: value(1),
        border_color: value("#222222"),
        padding: value("4px 8px"),
      }),
      canvasWidth: 800,
      isEditing: false,
      onEditStart: vi.fn(),
    },
  },
  {
    name: "ImageComponent",
    Component: ImageComponent,
    props: {
      shapeProps: shape(
        "ImageComponent",
        { stimulus: value("stim.png") },
        { width: 0, height: 0 },
      ),
      uploadedFiles: [{ name: "stim.png", path: "stim.png" }],
    },
  },
  {
    name: "VideoComponent",
    Component: VideoComponent,
    props: {
      shapeProps: shape("VideoComponent", {
        stimulus: value(["clip.mp4"]),
      }),
      uploadedFiles: [{ name: "clip.mp4", path: "clip.mp4" }],
    },
  },
  {
    name: "AudioComponent",
    Component: AudioComponent,
    props: { shapeProps: shape("AudioComponent") },
  },
  {
    name: "ButtonResponseComponent",
    Component: ButtonResponseComponent,
    props: {
      shapeProps: shape(
        "ButtonResponseComponent",
        {
          choices: value(["Yes", "No,Maybe", "icon.png"]),
          grid_rows: value(2),
          button_font_size: value(16),
          button_color: value("#eeeeee"),
          button_border_width: value(2),
        },
        { buttonFontSize: 16 },
      ),
    },
  },
  {
    name: "KeyboardResponseComponent",
    Component: KeyboardResponseComponent,
    props: {
      shapeProps: shape("KeyboardResponseComponent", {
        choices: value("ALL_KEYS"),
        prompt: value("Press a key"),
      }),
    },
  },
  {
    name: "SliderResponseComponent",
    Component: SliderResponseComponent,
    props: {
      shapeProps: shape("SliderResponseComponent", {
        min: value(0),
        max: value(100),
        slider_start: value(45),
        labels: value(["Low", "High"]),
        require_movement: value(true),
      }),
    },
  },
  {
    name: "InputResponseComponent",
    Component: InputResponseComponent,
    props: {
      shapeProps: shape(
        "InputResponseComponent",
        {
          text: value("Answer: %answer%"),
          input_type: value("datetime-local"),
          placeholder: value("date"),
          input_font_size: value(18),
        },
        { inputFontSize: 18, inputWidth: 180 },
      ),
    },
  },
  {
    name: "SketchpadComponent",
    Component: SketchpadComponent,
    props: {
      shapeProps: shape("SketchpadComponent", {
        canvas_shape: value("circle"),
        canvas_diameter: value(160),
        stroke_color: value("#ff0000"),
        show_clear_button: value(true),
        show_undo_button: value(true),
      }),
    },
  },
  {
    name: "AudioResponseComponent",
    Component: AudioResponseComponent,
    props: {
      shapeProps: shape("AudioResponseComponent", {
        prompt: value("Speak now"),
        recording_duration: value(3000),
      }),
    },
  },
  {
    name: "FileUploadResponseComponent",
    Component: FileUploadResponseComponent,
    props: {
      shapeProps: shape("FileUploadResponseComponent", {
        button_label: value("Upload"),
        accept: value("pdf,csv"),
        multiple: value(true),
        show_preview: value(true),
      }),
    },
  },
  {
    name: "ClickResponseComponent",
    Component: ClickResponseComponent,
    props: {
      shapeProps: shape("ClickResponseComponent", {
        capture_full_screen: value(false),
        show_click_marker: value(true),
        marker_color: value("#ff00ff"),
        marker_radius: value(12),
      }),
    },
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  imageMockState.loaded = true;
  konvaMockState.nullRefNames.clear();
  konvaMockState.activeAnchor = "middle-right";
  konvaMockState.scaleX = 1.4;
  konvaMockState.scaleY = 1.3;
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    drawImage: vi.fn(),
  } as any);
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("TrialDesigner visual components", () => {
  it.each(componentCases)("renders and handles Konva events for $name", ({ Component, props }) => {
    const onSelect = vi.fn();
    const onChange = vi.fn();
    const onGuidesChange = vi.fn();
    const rendered = render(
      <Component
        {...(props as any)}
        isSelected
        onSelect={onSelect}
        onChange={onChange}
        onGuidesChange={onGuidesChange}
      />,
    );

    for (const label of [
      "Group click",
      "Group tap",
      "Group double",
      "Group drag move",
      "Group drag end",
      "Group transform",
      "Group transform end",
      "Image click",
      "Image tap",
      "Image drag move",
      "Image drag end",
      "Image transform end",
      "Rect click",
      "Rect drag move",
      "Rect drag end",
      "Rect transform",
      "Rect transform end",
      "Transformer bound small",
      "Transformer bound short",
      "Transformer bound large",
    ]) {
      for (const button of screen.queryAllByText(label)) {
        fireEvent.click(button);
      }
    }

    expect(rendered.container.firstChild).toBeTruthy();
    expect(onSelect.mock.calls.length + onChange.mock.calls.length).toBeGreaterThan(
      0,
      );
  });

  it("selects text on first click and tolerates missing resize refs", () => {
    const onSelect = vi.fn();
    const onEditStart = vi.fn();
    const { unmount } = render(
      <TextComponent
        shapeProps={shape("TextComponent", {
          text: value("Plain text"),
          font_size: value(18),
        })}
        isSelected={false}
        onSelect={onSelect}
        onChange={vi.fn()}
        onEditStart={onEditStart}
      />,
    );

    fireEvent.click(screen.getByText("Group click"));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onEditStart).not.toHaveBeenCalled();
    unmount();

    konvaMockState.nullRefNames.add("Rect");
    const onChange = vi.fn();
    render(
      <TextComponent
        shapeProps={shape("TextComponent", {
          text: value("Resize guard"),
          font_size: value(18),
        })}
        isSelected
        onSelect={vi.fn()}
        onChange={onChange}
        onGuidesChange={vi.fn()}
      />,
    );

    for (const button of screen.getAllByText("Rect transform")) {
      fireEvent.click(button);
    }
    for (const button of screen.getAllByText("Rect transform end")) {
      fireEvent.click(button);
    }
    expect(onChange).not.toHaveBeenCalled();
  });

  it("renders cloze text with an empty segment and a border-only background", () => {
    const { container } = render(
      <TextComponent
        shapeProps={shape(
          "TextComponent",
          {
            text: value("%answer%"),
            background_color: value("transparent"),
            border_width: value(1),
            border_color: value("#222222"),
          },
          { rotation: undefined },
        )}
        isSelected
        onSelect={vi.fn()}
        onChange={vi.fn()}
      />,
    );

    expect(container.firstChild).toBeTruthy();
  });

  it("handles vertical resizing and transform-end fallback without an active anchor", () => {
    konvaMockState.activeAnchor = "bottom-center";
    const verticalChange = vi.fn();
    const verticalRender = render(
      <TextComponent
        shapeProps={shape("TextComponent", {
          text: value("Plain resize text"),
          font_size: value(18),
        })}
        isSelected
        onSelect={vi.fn()}
        onChange={verticalChange}
      />,
    );

    for (const button of screen.getAllByText("Rect transform")) {
      fireEvent.click(button);
    }
    expect(verticalChange).toHaveBeenCalledWith(
      expect.objectContaining({ __transient: true }),
    );
    verticalRender.unmount();

    konvaMockState.activeAnchor = undefined;
    const finalChange = vi.fn();
    render(
      <TextComponent
        shapeProps={shape("TextComponent", {
          text: value("Scale font text"),
          font_size: value(18),
        })}
        isSelected
        onSelect={vi.fn()}
        onChange={finalChange}
      />,
    );

    for (const button of screen.getAllByText("Rect transform end")) {
      fireEvent.click(button);
    }
    expect(finalChange).toHaveBeenCalledWith(
      expect.objectContaining({
        __transient: undefined,
        textFontSize: expect.any(Number),
      }),
    );
  });

  it("renders slider response config fallbacks and unselected state", () => {
    const baseProps = {
      isSelected: false,
      onSelect: vi.fn(),
      onChange: vi.fn(),
      onGuidesChange: vi.fn(),
    };
    const cases = [
      shape("SliderResponseComponent", {}, { width: 0, height: 0, rotation: undefined }),
      shape("SliderResponseComponent", {
        min: { source: "csv", value: 0 },
        max: 120,
        slider_start: value([60]),
        labels: value("Low, High"),
        require_movement: value(false),
      }),
      shape("SliderResponseComponent", {
        min: value({ invalid: true }),
        max: { value: 100 },
        slider_start: 50,
        labels: value(12),
      }),
      shape("SliderResponseComponent", {
        min: value(10),
        max: value(10),
        slider_start: value(10),
        labels: "Solo",
      }),
    ];

    for (const shapeProps of cases) {
      const { unmount } = render(
        <SliderResponseComponent
          {...baseProps}
          shapeProps={shapeProps}
        />,
      );

      expect(screen.getByText("Slider Response")).toBeInTheDocument();
      expect(screen.queryByTestId("konva-Transformer")).not.toBeInTheDocument();
      unmount();
    }
  });

  it("renders input response type variants and direct config values", () => {
    const baseProps = {
      isSelected: false,
      onSelect: vi.fn(),
      onChange: vi.fn(),
      onGuidesChange: vi.fn(),
    };
    const cases = [
      {
        config: { input_type: value("date") },
        expectedText: "YYYY-MM-DD",
      },
      {
        config: {
          input_type: value("date"),
          placeholder: value("Birthday"),
        },
        expectedText: "Birthday",
      },
      {
        config: { input_type: value("time") },
        expectedText: "HH:MM",
      },
      {
        config: {
          input_type: value("time"),
          placeholder: value("Start"),
        },
        expectedText: "Start",
      },
      {
        config: { input_type: value("datetime-local") },
        expectedText: "YYYY-MM-DD HH:MM",
      },
      {
        config: { input_type: value("number") },
        expectedText: "0",
      },
      {
        config: {
          input_type: value("number"),
          placeholder: value("Age"),
        },
        expectedText: "Age",
      },
      {
        config: {
          input_type: "password",
          placeholder: "Visible placeholder",
          input_font_size: value(null),
          input_border_width: 0,
        },
        expectedText: "••••••",
      },
      {
        config: {
          input_type: value("text"),
          placeholder: value(""),
        },
      },
    ];

    for (const { config, expectedText } of cases) {
      const { unmount } = render(
        <InputResponseComponent
          {...baseProps}
          shapeProps={shape("InputResponseComponent", config)}
        />,
      );

      if (expectedText) {
        expect(screen.getByText(expectedText)).toBeInTheDocument();
      }
      unmount();
    }
  });

  it("renders file upload response config fallbacks and direct values", () => {
    const baseProps = {
      isSelected: false,
      onSelect: vi.fn(),
      onChange: vi.fn(),
      onGuidesChange: vi.fn(),
    };
    const cases = [
      {
        config: {},
        expected: "Choose File",
      },
      {
        config: {
          button_label: { source: "none", value: "Ignored" },
          multiple: { source: "none", value: true },
          accept: "raw/*",
        },
        expected: "raw/*",
      },
      {
        config: {
          button_label: value(null),
          multiple: value(null),
          accept: value(null),
        },
        expected: "Choose File",
      },
      {
        config: {
          button_label: "Upload now",
          multiple: false,
          accept: "",
        },
        expected: "Upload now",
      },
    ];

    for (const { config, expected } of cases) {
      const { unmount } = render(
        <FileUploadResponseComponent
          {...baseProps}
          shapeProps={shape("FileUploadResponseComponent", config, {
            width: 0,
            height: 0,
            rotation: undefined,
          })}
        />,
      );

      expect(screen.getByText(expected)).toBeInTheDocument();
      expect(screen.getByText("File Upload")).toBeInTheDocument();
      expect(screen.queryByTestId("konva-Transformer")).not.toBeInTheDocument();
      unmount();
    }
  });

  it("renders primitive config values for click and sketchpad components", () => {
    const baseProps = {
      isSelected: false,
      onSelect: vi.fn(),
      onChange: vi.fn(),
      onGuidesChange: vi.fn(),
    };

    const clickRender = render(
      <ClickResponseComponent
        {...baseProps}
        shapeProps={shape("ClickResponseComponent", {
          capture_full_screen: false,
          show_click_marker: true,
          marker_color: "#00ff00",
        })}
      />,
    );
    expect(screen.getByText(/Click Response/)).toBeInTheDocument();
    clickRender.unmount();

    render(
      <SketchpadComponent
        {...baseProps}
        shapeProps={shape("SketchpadComponent", {
          canvas_shape: "circle",
          canvas_diameter: 140,
          stroke_color: "#00ff00",
        })}
      />,
    );
    expect(screen.getByText(/140/)).toBeInTheDocument();
  });

  it("renders click response defaults with natural dimensions and no marker", () => {
    render(
      <ClickResponseComponent
        shapeProps={shape(
          "ClickResponseComponent",
          { marker_color: value(null) },
          { width: 0, height: 0, rotation: undefined },
        )}
        isSelected={false}
        onSelect={vi.fn()}
        onChange={vi.fn()}
        onGuidesChange={vi.fn()}
      />,
    );

    expect(screen.getByText(/Click Response \(Full Screen\)/)).toBeInTheDocument();
    expect(screen.getByText("No marker")).toBeInTheDocument();
  });

  it.each([
    {
      name: "bordered circle",
      selected: true,
      config: {
        canvas_shape: value("circle"),
        canvas_diameter: value(180),
        canvas_border_width: value(3),
      },
      overrides: {},
    },
    {
      name: "bordered natural rectangle",
      selected: true,
      config: {
        canvas_shape: value("rectangle"),
        canvas_width: value(240),
        canvas_height: value(160),
        canvas_border_width: value(2),
        stroke_width: value(null),
      },
      overrides: { width: 0, height: 0, rotation: undefined },
    },
    {
      name: "selected borderless rectangle",
      selected: true,
      config: {
        canvas_shape: "rectangle",
        canvas_border_width: 0,
      },
      overrides: {},
    },
    {
      name: "unselected borderless rectangle",
      selected: false,
      config: {
        canvas_shape: "rectangle",
        canvas_border_width: 0,
      },
      overrides: {},
    },
  ])("renders $name", ({ selected, config, overrides }) => {
    const rendered = render(
      <SketchpadComponent
        shapeProps={shape("SketchpadComponent", config, overrides)}
        isSelected={selected}
        onSelect={vi.fn()}
        onChange={vi.fn()}
        onGuidesChange={vi.fn()}
      />,
    );

    expect(rendered.container.firstChild).toBeTruthy();
    rendered.unmount();
  });

  it("ignores audio transforms before the speaker image is available", () => {
    imageMockState.loaded = false;
    const onChange = vi.fn();

    render(
      <AudioComponent
        shapeProps={shape("AudioComponent")}
        isSelected
        onSelect={vi.fn()}
        onChange={onChange}
        onGuidesChange={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByText("Image transform end"));

    expect(onChange).not.toHaveBeenCalled();
  });

  it("uses the loaded speaker dimensions when audio dimensions are absent", () => {
    const rendered = render(
      <AudioComponent
        shapeProps={shape("AudioComponent", {}, {
          width: 0,
          height: 0,
          rotation: undefined,
        })}
        isSelected={false}
        onSelect={vi.fn()}
        onChange={vi.fn()}
        onGuidesChange={vi.fn()}
      />,
    );

    expect(rendered.container.firstChild).toBeTruthy();
  });

  it("renders button response fallback choices, direct config values and unselected state", () => {
    const baseProps = {
      onSelect: vi.fn(),
      onChange: vi.fn(),
      onGuidesChange: vi.fn(),
    };
    const emptyChoice = { toString: () => "" };
    const cases = [
      {
        config: {
          choices: { source: "none", value: ["ignored"] },
          grid_rows: { source: "none", value: 3 },
          button_color: { source: "none", value: "#123456" },
        },
        overrides: { width: 0, height: 0, rotation: undefined },
        selected: false,
      },
      {
        config: {
          choices: value("   "),
          grid_rows: value(Number.NaN),
          grid_columns: value(2),
          button_text_color: "#111111",
          button_font_size: 12,
          button_border_radius: 6,
          button_border_color: "#222222",
          button_border_width: 0,
        },
        overrides: { width: 0, height: 0 },
        selected: true,
      },
      {
        config: {
          choices: "Direct Choice",
          grid_rows: 1,
          grid_columns: 1,
        },
        overrides: {},
        selected: false,
      },
      {
        config: {
          choices: value([emptyChoice, 2]),
          grid_rows: value(1),
          grid_columns: value(2),
          image_button_width: value(null),
          image_button_height: value(null),
        },
        overrides: {},
        selected: true,
      },
    ];

    for (const testCase of cases) {
      const { unmount } = render(
        <ButtonResponseComponent
          {...baseProps}
          shapeProps={shape(
            "ButtonResponseComponent",
            testCase.config,
            testCase.overrides,
          )}
          isSelected={testCase.selected}
        />,
      );

      fireEvent.click(screen.getAllByText("Group drag move")[0]);
      fireEvent.click(screen.getAllByText("Group drag end")[0]);
      if (testCase.selected) {
        fireEvent.click(screen.getAllByText("Group transform end")[0]);
      }
      expect(screen.queryByTestId("konva-Transformer")).toBe(
        testCase.selected ? screen.getByTestId("konva-Transformer") : null,
      );
      unmount();
    }

    imageMockState.loaded = false;
    const csvRender = render(
      <ButtonResponseComponent
        {...baseProps}
        shapeProps={shape("ButtonResponseComponent", {
          choices: { source: "csv", value: "choice_column" },
        })}
        isSelected={false}
      />,
    );
    expect(csvRender.container.firstChild).toBeTruthy();
    csvRender.unmount();
  });

  it("renders audio response config variants and unselected state", () => {
    const baseProps = {
      onSelect: vi.fn(),
      onChange: vi.fn(),
      onGuidesChange: vi.fn(),
    };
    const cases = [
      {
        config: {
          show_done_button: value(false),
          done_button_label: { source: "none", value: "Ignored" },
          allow_playback: true,
        },
        overrides: { width: 0, height: 0, rotation: undefined },
        selected: false,
      },
      {
        config: {
          show_done_button: { source: "csv", value: true },
          done_button_label: "Done",
          allow_playback: value(true),
        },
        overrides: { width: 120, height: 100 },
        selected: true,
      },
    ];

    for (const testCase of cases) {
      const { unmount } = render(
        <AudioResponseComponent
          {...baseProps}
          shapeProps={shape(
            "AudioResponseComponent",
            testCase.config,
            testCase.overrides,
          )}
          isSelected={testCase.selected}
        />,
      );

      fireEvent.click(screen.getAllByText("Group drag move")[0]);
      fireEvent.click(screen.getAllByText("Group drag end")[0]);
      if (testCase.selected) {
        fireEvent.click(screen.getAllByText("Group transform end")[0]);
      }
      expect(screen.queryByTestId("konva-Transformer")).toBe(
        testCase.selected ? screen.getByTestId("konva-Transformer") : null,
      );
      unmount();
    }
  });

  it("preserves direct false audio response config and defaults null values", () => {
    render(
      <AudioResponseComponent
        shapeProps={shape("AudioResponseComponent", {
          show_done_button: false,
          done_button_label: { source: "typed", value: null },
          allow_playback: { source: "typed", value: null },
        })}
        isSelected={false}
        onSelect={vi.fn()}
        onChange={vi.fn()}
        onGuidesChange={vi.fn()}
      />,
    );

    expect(screen.queryByText("Continue")).not.toBeInTheDocument();
    expect(screen.queryByText("✓ Playback enabled")).not.toBeInTheDocument();
  });

  it("renders keyboard response labels for supported choice formats", () => {
    const cases = [
      [{}, "⌨️ Keyboard Response (All Keys)"],
      [{ choices: value("NO_KEYS") }, "⌨️ Keyboard Response (Disabled)"],
      [
        { choices: value(["a", 1, { unsupported: true }]) },
        "⌨️ Keys: a, 1, ?",
      ],
      [{ choices: "space" }, "⌨️ Key: space"],
      [{ choices: value({ unsupported: true }) }, "⌨️ Keyboard Response (All Keys)"],
      [{ choices: { unsupported: true } }, "⌨️ Keyboard Response (All Keys)"],
      [{ choices: 0 }, "⌨️ Key: 0"],
      [{ choices: true }, "⌨️ Keyboard Response"],
    ] as const;

    for (const [config, expectedText] of cases) {
      const { unmount } = render(
        <KeyboardResponseComponent
          shapeProps={shape("KeyboardResponseComponent", config)}
          isSelected={false}
          onSelect={vi.fn()}
          onChange={vi.fn()}
        />,
      );

      expect(screen.getByText(expectedText)).toBeInTheDocument();
      unmount();
    }

    const { unmount } = render(
      <KeyboardResponseComponent
        shapeProps={shape(
          "KeyboardResponseComponent",
          {},
          { width: 0, height: 0, rotation: 0 },
        )}
        isSelected={false}
        onSelect={vi.fn()}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByText("⌨️ Keyboard Response (All Keys)")).toBeInTheDocument();
    unmount();
  });

  it("uses placeholder image interactions when an image stimulus is missing", () => {
    const onChange = vi.fn();
    const onGuidesChange = vi.fn();
    render(
      <ImageComponent
        shapeProps={shape("ImageComponent", {}, { width: 0, height: 0 })}
        isSelected
        onSelect={vi.fn()}
        onChange={onChange}
        onGuidesChange={onGuidesChange}
      />,
    );

    fireEvent.click(screen.getByText("Image drag move"));
    expect(onGuidesChange).toHaveBeenCalledWith([
      { orientation: "vertical", position: 100 },
    ]);

    fireEvent.click(screen.getByText("Image drag end"));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ x: 110, y: 132 }),
    );
    expect(onGuidesChange).toHaveBeenCalledWith([]);

    fireEvent.click(screen.getByText("Image transform end"));
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        width: 168,
        height: 117,
        rotation: 4,
      }),
    );
    fireEvent.click(screen.getByText("Transformer bound small"));
    fireEvent.click(screen.getByText("Transformer bound large"));
  });

  it("handles direct image URLs, unselected state and missing image transforms", () => {
    const baseProps = {
      onSelect: vi.fn(),
      onChange: vi.fn(),
      onGuidesChange: vi.fn(),
    };
    const { unmount } = render(
      <ImageComponent
        {...baseProps}
        shapeProps={shape(
          "ImageComponent",
          { stimulus: "https://cdn.test/image.png" },
          { width: 40, height: 30, rotation: undefined },
        )}
        isSelected={false}
      />,
    );

    fireEvent.click(screen.getByText("Image click"));
    fireEvent.click(screen.getByText("Image drag move"));
    fireEvent.click(screen.getByText("Image drag end"));
    expect(baseProps.onSelect).toHaveBeenCalled();
    expect(baseProps.onChange).toHaveBeenCalledWith(
      expect.objectContaining({ x: 110, y: 132 }),
    );
    expect(screen.queryByTestId("konva-Transformer")).not.toBeInTheDocument();
    unmount();

    const csvImage = render(
      <ImageComponent
        {...baseProps}
        shapeProps={shape("ImageComponent", {
          stimulus: { source: "csv", value: "csv-image.png" },
        })}
        isSelected={false}
      />,
    );
    expect(csvImage.container.firstChild).toBeTruthy();
    csvImage.unmount();

    const sizedPlaceholder = render(
      <ImageComponent
        {...baseProps}
        shapeProps={shape("ImageComponent", {}, { width: 80, height: 60, rotation: undefined })}
        isSelected={false}
      />,
    );
    expect(sizedPlaceholder.container.firstChild).toBeTruthy();
    sizedPlaceholder.unmount();

    imageMockState.loaded = false;
    const onChange = vi.fn();
    render(
      <ImageComponent
        shapeProps={shape("ImageComponent", {}, { width: 0, height: 0 })}
        isSelected
        onSelect={vi.fn()}
        onChange={onChange}
        onGuidesChange={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByText("Image transform end"));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("renders a captured video frame after seeked metadata is available", async () => {
    const originalCreateElement = document.createElement.bind(document);
    const listeners = new Map<string, EventListenerOrEventListenerObject>();
    const createdVideos: HTMLVideoElement[] = [];
    vi.spyOn(document, "createElement").mockImplementation((tagName: string) => {
      if (tagName === "video") {
        const video = originalCreateElement("video") as HTMLVideoElement;
        Object.defineProperty(video, "videoWidth", {
          value: 320,
          configurable: true,
        });
        Object.defineProperty(video, "videoHeight", {
          value: 180,
          configurable: true,
        });
        video.addEventListener = vi.fn((eventName, listener) => {
          listeners.set(eventName, listener);
        }) as any;
        createdVideos.push(video);
        return video;
      }
      if (tagName === "canvas") {
        const canvas = originalCreateElement("canvas") as HTMLCanvasElement;
        canvas.toDataURL = vi.fn(() => "data:image/png;base64,frame");
        return canvas;
      }
      return originalCreateElement(tagName);
    });

    class MockImage {
      width = 320;
      height = 180;
      private value = "";
      private loadHandler: (() => void) | null = null;

      get onload() {
        return this.loadHandler;
      }

      set onload(nextHandler: (() => void) | null) {
        this.loadHandler = nextHandler;
        if (this.value) {
          this.loadHandler?.();
        }
      }

      get src() {
        return this.value;
      }

      set src(nextValue: string) {
        this.value = nextValue;
        this.loadHandler?.();
      }
    }

    vi.stubGlobal("Image", MockImage);
    const onChange = vi.fn();
    const { rerender } = render(
      <VideoComponent
        shapeProps={shape(
          "VideoComponent",
          { stimulus: value(["clip.mp4"]) },
          { width: undefined, height: undefined },
        )}
        uploadedFiles={[{ name: "clip.mp4", path: "clip.mp4" }]}
        isSelected
        onSelect={vi.fn()}
        onChange={onChange}
        onGuidesChange={vi.fn()}
      />,
    );

    await act(async () => {
      const loadedData = listeners.get("loadeddata");
      const seeked = listeners.get("seeked");
      if (typeof loadedData === "function") loadedData(new Event("loadeddata"));
      if (typeof seeked === "function") seeked(new Event("seeked"));
      await Promise.resolve();
    });

    await waitFor(() => {
      fireEvent.click(screen.getByText("Image transform end"));
      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({
          width: 448,
          height: 234,
          rotation: 4,
        }),
      );
    });
    fireEvent.click(screen.getByText("Image drag move"));
    fireEvent.click(screen.getByText("Image drag end"));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ x: 110, y: 132 }),
    );
    fireEvent.click(screen.getByText("Transformer bound small"));
    fireEvent.click(screen.getByText("Transformer bound large"));
    expect(createdVideos[0]?.src).toContain("/mapped/clip.mp4");

    rerender(
      <VideoComponent
        shapeProps={shape(
          "VideoComponent",
          { stimulus: value(["clip.mp4"]) },
          { width: 160, height: 90, rotation: 0 },
        )}
        uploadedFiles={[{ name: "clip.mp4", path: "clip.mp4" }]}
        isSelected
        onSelect={vi.fn()}
        onChange={onChange}
        onGuidesChange={vi.fn()}
      />,
    );
    expect(screen.getByTestId("konva-Image")).toBeInTheDocument();
  });

  it("skips video frame capture when canvas context is unavailable", async () => {
    const originalCreateElement = document.createElement.bind(document);
    const listeners = new Map<string, EventListenerOrEventListenerObject>();
    vi.spyOn(document, "createElement").mockImplementation((tagName: string) => {
      if (tagName === "video") {
        const video = originalCreateElement("video") as HTMLVideoElement;
        video.pause = vi.fn();
        video.addEventListener = vi.fn((eventName, listener) => {
          listeners.set(eventName, listener);
        }) as any;
        return video;
      }
      if (tagName === "canvas") {
        const canvas = originalCreateElement("canvas") as HTMLCanvasElement;
        canvas.getContext = vi.fn(() => null) as any;
        return canvas;
      }
      return originalCreateElement(tagName);
    });

    render(
      <VideoComponent
        shapeProps={shape("VideoComponent", { stimulus: value("clip.mp4") })}
        isSelected={false}
        onSelect={vi.fn()}
        onChange={vi.fn()}
      />,
    );

    await act(async () => {
      const seeked = listeners.get("seeked");
      if (typeof seeked === "function") seeked(new Event("seeked"));
      await Promise.resolve();
    });
    expect(screen.getByTestId("konva-Image")).toBeInTheDocument();
  });

  it("handles video stimulus config fallbacks and direct URLs", () => {
    const originalCreateElement = document.createElement.bind(document);
    const createdVideos: HTMLVideoElement[] = [];
    vi.spyOn(document, "createElement").mockImplementation((tagName: string) => {
      if (tagName === "video") {
        const video = originalCreateElement("video") as HTMLVideoElement;
        video.pause = vi.fn();
        video.addEventListener = vi.fn() as any;
        createdVideos.push(video);
        return video;
      }
      return originalCreateElement(tagName);
    });

    const props = {
      isSelected: false,
      onSelect: vi.fn(),
      onChange: vi.fn(),
    };
    const { rerender } = render(
      <VideoComponent
        {...props}
        shapeProps={shape("VideoComponent", {}, { rotation: 0 })}
      />,
    );
    expect(createdVideos).toHaveLength(0);

    rerender(
      <VideoComponent
        {...props}
        shapeProps={shape("VideoComponent", { stimulus: "http://cdn.test/clip.mp4" })}
      />,
    );
    expect(createdVideos[0].src).toBe("http://cdn.test/clip.mp4");

    rerender(
      <VideoComponent
        {...props}
        shapeProps={shape("VideoComponent", { stimulus: value("") })}
      />,
    );
    expect(createdVideos).toHaveLength(1);

    rerender(
      <VideoComponent
        {...props}
        shapeProps={shape("VideoComponent", { stimulus: value("local.mp4") })}
      />,
    );
    expect(createdVideos[1].src).toContain("/local.mp4");
  });

  it("ignores video transforms while both frame and placeholder are unavailable", () => {
    imageMockState.loaded = false;
    const onChange = vi.fn();

    render(
      <VideoComponent
        shapeProps={shape("VideoComponent", { stimulus: value("") })}
        isSelected
        onSelect={vi.fn()}
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByText("Image transform end"));
    expect(onChange).not.toHaveBeenCalled();
  });
});
