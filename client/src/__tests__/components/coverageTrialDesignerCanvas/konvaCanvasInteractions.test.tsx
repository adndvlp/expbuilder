import {
  KonvaCanvas,
  TrialComponent,
  component,
  describe,
  expect,
  fireEvent,
  it,
  render,
  screen,
  vi,
} from "./testHarness";

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
