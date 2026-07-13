import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import TrialDesigner from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner";

const wrapperMocks = vi.hoisted(() => ({
  handleDrop: vi.fn(),
  renderComponent: vi.fn(({ comp }: any) => (
    <div data-testid="render-component">{comp.id}</div>
  )),
  initialComponents: undefined as any[] | undefined,
  initialSelectedId: undefined as string | null | undefined,
}));

vi.mock("konva", () => ({ default: {} }));

vi.mock(
  "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/ParameterMapper/Modal",
  () => ({
    default: ({ isOpen, children }: any) =>
      isOpen ? <div data-testid="designer-modal">{children}</div> : null,
  }),
);

vi.mock(
  "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/hooks/useComponentMetadata",
  () => ({
    useComponentMetadata: () => ({
      loading: false,
      metadata: {
        parameters: {
          text: { pretty_name: "Text", type: "string" },
        },
      },
    }),
  }),
);

vi.mock(
  "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/useConfigFromComponents",
  () => ({
    default: () => (components: any[]) => ({
      componentCount: components.length,
      ids: components.map((component) => component.id),
    }),
  }),
);

vi.mock(
  "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/renderComponent",
  () => ({
    default: wrapperMocks.renderComponent,
  }),
);

vi.mock(
  "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/useLoadComponents",
  async () => {
    const React = await vi.importActual<typeof import("react")>("react");
    return {
      default: ({ isOpen, setComponents, setSelectedId }: any) => {
        React.useEffect(() => {
          if (!isOpen) return;
          const loadedComponents = wrapperMocks.initialComponents ?? [
            {
              id: "text-a",
              type: "TextComponent",
              x: 100,
              y: 100,
              width: 120,
              height: 40,
              config: {
                text: { source: "typed", value: "Loaded text" },
                coordinates: { source: "typed", value: { x: 0, y: 0 } },
              },
            },
          ];
          setComponents(loadedComponents);
          setSelectedId(
            wrapperMocks.initialSelectedId !== undefined
              ? wrapperMocks.initialSelectedId
              : loadedComponents[0]?.id ?? null,
          );
        }, [isOpen, setComponents, setSelectedId]);
      },
    };
  },
);

vi.mock(
  "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/useHandleDrop",
  () => ({
    default: wrapperMocks.handleDrop,
  }),
);

vi.mock(
  "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/useHandleResize",
  () => ({
    default: vi.fn(),
  }),
);

vi.mock(
  "../../pages/ExperimentBuilder/hooks/useCanvasStyles",
  async () => {
    const React = await vi.importActual<typeof import("react")>("react");
    return {
      default: () => {
        const [canvasStyles, setCanvasStyles] = React.useState({
          backgroundColor: "#ffffff",
          width: 500,
          height: 400,
          fullScreen: false,
          progressBar: false,
        });
        return { canvasStyles, setCanvasStyles };
      },
    };
  },
);

vi.mock(
  "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/ComponentSidebar",
  () => ({
    default: ({
      components,
      setComponents,
      getDefaultConfig,
      setSelectedId,
      setSelectedIds,
      setShowLeftPanel,
      toJsPsychCoords,
    }: any) => (
      <div data-testid="component-sidebar">
        <div>sidebar components:{components.length}</div>
        <div>coords:{JSON.stringify(toJsPsychCoords(250, 200))}</div>
        <button
          onClick={() => {
            const next = {
              id: "button-a",
              type: "ButtonResponseComponent",
              x: 180,
              y: 140,
              width: 160,
              height: 48,
              config: getDefaultConfig("ButtonResponseComponent"),
            };
            setComponents((prev: any[]) => [...prev, next]);
            setSelectedId("button-a");
          }}
        >
          sidebar add component
        </button>
        <button onClick={() => setComponents(components)}>
          sidebar noop components
        </button>
        <button
          onClick={() =>
            setComponents([
              ...components,
              {
                id: "direct-keyboard",
                type: "KeyboardResponseComponent",
                x: 210,
                y: 180,
                width: 140,
                height: 42,
                config: getDefaultConfig("KeyboardResponseComponent"),
              },
            ])
          }
        >
          sidebar direct set
        </button>
        <button
          onClick={() => {
            const componentTypes = [
              "ButtonResponseComponent",
              "TextComponent",
              "HtmlComponent",
              "ImageComponent",
              "SliderResponseComponent",
              "KeyboardResponseComponent",
              "InputResponseComponent",
              "FileUploadResponseComponent",
              "AudioComponent",
              "VideoComponent",
              "SketchpadComponent",
              "SurveyComponent",
              "ClickResponseComponent",
              "UnknownComponent",
            ];

            setComponents(
              componentTypes.map((type, index) => ({
                id: `default-${type}`,
                type,
                x: 40 + index,
                y: 80 + index,
                width: 0,
                height: 0,
                config: getDefaultConfig(type),
              })),
            );
            setSelectedIds(["default-ButtonResponseComponent"]);
          }}
        >
          sidebar load defaults
        </button>
        <button onClick={() => setSelectedIds(components.map((c: any) => c.id))}>
          sidebar select all
        </button>
        <button onClick={() => setSelectedIds(["missing-id"])}>
          sidebar select ghost
        </button>
        <button onClick={() => setComponents([])}>sidebar clear components</button>
        <button onClick={() => setShowLeftPanel(false)}>
          sidebar hide left
        </button>
      </div>
    ),
  }),
);

