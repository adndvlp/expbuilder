import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useChoiceActions } from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/SurveyEditor/Builder/useChoiceActions";
import { useQuestionActions } from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/SurveyEditor/Builder/useQuestionActions";
import { useRateValueActions } from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/SurveyEditor/Builder/useRateValueActions";
import type { Question } from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/SurveyEditor/Builder/types";

const baseQuestions: Question[] = [
  {
    type: "text",
    name: "q1",
    title: "First question",
    isRequired: false,
  },
  {
    type: "radiogroup",
    name: "q2",
    title: "Second question",
    choices: ["old"],
    isRequired: true,
  },
];

describe("Survey Builder action hooks", () => {
  it("adds a default question while preserving the survey JSON wrapper", () => {
    const onChange = vi.fn();
    const surveyJson = { title: "Survey", showQuestionNumbers: "off", elements: baseQuestions };
    const { result } = renderHook(() =>
      useQuestionActions({ questions: baseQuestions, onChange, surveyJson }),
    );

    result.current.addQuestion();

    expect(onChange).toHaveBeenCalledWith({
      title: "Survey",
      showQuestionNumbers: "off",
      elements: [
        ...baseQuestions,
        {
          type: "text",
          name: "question3",
          title: "Question 3",
          isRequired: false,
        },
      ],
    });
  });

  it("updates, deletes and moves questions without mutating the original list", () => {
    const onChange = vi.fn();
    const surveyJson = { title: "Survey", elements: baseQuestions };
    const { result } = renderHook(() =>
      useQuestionActions({ questions: baseQuestions, onChange, surveyJson }),
    );

    result.current.updateQuestion(0, { title: "Updated", isRequired: true });
    expect(onChange).toHaveBeenLastCalledWith({
      title: "Survey",
      elements: [
        { ...baseQuestions[0], title: "Updated", isRequired: true },
        baseQuestions[1],
      ],
    });

    result.current.deleteQuestion(1);
    expect(onChange).toHaveBeenLastCalledWith({
      title: "Survey",
      elements: [baseQuestions[0]],
    });

    result.current.moveQuestion(1, "up");
    expect(onChange).toHaveBeenLastCalledWith({
      title: "Survey",
      elements: [baseQuestions[1], baseQuestions[0]],
    });

    result.current.moveQuestion(0, "up");
    expect(onChange).toHaveBeenCalledTimes(3);
    expect(baseQuestions[0].title).toBe("First question");
  });

  it("adds and removes choices through updateQuestion", () => {
    const updateQuestion = vi.fn();
    const { result } = renderHook(() =>
      useChoiceActions({ questions: baseQuestions, updateQuestion }),
    );

    result.current.addChoice(1);
    expect(updateQuestion).toHaveBeenCalledWith(1, {
      choices: [
        "old",
        {
          value: "",
          text: "",
          imageLink: "",
        },
      ],
    });

    result.current.removeChoice(1, 0);
    expect(updateQuestion).toHaveBeenLastCalledWith(1, { choices: [] });
  });

  it("converts string choices to objects and syncs value with text edits", () => {
    const updateQuestion = vi.fn();
    const { result } = renderHook(() =>
      useChoiceActions({ questions: baseQuestions, updateQuestion }),
    );

    result.current.updateChoice(1, 0, "text", "New choice");

    expect(updateQuestion).toHaveBeenCalledWith(1, {
      choices: [
        {
          value: "New choice",
          text: "New choice",
          imageLink: "",
        },
      ],
    });
  });

  it("updates an image link on a string choice without changing its text", () => {
    const updateQuestion = vi.fn();
    const { result } = renderHook(() =>
      useChoiceActions({ questions: baseQuestions, updateQuestion }),
    );

    result.current.updateChoice(1, 0, "imageLink", "choice.png");

    expect(updateQuestion).toHaveBeenCalledWith(1, {
      choices: [
        {
          value: "old",
          text: "old",
          imageLink: "choice.png",
        },
      ],
    });
  });

  it("handles questions without choices and ignores an invalid update", () => {
    const updateQuestion = vi.fn();
    const questions: Question[] = [
      { type: "radiogroup", name: "empty", title: "Empty" },
    ];
    const { result } = renderHook(() =>
      useChoiceActions({ questions, updateQuestion }),
    );

    result.current.addChoice(0);
    expect(updateQuestion).toHaveBeenLastCalledWith(0, {
      choices: [{ value: "", text: "", imageLink: "" }],
    });

    result.current.removeChoice(0, 0);
    expect(updateQuestion).toHaveBeenLastCalledWith(0, { choices: [] });

    updateQuestion.mockClear();
    result.current.updateChoice(0, 0, "text", "missing");
    expect(updateQuestion).not.toHaveBeenCalled();
  });

  it("updates object choices while preserving image links and syncing text value", () => {
    const updateQuestion = vi.fn();
    const questions: Question[] = [
      {
        type: "imagepicker",
        name: "q1",
        choices: [{ value: "Cat", text: "Cat", imageLink: "cat.png" }],
      },
    ];
    const { result } = renderHook(() =>
      useChoiceActions({ questions, updateQuestion }),
    );

    result.current.updateChoice(0, 0, "imageLink", "dog.png");
    expect(updateQuestion).toHaveBeenCalledWith(0, {
      choices: [{ value: "Cat", text: "Cat", imageLink: "dog.png" }],
    });

    result.current.updateChoice(0, 0, "text", "Dog");
    expect(updateQuestion).toHaveBeenLastCalledWith(0, {
      choices: [{ value: "Dog", text: "Dog", imageLink: "cat.png" }],
    });
  });

  it("adds, updates and removes rating values with text/value kept in sync", () => {
    const updateQuestion = vi.fn();
    const questions: Question[] = [
      {
        type: "rating",
        name: "likert",
        rateValues: [
          { value: "Agree", text: "Agree" },
          { value: "Disagree", text: "Disagree" },
        ],
      },
    ];
    const { result } = renderHook(() =>
      useRateValueActions({ questions, updateQuestion }),
    );

    result.current.addRateValue(0);
    expect(updateQuestion).toHaveBeenCalledWith(0, {
      rateValues: [
        { value: "Agree", text: "Agree" },
        { value: "Disagree", text: "Disagree" },
        { value: "", text: "" },
      ],
    });

    result.current.updateRateValue(0, 1, "Neutral");
    expect(updateQuestion).toHaveBeenLastCalledWith(0, {
      rateValues: [
        { value: "Agree", text: "Agree" },
        { value: "Neutral", text: "Neutral" },
      ],
    });

    result.current.removeRateValue(0, 0);
    expect(updateQuestion).toHaveBeenLastCalledWith(0, {
      rateValues: [{ value: "Disagree", text: "Disagree" }],
    });
  });

  it("updates and removes rating values when the collection is absent", () => {
    const updateQuestion = vi.fn();
    const questions: Question[] = [{ type: "rating", name: "empty-rating" }];
    const { result } = renderHook(() =>
      useRateValueActions({ questions, updateQuestion }),
    );

    result.current.addRateValue(0);
    expect(updateQuestion).toHaveBeenCalledWith(0, {
      rateValues: [{ value: "", text: "" }],
    });

    result.current.updateRateValue(0, 0, "First");
    expect(updateQuestion).toHaveBeenCalledWith(0, {
      rateValues: [{ value: "First", text: "First" }],
    });

    result.current.removeRateValue(0, 0);
    expect(updateQuestion).toHaveBeenLastCalledWith(0, { rateValues: [] });
  });
});
