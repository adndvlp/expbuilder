import {
  TrialDesigner,
  act,
  describe,
  expect,
  fireEvent,
  it,
  render,
  screen,
  vi,
  wrapperMocks,
} from "./testHarness";

describe("coverage TrialDesigner wrapper", () => {
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

    wrapperMocks.handleDrop.mockImplementationOnce(
      ({ components, setComponents }: any) => {
        setComponents(components);
      },
    );
    fireEvent.click(screen.getByText("canvas drop"));
    expect(screen.getByText("sidebar components:1")).toBeInTheDocument();

    wrapperMocks.handleDrop.mockImplementationOnce(
      ({ components, setComponents }: any) => {
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
      },
    );
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
