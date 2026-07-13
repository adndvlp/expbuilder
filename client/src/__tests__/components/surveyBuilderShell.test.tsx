import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import SurveyBuilder from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/SurveyEditor";

vi.mock(
  "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/SurveyEditor/Builder",
  () => ({
    default: ({ surveyJson, onChange, uploadedFiles }: any) => (
      <div data-testid="survey-builder">
        <span>{`builder:${surveyJson.title}`}</span>
        <span>{`files:${uploadedFiles.length}`}</span>
        <button
          type="button"
          onClick={() =>
            onChange({
              ...surveyJson,
              title: "Changed survey",
              elements: [{ type: "text", name: "q1" }],
            })
          }
        >
          Change survey
        </button>
      </div>
    ),
  }),
);

vi.mock(
  "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/SurveyEditor/Preview",
  () => ({
    default: ({ surveyJson }: any) => (
      <div data-testid="survey-preview">{JSON.stringify(surveyJson)}</div>
    ),
  }),
);

describe("SurveyBuilder shell", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("does not render when closed", () => {
    render(
      <SurveyBuilder
        isOpen={false}
        onClose={vi.fn()}
        onChange={vi.fn()}
        title="Closed Survey"
      />,
    );

    expect(screen.queryByText("Closed Survey")).not.toBeInTheDocument();
  });

  it("parses string values, wires uploaded files and saves the current survey JSON", () => {
    const onClose = vi.fn();
    const onChange = vi.fn();

    render(
      <SurveyBuilder
        isOpen
        onClose={onClose}
        onChange={onChange}
        title="Edit Survey"
        value={JSON.stringify({
          title: "Loaded survey",
          elements: [{ type: "text", name: "loaded" }],
        })}
        uploadedFiles={[{ name: "cat.png", url: "uploads/cat.png", type: "image/png" }]}
      />,
    );

    expect(screen.getByText("Edit Survey")).toBeInTheDocument();
    expect(screen.getByText("builder:Loaded survey")).toBeInTheDocument();
    expect(screen.getByText("files:1")).toBeInTheDocument();
    expect(screen.getByTestId("survey-preview")).toHaveTextContent("Loaded survey");

    fireEvent.click(screen.getByText("Change survey"));
    expect(screen.getByTestId("survey-preview")).toHaveTextContent("Changed survey");

    fireEvent.click(screen.getByText("Save Survey"));

    expect(onChange).toHaveBeenCalledWith({
      title: "Changed survey",
      elements: [{ type: "text", name: "q1" }],
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("initializes from object values", () => {
    render(
      <SurveyBuilder
        isOpen
        onClose={vi.fn()}
        onChange={vi.fn()}
        value={{
          title: "Object survey",
          elements: [{ type: "boolean", name: "accepted" }],
        }}
      />,
    );

    expect(screen.getByText("builder:Object survey")).toBeInTheDocument();
    expect(screen.getByTestId("survey-preview")).toHaveTextContent(
      "Object survey",
    );
  });

  it("uses the default survey for empty string and object values", () => {
    const stringView = render(
      <SurveyBuilder
        isOpen
        onClose={vi.fn()}
        onChange={vi.fn()}
        value="   "
      />,
    );

    expect(screen.getByText("builder:My Survey")).toBeInTheDocument();
    stringView.unmount();

    render(
      <SurveyBuilder
        isOpen
        onClose={vi.fn()}
        onChange={vi.fn()}
        value={{}}
      />,
    );

    expect(screen.getByText("builder:My Survey")).toBeInTheDocument();
  });

  it("falls back for invalid JSON, cancels, and debounces autosave", () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    const onAutoSave = vi.fn();

    render(
      <SurveyBuilder
        isOpen
        onClose={onClose}
        onChange={vi.fn()}
        onAutoSave={onAutoSave}
        value="{not valid json"
      />,
    );

    expect(screen.getByText("builder:My Survey")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Change survey"));
    expect(onAutoSave).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText("Change survey"));

    act(() => {
      vi.advanceTimersByTime(999);
    });
    expect(onAutoSave).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(onAutoSave).toHaveBeenCalledWith({
      title: "Changed survey",
      elements: [{ type: "text", name: "q1" }],
    });
    expect(screen.getByText("✓ Saved")).toHaveStyle({ opacity: "1" });

    act(() => {
      vi.advanceTimersByTime(1500);
    });
    expect(screen.getByText("✓ Saved")).toHaveStyle({ opacity: "0" });

    fireEvent.click(screen.getByText("Cancel"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