vi.mock(
  "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/CanvasStylesBar",
  () => ({
    default: ({
      canvasStyles,
      setCanvasStyles,
      isDemoRunning,
      onRunDemo,
      onStopDemo,
    }: any) => (
      <div data-testid="canvas-styles-bar">
        <span>canvas width:{canvasStyles.width}</span>
        <span>demo:{String(isDemoRunning)}</span>
        <button
          onClick={() =>
            setCanvasStyles((prev: any) => ({
              ...prev,
              width: prev.width + 100,
              height: prev.height + 50,
            }))
          }
        >
          resize canvas
        </button>
        <button
          onClick={() =>
            setCanvasStyles((prev: any) => ({
              ...prev,
              height: prev.height + 50,
            }))
          }
        >
          resize canvas height
        </button>
        <button onClick={onRunDemo}>run demo</button>
        <button onClick={onStopDemo}>stop demo</button>
      </div>
    ),
  }),
);

vi.mock(
  "../../pages/ExperimentBuilder/components/ExperimentPreview",
  () => ({
    default: ({ autoStart }: any) => (
      <div data-testid="experiment-preview">preview:{String(autoStart)}</div>
    ),
  }),
);

vi.mock(
  "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/KonvaCanvas",
  () => ({
    default: ({
      canvasContainerRef,
      components,
      selectedId,
      setSelectedId,
      editingTextId,
      onDrop,
      onRenderComponent,
      onCanvasContextMenu,
      onCommitTextEdit,
      onCancelTextEdit,
      onGuidesChange,
    }: any) => (
      <div
        data-testid="konva-canvas"
        ref={(node) => {
          if (!node) return;
          Object.defineProperty(node, "clientWidth", {
            configurable: true,
            value: 800,
          });
          Object.defineProperty(node, "clientHeight", {
            configurable: true,
            value: 600,
          });
          canvasContainerRef.current = node;
        }}
      >
        <div>canvas selected:{selectedId ?? "none"}</div>
        <div>editing:{editingTextId ?? "none"}</div>
        <div>canvas components:{components.length}</div>
        <button
          onClick={() => setSelectedId((prev: string | null) => (prev ? null : "text-a"))}
        >
          canvas functional select
        </button>
        <button
          onClick={() =>
            components[0] &&
            onRenderComponent(components[0], {}, vi.fn(() => undefined))
          }
        >
          canvas render component
        </button>
        <button
          onClick={() =>
            onDrop({ preventDefault: vi.fn() }, "file://drop.png", "ImageComponent")
          }
        >
          canvas drop
        </button>
        <button
          onClick={() =>
            onCanvasContextMenu({
              clientX: 20,
              clientY: 30,
              canvasX: 120,
              canvasY: 140,
              componentId: components[0]?.id ?? null,
            })
          }
        >
          canvas context
        </button>
        <button onClick={() => onCommitTextEdit("text-a", "Edited text")}>
          canvas commit text
        </button>
        <button onClick={onCancelTextEdit}>canvas cancel text</button>
        <button
          onClick={() =>
            onGuidesChange([{ orientation: "horizontal", position: 200 }])
          }
        >
          canvas guide
        </button>
      </div>
    ),
  }),
);

