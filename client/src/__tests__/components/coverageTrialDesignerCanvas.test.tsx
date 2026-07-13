import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import KonvaCanvas from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/KonvaCanvas";
import renderComponent from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/renderComponent";
import EditorHitBox from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/experimentalScene/EditorHitBox";
import { TrialComponent } from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/types";

vi.mock("konva", () => ({ default: {} }));

vi.mock("react-konva", async () => {
  const React = await vi.importActual<typeof import("react")>("react");

  function nodeApi(props: any) {
    let scaleX = 1.5;
    let scaleY = 1.4;
    return {
      x: () => (props.x ?? 0) + 12,
      y: () => (props.y ?? 0) + 18,
      rotation: () => (props.rotation ?? 0) + 5,
      scaleX: (next?: number) => {
        if (next !== undefined) scaleX = next;
        return scaleX;
      },
      scaleY: (next?: number) => {
        if (next !== undefined) scaleY = next;
        return scaleY;
      },
    };
  }

  const Group = React.forwardRef<any, any>((props, ref) => {
    const node = nodeApi(props);
    React.useImperativeHandle(ref, () => node);
    const event = { target: node };
    return (
      <div data-testid={`konva-group-${props.x}-${props.y}`}>
        <button onClick={props.onClick}>select group</button>
        <button
          onClick={() =>
            props.onDblClick?.({
              cancelBubble: false,
              evt: { preventDefault: vi.fn() },
            })
          }
        >
          double group
        </button>
        <button onClick={() => props.onDragMove?.(event)}>drag move</button>
        <button onClick={() => props.onDragEnd?.(event)}>drag end</button>
        <button onClick={() => props.onTransformEnd?.()}>transform end</button>
        {props.children}
      </div>
    );
  });
  Group.displayName = "MockKonvaGroup";

  const Transformer = React.forwardRef<any, any>((props, ref) => {
    React.useImperativeHandle(ref, () => ({
      nodes: vi.fn(),
      getLayer: () => ({ batchDraw: vi.fn() }),
    }));
    return (
      <div data-testid="konva-transformer">
        <button
          onClick={() =>
            props.boundBoxFunc?.(
              { width: 40, height: 40 },
              { width: 5, height: 5 },
            )
          }
        >
          bound small
        </button>
        <button
          onClick={() =>
            props.boundBoxFunc?.(
              { width: 40, height: 40 },
              { width: 60, height: 60 },
            )
          }
        >
          bound large
        </button>
      </div>
    );
  });
  Transformer.displayName = "MockKonvaTransformer";

  const Rect = (props: any) => {
    const node = nodeApi(props);
    return (
      <button
        data-testid={`konva-rect-${props.id ?? "background"}`}
        onClick={props.onClick}
        onDragEnd={() => props.onDragEnd?.({ target: node })}
      >
        rect {props.id ?? "background"}
      </button>
    );
  };

  const Stage = React.forwardRef<any, any>((props, ref) => {
    const stageTarget: any = { getStage: () => stageTarget };
    React.useImperativeHandle(ref, () => stageTarget);
    return (
      <div data-testid="konva-stage">
        <button onClick={() => props.onClick?.({ target: stageTarget })}>
          clear stage
        </button>
        <button
          onClick={() =>
            props.onClick?.({ target: { getStage: () => stageTarget } })
          }
        >
          child stage click
        </button>
        {props.children}
      </div>
    );
  });
  Stage.displayName = "MockKonvaStage";

  return {
    Stage,
    Layer: ({ children }: any) => <div data-testid="konva-layer">{children}</div>,
    Rect,
    Group,
    Transformer,
  };
});

vi.mock(
  "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/snapKonvaNode",
  () => ({
    snapKonvaNode: ({ node, onGuidesChange }: any) => {
      onGuidesChange?.([{ orientation: "vertical", position: 100 }]);
      return { x: node.x(), y: node.y() };
    },
  }),
);

