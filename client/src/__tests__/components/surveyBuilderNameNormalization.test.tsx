import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import SurveyBuilder from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/SurveyEditor";

vi.mock(
  "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/SurveyEditor/Builder",
  () => ({
    default: ({
      surveyJson,
      onChange,
    }: {
      surveyJson: Record<string, unknown>;
      onChange: (json: Record<string, unknown>) => void;
    }) => (
      <div data-testid="survey-builder">
        <button
          type="button"
          onClick={() =>
            onChange({
              ...surveyJson,
              elements: [
                {
                  type: "radiogroup",
                  name: "",
                  choices: [{ value: "", text: "" }],
                },
              ],
            })
          }
        >
          Break names
        </button>
      </div>
    ),
  }),
);

vi.mock(
  "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/SurveyEditor/Preview",
  () => ({
    default: ({ surveyJson }: { surveyJson: Record<string, unknown> }) => (
      <div data-testid="survey-preview">{JSON.stringify(surveyJson)}</div>
    ),
  }),
);

const brokenSurvey = {
  title: "Survey",
  elements: [
    {
      type: "radiogroup",
      name: "question1",
      choices: [{ value: "", text: "" }],
    },
  ],
};

describe("SurveyBuilder question name normalization", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("normalizes empty question names before autosave and save", () => {
    vi.useFakeTimers();
    const onAutoSave = vi.fn();
    const onChange = vi.fn();

    render(
      <SurveyBuilder
        isOpen
        onClose={vi.fn()}
        onChange={onChange}
        onAutoSave={onAutoSave}
        value={{ title: "Survey", elements: [] }}
      />,
    );

    fireEvent.click(screen.getByText("Break names"));
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(onAutoSave).toHaveBeenCalledWith(brokenSurvey);

    fireEvent.click(screen.getByText("Save Survey"));
    expect(onChange).toHaveBeenCalledWith(brokenSurvey);
  });

  it("normalizes names for the live preview", () => {
    render(
      <SurveyBuilder
        isOpen
        onClose={vi.fn()}
        onChange={vi.fn()}
        value={{ title: "Survey", elements: [{ type: "text", name: "" }] }}
      />,
    );

    expect(
      JSON.parse(screen.getByTestId("survey-preview").textContent ?? ""),
    ).toEqual({
      title: "Survey",
      elements: [{ type: "text", name: "question1" }],
    });
  });
});
