import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import TabContent from "../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TabContent";

vi.mock(
  "../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner",
  () => ({
    default: ({ isOpen, isAutoSaving, onSave, onAutoSave, onClose }: any) =>
      isOpen ? (
        <div data-testid="mock-trial-designer">
          <span>autosaving:{String(isAutoSaving)}</span>
          <button type="button" onClick={() => onAutoSave({ auto: true })}>
            auto designer
          </button>
          <button type="button" onClick={() => onSave({ saved: true })}>
            save designer
          </button>
          <button type="button" onClick={onClose}>
            close designer
          </button>
        </div>
      ) : null,
  }),
);

vi.mock(
  "../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/ParameterMapper",
  () => ({
    default: ({ parameters, onSave }: any) => (
      <div data-testid="mock-parameter-mapper">
        {parameters.map((param: any) => param.key).join(",")}
        <button type="button" onClick={() => onSave("difficulty", "easy")}>
          save general
        </button>
      </div>
    ),
  }),
);

describe("coverage core branches: TabContent", () => {
  beforeEach(() => vi.clearAllMocks());

  it("switches tabs, hover states and designer callbacks", () => {
    const saveField = vi.fn(async () => {});
    const saveColumnMapping = vi.fn(async () => {});
    const setColumnMapping = vi.fn();

    render(
      <TabContent
        pluginName="plugin-dynamic"
        parameters={
          [
            { key: "components", label: "Components", type: "array" },
            { key: "response_components", label: "Responses", type: "array" },
            { key: "difficulty", label: "Difficulty", type: "string" },
          ] as any
        }
        columnMapping={{}}
        csvColumns={["condition"]}
        uploadedFiles={[]}
        saveIndicator={false}
        savingField={null}
        saveColumnMapping={saveColumnMapping}
        setColumnMapping={setColumnMapping}
        saveField={saveField}
      />,
    );

    const componentsTab = screen.getByText("Components");
    const generalTab = screen.getByText("General Settings");
    fireEvent.mouseOver(componentsTab);
    expect(componentsTab.style.backgroundColor).toBe("");
    fireEvent.mouseOut(componentsTab);
    expect(componentsTab.style.backgroundColor).toBe("");
    fireEvent.mouseOver(generalTab);
    expect(generalTab.style.backgroundColor).toBe("rgba(61, 146, 180, 0.1)");
    fireEvent.mouseOut(generalTab);
    expect(generalTab.style.backgroundColor).toBe("transparent");

    const openDesigner = screen.getByText("Open Visual Designer");
    fireEvent.mouseOver(openDesigner);
    expect(openDesigner).toHaveStyle({ transform: "translateY(-2px)" });
    fireEvent.mouseOut(openDesigner);
    expect(openDesigner).toHaveStyle({ transform: "translateY(0)" });
    fireEvent.click(openDesigner);

    expect(screen.getByText("autosaving:false")).toBeInTheDocument();
    fireEvent.click(screen.getByText("auto designer"));
    expect(saveField).toHaveBeenCalledWith("columnMapping", { auto: true });
    fireEvent.click(screen.getByText("save designer"));
    expect(setColumnMapping).toHaveBeenCalledWith({ saved: true });
    expect(saveField).toHaveBeenCalledWith("columnMapping", { saved: true });
    fireEvent.click(openDesigner);
    fireEvent.click(screen.getByText("close designer"));
    expect(screen.queryByTestId("mock-trial-designer")).not.toBeInTheDocument();

    fireEvent.click(generalTab);
    expect(screen.getByTestId("mock-parameter-mapper")).toHaveTextContent(
      "difficulty",
    );
    fireEvent.mouseOver(generalTab);
    expect(generalTab.style.backgroundColor).toBe("");
    fireEvent.mouseOut(generalTab);
    expect(generalTab.style.backgroundColor).toBe("");
    fireEvent.mouseOver(componentsTab);
    expect(componentsTab.style.backgroundColor).toBe("rgba(61, 146, 180, 0.1)");
    fireEvent.mouseOut(componentsTab);
    expect(componentsTab.style.backgroundColor).toBe("transparent");
    fireEvent.click(screen.getByText("save general"));
    expect(saveColumnMapping).toHaveBeenCalledWith("difficulty", "easy");
    fireEvent.click(componentsTab);
    expect(screen.getByText("Open Visual Designer")).toBeInTheDocument();
  });

  it("passes autosaving state to the visual designer", () => {
    render(
      <TabContent
        pluginName="plugin-dynamic"
        parameters={[]}
        columnMapping={{}}
        csvColumns={[]}
        uploadedFiles={[]}
        saveIndicator
        savingField="columnMapping"
        saveColumnMapping={vi.fn(async () => {})}
        setColumnMapping={vi.fn()}
        saveField={vi.fn(async () => {})}
      />,
    );

    fireEvent.click(screen.getByText("Open Visual Designer"));
    expect(screen.getByText("autosaving:true")).toBeInTheDocument();
  });
});
