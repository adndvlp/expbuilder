import {
  TrialDesigner,
  describe,
  expect,
  fireEvent,
  it,
  render,
  screen,
  vi,
  waitFor,
  wrapperMocks,
} from "./testHarness";

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
});
