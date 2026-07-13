import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SurveyHarness, ThemeCustomizationHarness } from "./testHarness";

describe("Survey Builder structure and question orchestration", () => {
  it("edits survey title, description, theme variables and adds a default question", () => {
    const onChange = vi.fn();
    const { container } = render(
      <SurveyHarness
        initial={{
          title: "Initial survey",
          description: "Initial description",
          themeVariables: { "--sjs-general-forecolor": "#111111" },
          elements: [],
        }}
        onChange={onChange}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText("Enter survey title"), {
      target: { value: "Updated survey" },
    });
    fireEvent.change(screen.getByPlaceholderText("Enter survey description"), {
      target: { value: "Updated description" },
    });

    const colorInputs = container.querySelectorAll<HTMLInputElement>(
      'input[type="color"]',
    );
    fireEvent.change(colorInputs[0], { target: { value: "#abcdef" } });
    fireEvent.change(colorInputs[1], { target: { value: "#123456" } });
    fireEvent.change(colorInputs[2], { target: { value: "#fedcba" } });

    expect(
      screen.getByText('No questions yet. Click "Add Question" to start.'),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByText("Add Question"));

    expect(screen.getByTestId("survey-json")).toHaveTextContent(
      "Updated survey",
    );
    expect(screen.getByTestId("survey-json")).toHaveTextContent(
      "Updated description",
    );
    expect(screen.getByTestId("survey-json")).toHaveTextContent(
      "--sjs-primary-backcolor",
    );
    expect(screen.getByTestId("survey-json")).toHaveTextContent(
      "--sjs-general-forecolor",
    );
    expect(screen.getByTestId("survey-json")).toHaveTextContent(
      "--sjs-general-backcolor-dim",
    );
    expect(screen.getByTestId("survey-json")).toHaveTextContent("question1");
    expect(screen.getByText("Question 1")).toBeInTheDocument();
    expect(onChange).toHaveBeenCalled();
  });

  it("creates each theme variable when no theme object exists", () => {
    const onChange = vi.fn();
    const { container } = render(
      <ThemeCustomizationHarness surveyJson={{}} onChange={onChange} />,
    );
    const colorInputs = container.querySelectorAll<HTMLInputElement>(
      'input[type="color"]',
    );

    fireEvent.change(colorInputs[0], { target: { value: "#111111" } });
    fireEvent.change(colorInputs[1], { target: { value: "#222222" } });
    fireEvent.change(colorInputs[2], { target: { value: "#333333" } });

    expect(onChange).toHaveBeenNthCalledWith(1, {
      themeVariables: { "--sjs-primary-backcolor": "#111111" },
    });
    expect(onChange).toHaveBeenNthCalledWith(2, {
      themeVariables: { "--sjs-general-forecolor": "#222222" },
    });
    expect(onChange).toHaveBeenNthCalledWith(3, {
      themeVariables: { "--sjs-general-backcolor-dim": "#333333" },
    });
  });

  it("shows an empty state when the survey has no elements field", () => {
    render(<SurveyHarness initial={{ title: "No elements yet" }} />);

    expect(
      screen.getByText('No questions yet. Click "Add Question" to start.'),
    ).toBeInTheDocument();
  });

  it("toggles, moves and deletes questions through CustomSurveyEditor", () => {
    render(
      <SurveyHarness
        initial={{
          elements: [
            { type: "text", name: "first", title: "First question" },
            { type: "comment", name: "second", title: "Second question" },
          ],
        }}
      />,
    );

    fireEvent.click(screen.getByText("First question"));
    expect(
      screen.getByPlaceholderText("Enter your question"),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByText("First question"));
    expect(
      screen.queryByPlaceholderText("Enter your question"),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("First question"));
    fireEvent.click(screen.getByText("Move Down"));
    const afterMove = JSON.parse(
      screen.getByTestId("survey-json").textContent || "{}",
    );
    expect(afterMove.elements.map((q: Question) => q.name)).toEqual([
      "second",
      "first",
    ]);

    fireEvent.click(screen.getByText("Delete"));
    const afterDelete = JSON.parse(
      screen.getByTestId("survey-json").textContent || "{}",
    );

    expect(afterDelete.elements).toHaveLength(1);
  });

  it("routes nested choice and rating updates through CustomSurveyEditor", () => {
    render(
      <SurveyHarness
        initial={{
          elements: [
            {
              type: "radiogroup",
              name: "choice_question",
              title: "Choice question",
              choices: ["A"],
            },
            {
              type: "rating",
              name: "rating_question",
              title: "Rating question",
              rateMin: 1,
              rateMax: 5,
            },
          ],
        }}
      />,
    );

    fireEvent.click(screen.getByText("Choice question"));
    fireEvent.change(screen.getByPlaceholderText("Enter your question"), {
      target: { value: "Updated choice question" },
    });
    fireEvent.click(screen.getByText("Add Option"));
    fireEvent.change(screen.getByDisplayValue("A"), {
      target: { value: "Option A" },
    });
    fireEvent.click(screen.getAllByTitle("Remove option")[0]);

    fireEvent.click(screen.getByText("Rating question"));
    fireEvent.click(screen.getByText("Add Value"));
    fireEvent.change(screen.getByPlaceholderText("Value 1 label"), {
      target: { value: "Neutral" },
    });
    fireEvent.click(screen.getByTitle("Remove value"));

    const updated = JSON.parse(
      screen.getByTestId("survey-json").textContent || "{}",
    );
    expect(updated.elements[0].title).toBe("Updated choice question");
    expect(updated.elements[0].choices).toEqual([
      { value: "", text: "", imageLink: "" },
    ]);
    expect(updated.elements[1].rateValues).toEqual([]);
  });
});
