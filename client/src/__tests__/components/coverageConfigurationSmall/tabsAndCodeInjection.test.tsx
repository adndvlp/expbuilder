import {
  TabContent,
  TrialCodeInjection,
  describe,
  expect,
  fireEvent,
  it,
  render,
  screen,
  vi,
  waitFor,
} from "./testHarness";

describe("coverage configuration: tab and code wrappers", () => {
  it("opens trial code injection modal and forwards tab edits", () => {
    const onSave = vi.fn();
    render(
      <TrialCodeInjection
        tabs={[
          {
            key: "on_start",
            label: "On Start",
            hint: "Runs before the trial",
            fieldKey: "custom_on_start",
            customValue: "return 1;",
            computePreview: (code) => `function(){${code}}`,
            isBuilderManaged: true,
          },
        ]}
        onSave={onSave}
      />,
    );

    fireEvent.click(screen.getByText("Code Component"));
    expect(
      screen.getByRole("dialog", { name: "Trial Code Component" }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByText("On Start"));
    expect(onSave).toHaveBeenCalledWith("custom_on_start", "return 1; updated");
    fireEvent.click(screen.getByText("Close modal"));
    expect(
      screen.queryByRole("dialog", { name: "Trial Code Component" }),
    ).not.toBeInTheDocument();
  });

  it("switches dynamic plugin tabs and forwards designer saves", async () => {
    const saveField = vi.fn(async () => {});
    const saveColumnMapping = vi.fn(async () => {});
    const setColumnMapping = vi.fn();
    render(
      <TabContent
        pluginName="plugin-dynamic"
        parameters={
          [
            { key: "components", label: "Components", type: "array" },
            { key: "difficulty", label: "Difficulty", type: "string" },
          ] as any
        }
        columnMapping={{}}
        csvColumns={["condition"]}
        uploadedFiles={[]}
        saveIndicator
        savingField="columnMapping"
        saveColumnMapping={saveColumnMapping}
        setColumnMapping={setColumnMapping}
        saveField={saveField}
      />,
    );

    fireEvent.click(screen.getByText("Open Visual Designer"));
    fireEvent.click(screen.getByText("Auto save designer"));
    expect(setColumnMapping).toHaveBeenCalledWith({ components: [] });
    expect(saveField).toHaveBeenCalledWith("columnMapping", { components: [] });

    fireEvent.click(screen.getByText("Save designer"));
    expect(setColumnMapping).toHaveBeenCalledWith({ saved: true });
    expect(saveField).toHaveBeenCalledWith("columnMapping", { saved: true });

    fireEvent.click(screen.getByText("General Settings"));
    expect(screen.getByTestId("parameter-mapper")).toHaveTextContent(
      "difficulty",
    );
    fireEvent.click(screen.getByText("Save mapper"));
    await waitFor(() =>
      expect(saveColumnMapping).toHaveBeenCalledWith("difficulty", "hard"),
    );
  });
});
