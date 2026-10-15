import {
  TrialDesigner,
  expect,
  fireEvent,
  it,
  render,
  screen,
  vi,
} from "./testHarness";

it("shows the resource meter in Konva and removes it while Run Demo is open", async () => {
  render(
    <TrialDesigner
      isOpen
      onClose={vi.fn()}
      onSave={vi.fn()}
      parameters={[]}
      columnMapping={{}}
      csvColumns={[]}
      pluginName="plugin-dynamic"
      uploadedFiles={[]}
    />,
  );
  await screen.findByText("Trial memory");
  expect(screen.getByTestId("konva-canvas")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "run demo" }));
  expect(screen.queryByText("Trial memory")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "stop demo" }));
  expect(screen.getByText("Trial memory")).toBeInTheDocument();
});