vi.mock(
  "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/VisualComponents",
  () => {
    const visualMock =
      (name: string) =>
      ({ shapeProps, onSelect, onChange }: any) => (
        <button
          data-testid={`visual-${name}-${shapeProps.id}`}
          onClick={() => {
            onSelect();
            onChange({
              x: 210,
              y: 190,
              width: 320,
              height: 120,
              rotation: 12,
              zIndex: 7,
              textFontSize: 24,
              inputFontSize: 19,
              buttonFontSize: 18,
            });
          }}
        >
          {name}
        </button>
      );

    return {
      ImageComponent: visualMock("ImageComponent"),
      VideoComponent: visualMock("VideoComponent"),
      AudioComponent: visualMock("AudioComponent"),
      TextComponent: visualMock("TextComponent"),
      ButtonResponseComponent: visualMock("ButtonResponseComponent"),
      KeyboardResponseComponent: visualMock("KeyboardResponseComponent"),
      SliderResponseComponent: visualMock("SliderResponseComponent"),
      InputResponseComponent: visualMock("InputResponseComponent"),
      SketchpadComponent: visualMock("SketchpadComponent"),
      AudioResponseComponent: visualMock("AudioResponseComponent"),
      FileUploadResponseComponent: visualMock("FileUploadResponseComponent"),
      ClickResponseComponent: visualMock("ClickResponseComponent"),
    };
  },
);

vi.mock(
  "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/AlignmentGuidesLayer",
  () => ({
    default: ({ guides }: any) => (
      <div data-testid="alignment-guides">{guides.length}</div>
    ),
  }),
);

vi.mock(
  "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/experimentalScene/ExperimentalHtmlSceneLayer",
  () => ({
    default: ({ components, onMetricsChange, activeDomId }: any) => (
      <div>
        <button
          data-testid="html-scene-layer"
          onClick={() =>
            onMetricsChange({
              [components.find((component: TrialComponent) => component.id === "front")
                ?.id ?? components[0]?.id ?? "missing"]: {
                width: 80,
                height: 40,
              },
            })
          }
        >
          html scene
        </button>
        <span data-testid="active-dom-id">{activeDomId ?? "none"}</span>
      </div>
    ),
  }),
);

vi.mock(
  "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/TextEditingOverlay",
  () => ({
    default: ({ component, onCommit, onCancel }: any) => (
      <div data-testid="text-editing-overlay">
        <span>{component?.id ?? "none"}</span>
        <button onClick={() => onCommit("Edited text")}>commit text</button>
        <button onClick={onCancel}>cancel text</button>
      </div>
    ),
  }),
);

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
      <output data-testid="render-state">{JSON.stringify(components[0])}</output>
      <output data-testid="render-selected">{selected ?? "none"}</output>
    </div>
  );
}

describe("coverage trial designer renderComponent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders visual components and syncs component config on changes", async () => {
    render(
      <RenderComponentHarness
        initial={component("TextComponent", {
          id: "text-a",
          textFontSize: 16,
        })}
      />,
    );

    fireEvent.click(screen.getByTestId("visual-TextComponent-text-a"));

    await waitFor(() => {
      expect(screen.getByTestId("render-selected")).toHaveTextContent("text-a");
      expect(screen.getByTestId("render-state")).toHaveTextContent(
        '"font_size"',
      );
      expect(screen.getByTestId("render-state")).toHaveTextContent('"width"');
      expect(screen.getByTestId("render-state")).toHaveTextContent('"zIndex"');
    });
  });

  it("renders html-scene hit boxes and handles drag, edit and transforms", async () => {
    render(
      <RenderComponentHarness
        initial={component("ButtonResponseComponent", {
          id: "button-a",
          buttonFontSize: 14,
          config: {
            button_font_size: { source: "typed", value: 14 },
          },
        })}
      />,
    );

    fireEvent.click(screen.getByText("select group"));
    fireEvent.click(screen.getByText("double group"));
    fireEvent.click(screen.getByText("drag end"));
    fireEvent.click(screen.getByText("transform end"));

    await waitFor(() => {
      expect(screen.getByTestId("render-selected")).toHaveTextContent("button-a");
      expect(screen.getByTestId("render-state")).toHaveTextContent(
        '"button_font_size"',
      );
      expect(screen.getByTestId("render-state")).toHaveTextContent(
        '"coordinates"',
      );
    });
  });

  it("falls back to a rectangle for unknown component types", async () => {
    render(
      <RenderComponentHarness
        initial={{
          ...(component("AudioComponent") as any),
          id: "unknown-a",
          type: "UnknownComponent",
        }}
        selectedId={null}
      />,
    );

    fireEvent.click(screen.getByTestId("konva-rect-unknown-a"));
    fireEvent.dragEnd(screen.getByTestId("konva-rect-unknown-a"));

    await waitFor(() => {
      expect(screen.getByTestId("render-selected")).toHaveTextContent(
        "unknown-a",
      );
      expect(screen.getByTestId("render-state")).toHaveTextContent(
        '"coordinates"',
      );
    });
  });
});

