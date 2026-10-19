import { describe, expect, it } from "vitest";
import { ensureQuestionNames } from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/SurveyEditor/ensureQuestionNames";

type ElementNode = {
  name?: string;
  elements?: ElementNode[];
  templateElements?: ElementNode[];
};

type PageNode = {
  name?: string;
  elements: ElementNode[];
};

function elementsOf(json: Record<string, unknown>): ElementNode[] {
  return (json as unknown as { elements: ElementNode[] }).elements;
}

describe("ensureQuestionNames", () => {
  it("fills missing, empty and whitespace names without touching valid ones", () => {
    const result = ensureQuestionNames({
      elements: [
        { type: "radiogroup", name: "", choices: [{ value: "", text: "" }] },
        { type: "text", name: "typed" },
        { type: "checkbox" },
        { type: "text", name: "   " },
      ],
    });

    expect(elementsOf(result).map((element) => element.name)).toEqual([
      "question1",
      "typed",
      "question2",
      "question3",
    ]);
  });

  it("avoids colliding with names that already exist", () => {
    const result = ensureQuestionNames({
      elements: [
        { type: "text" },
        { type: "text", name: "question1" },
        { type: "text" },
      ],
    });

    expect(elementsOf(result).map((element) => element.name)).toEqual([
      "question2",
      "question1",
      "question3",
    ]);
  });

  it("walks pages, panels and dynamic templates", () => {
    const result = ensureQuestionNames({
      pages: [
        {
          name: "page1",
          elements: [
            { type: "text" },
            {
              type: "panel",
              name: "panel1",
              elements: [{ type: "radiogroup", name: "" }],
            },
            {
              type: "paneldynamic",
              name: "dynamic1",
              templateElements: [{ type: "text", name: "" }],
            },
          ],
        },
      ],
    });
    const pages = (result as unknown as { pages: PageNode[] }).pages;

    expect(pages[0].elements[0].name).toBe("question1");
    expect(pages[0].elements[1].elements?.[0].name).toBe("question2");
    expect(pages[0].elements[2].templateElements?.[0].name).toBe("question3");
  });

  it("does not mutate the original survey JSON", () => {
    const input: Record<string, unknown> = {
      elements: [{ type: "text", name: "" }],
    };
    const result = ensureQuestionNames(input);

    expect(result).not.toBe(input);
    expect(elementsOf(input)[0].name).toBe("");
    expect(elementsOf(result)[0].name).toBe("question1");
  });
});
