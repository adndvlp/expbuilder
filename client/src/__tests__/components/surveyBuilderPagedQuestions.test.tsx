import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useQuestionActions } from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/SurveyEditor/Builder/useQuestionActions";

const q1 = { type: "text", name: "q1", title: "First" };
const q2 = { type: "radiogroup", name: "q2", title: "Second" };

describe("Survey Builder questions in paged surveys", () => {
  it("keeps page structure when adding questions", () => {
    const onChange = vi.fn();
    const { result } = renderHook(() =>
      useQuestionActions({
        questions: [q1, q2],
        onChange,
        surveyJson: {
          title: "Paged",
          pages: [
            { name: "p1", elements: [q1] },
            { name: "p2", elements: [q2] },
          ],
        },
      }),
    );

    result.current.addQuestion();

    expect(onChange).toHaveBeenLastCalledWith({
      title: "Paged",
      pages: [
        { name: "p1", elements: [q1] },
        {
          name: "p2",
          elements: [
            q2,
            {
              type: "text",
              name: "question3",
              title: "Question 3",
              isRequired: false,
            },
          ],
        },
      ],
    });
  });

  it("repairs hybrid surveys by merging root elements into the last page", () => {
    const onChange = vi.fn();
    const { result } = renderHook(() =>
      useQuestionActions({
        questions: [q1, q2],
        onChange,
        surveyJson: {
          title: "Hybrid",
          pages: [{ name: "p1", elements: [q1] }],
          elements: [q2],
        },
      }),
    );

    result.current.updateQuestion(1, { title: "Updated" });

    expect(onChange).toHaveBeenLastCalledWith({
      title: "Hybrid",
      pages: [{ name: "p1", elements: [q1, { ...q2, title: "Updated" }] }],
    });
  });
});
