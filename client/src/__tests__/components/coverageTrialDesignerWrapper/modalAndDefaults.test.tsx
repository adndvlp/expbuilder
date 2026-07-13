import {
  TrialDesigner,
  describe,
  expect,
  fireEvent,
  it,
  render,
  screen,
  vi,
} from "./testHarness";

describe("coverage TrialDesigner wrapper", () => {
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
});