describe("coverage trial designer KonvaCanvas", () => {
  it("handles context menu, drops, text overlay and stage clearing", () => {
    const onDrop = vi.fn();
    const setSelectedId = vi.fn();
    const onGuidesChange = vi.fn();
    const onCanvasContextMenu = vi.fn();
    const onCommitTextEdit = vi.fn();
    const onCancelTextEdit = vi.fn();
    const components = [
      component("HtmlComponent", {
        id: "front",
        x: 100,
        y: 100,
        width: 0,
        height: 0,
        zIndex: 2,
      }),
      component("TextComponent", {
        id: "plain",
        x: 350,
        y: 300,
        width: 0,
        height: 0,
        zIndex: undefined,
      }),
      component("AudioComponent", { id: "back", x: 220, y: 100, zIndex: 1 }),
    ];

    const canvasProps = {
      canvasContainerRef: { current: null },
      CANVAS_WIDTH: 500,
      CANVAS_HEIGHT: 400,
      stageScale: 1,
      onDrop,
      stageRef: { current: null },
      selectedId: "front",
      setSelectedId: setSelectedId as any,
      components,
      uploadedFiles: [],
      activeGuides: [{ orientation: "vertical", position: 100 } as any],
      onGuidesChange,
      onCommitTextEdit,
      onCancelTextEdit,
      onCanvasContextMenu,
      onRenderComponent: (
        comp: TrialComponent,
        _metrics: unknown,
        setActiveDomId: (id: string | null) => void,
      ) => (
        <button
          data-testid={`rendered-${comp.id}`}
          data-scene-node-id={comp.id}
          onClick={() => setActiveDomId(comp.id)}
        >
          {comp.id}
        </button>
      ),
      canvasStyles: {
        width: 500,
        height: 400,
        fullScreen: false,
        progressBar: false,
        backgroundColor: "#fafafa",
      },
    };
    const { rerender } = render(
      <KonvaCanvas {...canvasProps} editingTextId="front" />,
    );

    const canvasShell =
      screen.getByTestId("html-scene-layer").parentElement!.parentElement!;
    fireEvent.pointerLeave(canvasShell);
    fireEvent.pointerUp(canvasShell);
    fireEvent.pointerCancel(canvasShell);
    expect(onGuidesChange).toHaveBeenCalledWith([]);

    fireEvent.contextMenu(canvasShell, { clientX: 220, clientY: 100 });
    expect(onCanvasContextMenu).toHaveBeenLastCalledWith(
      expect.objectContaining({
        canvasX: 220,
        canvasY: 100,
        componentId: "back",
      }),
    );

    fireEvent.click(screen.getByTestId("html-scene-layer"));
    fireEvent.contextMenu(canvasShell, { clientX: 100, clientY: 100 });
    expect(onCanvasContextMenu).toHaveBeenLastCalledWith(
      expect.objectContaining({
        canvasX: 100,
        canvasY: 100,
        componentId: "front",
      }),
    );
    fireEvent.contextMenu(canvasShell, { clientX: 350, clientY: 300 });
    expect(onCanvasContextMenu).toHaveBeenLastCalledWith(
      expect.objectContaining({
        componentId: "plain",
      }),
    );
    fireEvent.contextMenu(canvasShell, { clientX: 490, clientY: 390 });
    expect(onCanvasContextMenu).toHaveBeenLastCalledWith(
      expect.objectContaining({
        componentId: null,
      }),
    );

    fireEvent.pointerDown(canvasShell);
    expect(screen.getByTestId("active-dom-id")).toHaveTextContent("none");
    fireEvent.click(screen.getByTestId("rendered-front"));
    expect(screen.getByTestId("active-dom-id")).toHaveTextContent("front");
    fireEvent.pointerDown(screen.getByTestId("rendered-front"));
    expect(screen.getByTestId("active-dom-id")).toHaveTextContent("front");
    fireEvent.pointerDown(canvasShell);
    expect(screen.getByTestId("active-dom-id")).toHaveTextContent("none");

    fireEvent.dragOver(canvasShell);
    fireEvent.drop(canvasShell, {
      dataTransfer: {
        getData: (key: string) =>
          key === "fileUrl" ? "file://image.png" : "ImageComponent",
      },
    });
    expect(onDrop).toHaveBeenCalledWith(
      expect.any(Object),
      "file://image.png",
      "ImageComponent",
    );
    fireEvent.drop(canvasShell, {
      dataTransfer: {
        getData: (key: string) => (key === "fileUrl" ? "" : "ImageComponent"),
      },
    });
    expect(onDrop).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByText("commit text"));
    fireEvent.click(screen.getByText("cancel text"));
    expect(onCommitTextEdit).toHaveBeenCalledWith("front", "Edited text");
    expect(onCancelTextEdit).toHaveBeenCalled();

    setSelectedId.mockClear();
    onGuidesChange.mockClear();
    fireEvent.click(screen.getByText("child stage click"));
    expect(setSelectedId).not.toHaveBeenCalled();
    expect(onGuidesChange).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText("clear stage"));
    expect(setSelectedId).toHaveBeenCalledWith(null);
    expect(onGuidesChange).toHaveBeenCalledWith([]);

    rerender(<KonvaCanvas {...canvasProps} editingTextId="missing" />);
    fireEvent.click(screen.getByText("commit text"));
    expect(onCommitTextEdit).toHaveBeenCalledTimes(1);
  });
});