vi.mock(
  "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/KonvaParameterMapper",
  () => ({
    default: ({
      selectedId,
      selectedComponent,
      fromJsPsychCoords,
      setComponents,
      onRecordHistory,
      setShowRightPanel,
    }: any) => (
        <div data-testid="konva-parameter-mapper">
        <div>mapper selected:{selectedId ?? "none"}</div>
        <div>mapper component:{selectedComponent?.id ?? "none"}</div>
        <div>mapper coords:{JSON.stringify(fromJsPsychCoords({ x: 10, y: -20 }))}</div>
        <button
          onClick={() => {
            onRecordHistory();
            setComponents((prev: any[]) =>
              prev.map((component) =>
                component.id === selectedId
                  ? { ...component, width: component.width + 10 }
                  : component,
              ),
            );
          }}
        >
          mapper mutate
        </button>
        <button onClick={() => setShowRightPanel(false)}>
          mapper hide right
        </button>
      </div>
    ),
  }),
);

vi.mock(
  "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/CanvasContextMenu",
  () => ({
    default: ({
      state,
      canCopy,
      canPaste,
      canUndo,
      hasComponents,
      onCopy,
      onCut,
      onPaste,
      onDelete,
      onSelectAll,
      onUndo,
      onClose,
    }: any) => (
      <div data-testid="canvas-context-menu">
        <div>menu:{state ? `${state.componentId ?? "canvas"}` : "closed"}</div>
        <div>can-copy:{String(canCopy)}</div>
        <div>can-paste:{String(canPaste)}</div>
        <div>can-undo:{String(canUndo)}</div>
        <div>has-components:{String(hasComponents)}</div>
        <button onClick={onCopy}>menu copy</button>
        <button onClick={onCut}>menu cut</button>
        <button onClick={onPaste}>menu paste</button>
        <button onClick={onDelete}>menu delete</button>
        <button onClick={onSelectAll}>menu select all</button>
        <button onClick={onUndo}>menu undo</button>
        <button onClick={onClose}>menu close</button>
      </div>
    ),
  }),
);

vi.mock(
  "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/ActionButtons",
  () => ({
    default: ({
      onClose,
      onSave,
      onAutoSave,
      generateConfigFromComponents,
      components,
    }: any) => (
      <div data-testid="action-buttons">
        <button onClick={() => onSave(generateConfigFromComponents(components))}>
          action save
        </button>
        <button
          onClick={() => onAutoSave?.(generateConfigFromComponents(components))}
        >
          action autosave
        </button>
        <button onClick={onClose}>action close</button>
      </div>
    ),
  }),
);

beforeEach(() => {
  vi.clearAllMocks();
  wrapperMocks.initialComponents = undefined;
  wrapperMocks.initialSelectedId = undefined;
});

