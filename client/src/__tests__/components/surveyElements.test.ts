import { describe, expect, it } from "vitest";
import {
  collectSurveyQuestions,
  findSurveyQuestion,
  writeSurveyQuestions,
} from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/utils/surveyElements";

const q1 = { type: "text", name: "q1", title: "First" };
const q2 = { type: "radiogroup", name: "q2", title: "Second" };

describe("surveyElements", () => {
  it("finds questions in a root elements array and inside pages", () => {
    expect(findSurveyQuestion({ elements: [q1, q2] }, "q2")).toBe(q2);
    expect(
      findSurveyQuestion(
        { pages: [{ elements: [q1] }, { elements: [q2] }] },
        "q1",
      ),
    ).toBe(q1);
    expect(findSurveyQuestion({ pages: [{ elements: [q1] }] }, "nope")).toBe(
      undefined,
    );
    expect(findSurveyQuestion({ elements: [q1] }, "")).toBe(undefined);
  });

  it("collects page questions before a legacy root elements array", () => {
    const surveyJson = {
      pages: [{ elements: [q1] }],
      elements: [q2],
    };

    expect(collectSurveyQuestions(surveyJson)).toEqual([q1, q2]);
  });

  it("writes back to elements when the survey has no pages", () => {
    const surveyJson = { title: "Survey", elements: [q1] };
    const result = writeSurveyQuestions(surveyJson, [q2]);

    expect(result).toEqual({ title: "Survey", elements: [q2] });
    expect(surveyJson.elements).toEqual([q1]);
  });

  it("keeps page structure and appends new questions to the last page", () => {
    const surveyJson = {
      title: "Survey",
      pages: [
        { name: "p1", title: "Page 1", elements: [q1] },
        { name: "p2", elements: [q2] },
      ],
    };
    const newQuestion = { type: "html", name: "question3", html: "<b>hi</b>" };
    const result = writeSurveyQuestions(surveyJson, [q1, q2, newQuestion]);

    expect(result).toEqual({
      title: "Survey",
      pages: [
        { name: "p1", title: "Page 1", elements: [q1] },
        { name: "p2", elements: [q2, newQuestion] },
      ],
    });
  });

  it("repairs hybrid JSON by merging root elements into the last page", () => {
    const surveyJson = {
      title: "Survey",
      pages: [{ name: "p1", elements: [q1] }],
      elements: [q2],
    };
    const result = writeSurveyQuestions(surveyJson, [q1, q2]);

    expect(result).toEqual({
      title: "Survey",
      pages: [{ name: "p1", elements: [q1, q2] }],
    });
    expect("elements" in result).toBe(false);
  });

  it("redistributes remaining questions positionally when one is deleted", () => {
    const surveyJson = {
      pages: [
        { name: "p1", elements: [q1] },
        { name: "p2", elements: [q2] },
      ],
    };
    const result = writeSurveyQuestions(surveyJson, [q2]);

    expect(result).toEqual({
      pages: [{ name: "p1", elements: [q2] }, { name: "p2", elements: [] }],
    });
  });
});