describe("coverage trial designer EditorHitBox", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("handles selection, drag, double-click activation and transforms", async () => {
    const onSelect = vi.fn();
    const onChange = vi.fn();
    const onActivateDom = vi.fn();
    const onGuidesChange = vi.fn();

    render(
      <EditorHitBox
        shapeProps={component("SurveyComponent", {
          id: "survey-a",
          config: {
            min_width: { source: "typed", value: "300px" },
          },
        })}
        canvasStyles={{
          width: 500,
          height: 400,
          fullScreen: false,
          progressBar: false,
          backgroundColor: "#fff",
        }}
        isSelected
        onSelect={onSelect}
        onChange={onChange}
        onActivateDom={onActivateDom}
        onGuidesChange={onGuidesChange}
      />,
    );

    fireEvent.click(screen.getByText("select group"));
    fireEvent.click(screen.getByText("double group"));
    fireEvent.click(screen.getByText("drag move"));
    fireEvent.click(screen.getByText("drag end"));
    fireEvent.click(screen.getByText("transform end"));
    fireEvent.click(screen.getByText("bound small"));
    fireEvent.click(screen.getByText("bound large"));

    await waitFor(() => {
      expect(onSelect).toHaveBeenCalled();
      expect(onActivateDom).toHaveBeenCalled();
      expect(onGuidesChange).toHaveBeenCalledWith([]);
      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({
          x: expect.any(Number),
          y: expect.any(Number),
        }),
      );
      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({
          config: expect.objectContaining({
            min_width: expect.objectContaining({
              source: "typed",
            }),
          }),
        }),
      );
    });
  });

  it("returns null when the component is not part of the html scene", () => {
    const { container } = render(
      <EditorHitBox
        shapeProps={component("AudioComponent")}
        isSelected={false}
        onSelect={vi.fn()}
        onChange={vi.fn()}
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("flushes throttled drag moves and cancels pending frames on unmount", () => {
    const callbacks: FrameRequestCallback[] = [];
    const cancelAnimationFrame = vi.fn();
    vi.stubGlobal(
      "requestAnimationFrame",
      vi.fn((callback: FrameRequestCallback) => {
        callbacks.push(callback);
        return callbacks.length;
      }),
    );
    vi.stubGlobal("cancelAnimationFrame", cancelAnimationFrame);

    const onChange = vi.fn();
    const { unmount } = render(
      <EditorHitBox
        shapeProps={component("SurveyComponent", { id: "drag-frame" })}
        isSelected
        onSelect={vi.fn()}
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByText("drag move"));
    fireEvent.click(screen.getByText("drag move"));

    expect(callbacks).toHaveLength(1);
    callbacks[0](0);
    callbacks[0](1);

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ __transient: true }),
    );

    fireEvent.click(screen.getByText("drag move"));
    unmount();

    expect(cancelAnimationFrame).toHaveBeenCalledWith(2);
  });

  it("starts text editing on text component double click", () => {
    const onEditText = vi.fn();
    const onActivateDom = vi.fn();

    render(
      <EditorHitBox
        shapeProps={component("TextComponent", {
          id: "text-hitbox",
          config: {
            font_size: { source: "typed", value: "bad-size" },
          },
        })}
        isSelected
        onSelect={vi.fn()}
        onChange={vi.fn()}
        onEditText={onEditText}
        onActivateDom={onActivateDom}
      />,
    );

    fireEvent.click(screen.getByText("double group"));

    expect(onEditText).toHaveBeenCalled();
    expect(onActivateDom).not.toHaveBeenCalled();
  });

  it.each([
    [
      "SketchpadComponent",
      { config: { canvas_shape: { source: "typed", value: "circle" } } },
      "canvas_diameter",
    ],
    [
      "SketchpadComponent",
      { id: "sketch-rect", config: { canvas_shape: { source: "typed", value: "rectangle" } } },
      "canvas_width",
    ],
    ["HtmlComponent", {}, '"width":0'],
    ["FileUploadResponseComponent", {}, '"height":0'],
    [
      "InputResponseComponent",
      { config: { input_font_size: { source: "typed", value: "bad-size" } } },
      "inputFontSize",
    ],
    [
      "TextComponent",
      { config: { font_size: { source: "typed", value: "bad-size" } } },
      "textFontSize",
    ],
    [
      "ButtonResponseComponent",
      { config: { button_font_size: { source: "typed", value: "bad-size" } } },
      "buttonFontSize",
    ],
    ["SliderResponseComponent", {}, '"width"'],
  ] as const)("transforms %s hit boxes through type-specific sizing", async (type, overrides, expectedKey) => {
    const onChange = vi.fn();

    render(
      <EditorHitBox
        shapeProps={component(type as TrialComponent["type"], {
          id: `${type}-transform`,
          ...overrides,
        })}
        isSelected
        onSelect={vi.fn()}
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByText("transform end"));

    await waitFor(() => {
      expect(JSON.stringify(onChange.mock.calls.at(-1)?.[0])).toContain(
        expectedKey,
      );
    });
  });

  it("renders unselected hit boxes without transformer decoration", () => {
    render(
      <EditorHitBox
        shapeProps={component("SurveyComponent", { id: "unselected-hitbox" })}
        isSelected={false}
        onSelect={vi.fn()}
        onChange={vi.fn()}
      />,
    );

    expect(screen.queryByTestId("konva-transformer")).not.toBeInTheDocument();
    expect(screen.getByText("select group")).toBeInTheDocument();
  });
});