describe("coverage TrialDesigner wrapper", () => {
  it("exercises designer selection, clipboard, context menu, demo and save flows", async () => {
    const onClose = vi.fn();
    const onSave = vi.fn();
    const onAutoSave = vi.fn();

    render(
      <TrialDesigner
        isOpen
        onClose={onClose}
        onSave={onSave}
        onAutoSave={onAutoSave}
        isAutoSaving={false}
        parameters={[]}
        columnMapping={{}}
        csvColumns={["stimulus"]}
        pluginName="plugin-dynamic"
        uploadedFiles={[]}
      />,
    );

    await screen.findByText("sidebar components:1");

    fireEvent.click(screen.getByText("canvas render component"));
    expect(wrapperMocks.renderComponent).toHaveBeenCalledWith(
      expect.objectContaining({
        comp: expect.objectContaining({ id: "text-a" }),
      }),
    );

    fireEvent.click(screen.getByText("sidebar add component"));
    await screen.findByText("sidebar components:2");
    fireEvent.click(screen.getByText("sidebar select all"));
    fireEvent.keyDown(document, { key: "c", ctrlKey: true });
    fireEvent.click(screen.getByText("canvas context"));
    expect(screen.getByTestId("canvas-context-menu")).toHaveTextContent(
      "menu:text-a",
    );

    fireEvent.click(screen.getByText("menu paste"));
    fireEvent.click(screen.getByText("canvas context"));
    fireEvent.click(screen.getByText("menu copy"));
    fireEvent.click(screen.getByText("menu paste"));
    fireEvent.click(screen.getByText("menu select all"));
    fireEvent.click(screen.getByText("menu cut"));
    fireEvent.click(screen.getByText("menu undo"));
    fireEvent.click(screen.getByText("menu close"));

    fireEvent.click(screen.getByText("canvas drop"));
    expect(wrapperMocks.handleDrop).toHaveBeenCalledWith(
      expect.objectContaining({
        fileUrl: "file://drop.png",
        type: "ImageComponent",
      }),
    );

    fireEvent.click(screen.getByText("mapper mutate"));
    fireEvent.click(screen.getByText("canvas commit text"));
    fireEvent.click(screen.getByText("canvas cancel text"));
    fireEvent.click(screen.getByText("canvas guide"));

    fireEvent.click(screen.getByText("mapper hide right"));
    fireEvent.click(screen.getByText("‹"));
    fireEvent.click(screen.getByText("sidebar hide left"));

    fireEvent.click(screen.getByText("resize canvas"));
    await waitFor(() => {
      expect(onAutoSave).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByText("run demo"));
    expect(screen.getByTestId("experiment-preview")).toHaveTextContent(
      "preview:true",
    );
    fireEvent.click(screen.getByText("stop demo"));

    fireEvent.keyDown(document, { key: "a", ctrlKey: true });
    fireEvent.keyDown(document, { key: "c", ctrlKey: true });
    fireEvent.keyDown(document, { key: "v", ctrlKey: true });
    fireEvent.keyDown(document, { key: "z", ctrlKey: true });
    fireEvent.keyDown(document, { key: "x", ctrlKey: true });

    fireEvent.click(screen.getByText("action autosave"));
    fireEvent.click(screen.getByText("action save"));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        componentCount: expect.any(Number),
      }),
    );

    fireEvent.click(screen.getByText("canvas context"));
    fireEvent.keyDown(document, { key: "Escape" });
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();

    fireEvent.click(screen.getByText("action close"));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("keeps closed-modal effects inert", () => {
    const onClose = vi.fn();

    render(
      <TrialDesigner
        isOpen={false}
        onClose={onClose}
        onSave={vi.fn()}
        onAutoSave={vi.fn()}
        isAutoSaving={false}
        parameters={[]}
        columnMapping={{}}
        csvColumns={[]}
        pluginName="plugin-dynamic"
        uploadedFiles={[]}
      />,
    );

    expect(screen.queryByTestId("designer-modal")).not.toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).not.toHaveBeenCalled();
  });

  it("covers empty and stale selection command exits", async () => {
    wrapperMocks.initialComponents = [];

    const onAutoSave = vi.fn();
    render(
      <TrialDesigner
        isOpen
        onClose={vi.fn()}
        onSave={vi.fn()}
        onAutoSave={onAutoSave}
        isAutoSaving={false}
        parameters={[]}
        columnMapping={{}}
        csvColumns={[]}
        pluginName="plugin-dynamic"
        uploadedFiles={[]}
      />,
    );

    await screen.findByText("sidebar components:0");

    fireEvent.keyDown(document, { key: "c", ctrlKey: true });
    fireEvent.keyDown(document, { key: "v", ctrlKey: true });
    fireEvent.keyDown(document, { key: "z", ctrlKey: true });
    fireEvent.keyDown(document, { key: "a", ctrlKey: true });
    fireEvent.keyDown(document, { key: "y", ctrlKey: true });

    fireEvent.click(screen.getByText("resize canvas"));
    fireEvent.click(screen.getByText("canvas context"));
    expect(screen.getByTestId("canvas-context-menu")).toHaveTextContent(
      "menu:canvas",
    );

    fireEvent.click(screen.getByText("menu copy"));
    fireEvent.click(screen.getByText("menu cut"));
    fireEvent.click(screen.getByText("menu paste"));
    fireEvent.click(screen.getByText("menu delete"));
    fireEvent.click(screen.getByText("menu select all"));
    fireEvent.click(screen.getByText("menu undo"));

    fireEvent.click(screen.getByText("sidebar select ghost"));
    fireEvent.click(screen.getByText("menu copy"));
    fireEvent.click(screen.getByText("menu delete"));

    const input = document.createElement("input");
    document.body.appendChild(input);
    fireEvent.keyDown(input, { key: "c", ctrlKey: true });

    const editable = document.createElement("div");
    editable.contentEditable = "true";
    Object.defineProperty(editable, "isContentEditable", {
      configurable: true,
      value: true,
    });
    document.body.appendChild(editable);
    fireEvent.keyDown(editable, { key: "c", ctrlKey: true });

    fireEvent.keyDown(document, { key: "c" });
    fireEvent.keyDown(document, { key: "c", ctrlKey: true, altKey: true });

    input.remove();
    editable.remove();
    expect(onAutoSave).not.toHaveBeenCalled();
  });

  it("covers direct component setters, default configs and optional autosave", async () => {
    render(
      <TrialDesigner
        isOpen
        onClose={vi.fn()}
        onSave={vi.fn()}
        isAutoSaving={false}
        parameters={[]}
        columnMapping={{}}
        csvColumns={[]}
        pluginName="plugin-dynamic"
        uploadedFiles={[]}
      />,
    );

    await screen.findByText("sidebar components:1");

    fireEvent.click(screen.getByText("resize canvas height"));
    fireEvent.click(screen.getByText("canvas commit text"));

    fireEvent.click(screen.getByText("sidebar noop components"));
    fireEvent.click(screen.getByText("sidebar direct set"));
    await screen.findByText("sidebar components:2");

    fireEvent.click(screen.getByText("sidebar load defaults"));
    await screen.findByText("sidebar components:14");
    fireEvent.click(screen.getByText("sidebar clear components"));
    await screen.findByText("sidebar components:0");
  });

  it("allows drop handlers to exercise direct and no-op history setters", async () => {
    render(
      <TrialDesigner
        isOpen
        onClose={vi.fn()}
        onSave={vi.fn()}
        onAutoSave={vi.fn()}
        isAutoSaving={false}
        parameters={[]}
        columnMapping={{}}
        csvColumns={[]}
        pluginName="plugin-dynamic"
        uploadedFiles={[]}
      />,
    );

    await screen.findByText("sidebar components:1");

    fireEvent.keyDown(document, { key: "x", ctrlKey: true });
    await screen.findByText("sidebar components:0");
    fireEvent.keyDown(document, { key: "z", ctrlKey: true });
    await screen.findByText("sidebar components:1");

    wrapperMocks.handleDrop.mockImplementationOnce(({ components, setComponents }: any) => {
      setComponents(components);
    });
    fireEvent.click(screen.getByText("canvas drop"));
    expect(screen.getByText("sidebar components:1")).toBeInTheDocument();

    wrapperMocks.handleDrop.mockImplementationOnce(({ components, setComponents }: any) => {
      setComponents([
        ...components,
        {
          id: "drop-text",
          type: "TextComponent",
          x: 300,
          y: 220,
          width: 100,
          height: 40,
          config: {},
        },
      ]);
    });
    fireEvent.click(screen.getByText("canvas drop"));
    await screen.findByText("sidebar components:2");

    wrapperMocks.handleDrop.mockImplementationOnce(({ setComponents }: any) => {
      setComponents((prev: any[]) => [
        ...prev,
        {
          id: "drop-functional",
          type: "TextComponent",
          x: 320,
          y: 240,
          width: 100,
          height: 40,
          config: {},
        },
      ]);
    });
    fireEvent.click(screen.getByText("canvas drop"));
    await screen.findByText("sidebar components:3");
  });

  it("guards context menu while editing and clears stale text editing", async () => {
    const onClose = vi.fn();

    render(
      <TrialDesigner
        isOpen
        onClose={onClose}
        onSave={vi.fn()}
        onAutoSave={vi.fn()}
        isAutoSaving={false}
        parameters={[]}
        columnMapping={{}}
        csvColumns={[]}
        pluginName="plugin-dynamic"
        uploadedFiles={[]}
      />,
    );

    await screen.findByText("sidebar components:1");
    fireEvent.click(screen.getByText("canvas render component"));

    const renderArgs = wrapperMocks.renderComponent.mock.calls.at(-1)?.[0];
    expect(
      renderArgs.onSnap({
        id: "moving",
        x: 250,
        y: 200,
        width: 10,
        height: 10,
      }),
    ).toEqual(expect.objectContaining({ guides: expect.any(Array) }));

    act(() => {
      renderArgs.onEditTextStart("text-a");
    });
    await screen.findByText("editing:text-a");

    fireEvent.click(screen.getByText("canvas context"));
    expect(screen.getByTestId("canvas-context-menu")).toHaveTextContent(
      "menu:closed",
    );

    fireEvent.keyDown(document, { key: "Escape" });
    await screen.findByText("editing:none");
    expect(onClose).not.toHaveBeenCalled();

    act(() => {
      renderArgs.onEditTextStart("text-a");
    });
    await screen.findByText("editing:text-a");
    fireEvent.click(screen.getByText("canvas functional select"));
    await screen.findByText("editing:none");

    act(() => {
      renderArgs.onEditTextStart("missing-text");
    });
    await screen.findByText("editing:none");
  });
});
