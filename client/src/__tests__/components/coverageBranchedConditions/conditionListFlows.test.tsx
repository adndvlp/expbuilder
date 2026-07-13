import { fireEvent, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import {
  dynamicCondition,
  metadataMockState,
  renderConditionsList,
} from "./testHarness";

describe("coverage branched conditions list", () => {
  afterEach(() => {
    metadataMockState.missing = false;
  });

  it("renders normal branch rules and parameter overrides with interactions", () => {
    const props = renderConditionsList();

    expect(screen.getByText("IF")).toBeInTheDocument();
    expect(screen.getByText("Condition 1")).toBeInTheDocument();
    expect(screen.getByText("Column")).toBeInTheDocument();
    expect(screen.getByText("Override Params")).toBeInTheDocument();

    fireEvent.click(screen.getByTitle("Remove condition"));
    expect(props.removeCondition).toHaveBeenCalledWith(1);

    const selects = screen.getAllByRole("combobox");
    fireEvent.change(selects[0], { target: { value: "rt" } });
    expect(props.setConditionsWrapper).toHaveBeenCalledWith(
      expect.any(Array),
      true,
    );

    fireEvent.change(selects[1], { target: { value: "!=" } });
    expect(props.updateRule).toHaveBeenCalledWith(1, 0, "op", "!=");

    fireEvent.change(screen.getAllByPlaceholderText("Value")[0], {
      target: { value: "no" },
    });
    expect(props.updateRule).toHaveBeenCalledWith(
      1,
      0,
      "value",
      "no",
      undefined,
    );

    fireEvent.change(selects[2], { target: { value: "jump-a" } });
    expect(props.updateNextTrial).toHaveBeenCalledWith(1, "jump-a");

    fireEvent.change(selects[3], { target: { value: "duration" } });
    expect(props.setConditionsWrapper).toHaveBeenCalledWith(
      expect.any(Array),
      true,
    );

    fireEvent.change(selects[4], { target: { value: "csv_difficulty" } });
    expect(props.setConditionsWrapper).toHaveBeenCalledWith(
      expect.any(Array),
      true,
    );

    fireEvent.change(screen.getByDisplayValue("medium"), {
      target: { value: "hard" },
    });
    expect(props.setConditionsWrapper).toHaveBeenCalledWith(
      expect.any(Array),
      true,
    );

    fireEvent.click(screen.getAllByTitle("Remove rule")[0]);
    expect(props.removeRuleFromCondition).toHaveBeenCalledWith(1, 0);

    fireEvent.click(screen.getByRole("button", { name: /Add param/ }));
    expect(props.addCustomParameter).toHaveBeenCalledWith(1, false);

    fireEvent.click(screen.getByRole("button", { name: /Add rule \(AND\)/ }));
    expect(props.addRuleToCondition).toHaveBeenCalledWith(1);
  });

  it("renders dynamic survey branches and survey question overrides", () => {
    const condition = dynamicCondition();
    const props = renderConditionsList({
      conditions: [condition],
      selectedTrial: {
        id: "current",
        plugin: "plugin-dynamic",
        columnMapping: {
          components: {
            value: [
              {
                name: { source: "typed", value: "survey" },
                type: "SurveyComponent",
                survey_json: {
                  source: "typed",
                  value: {
                    elements: [
                      {
                        name: "question1",
                        title: "Question 1",
                        type: "radiogroup",
                        choices: ["Yes", "No"],
                      },
                    ],
                  },
                },
              },
            ],
          },
        },
      },
    });

    expect(screen.getAllByText("Field Type")).toHaveLength(2);
    expect(screen.getByText("Question")).toBeInTheDocument();

    const selects = screen.getAllByRole("combobox");
    fireEvent.change(selects[0], { target: { value: "response_components" } });
    fireEvent.change(selects[1], { target: { value: "survey" } });
    fireEvent.change(selects[2], { target: { value: "survey_json" } });
    expect(props.setConditionsWrapper).toHaveBeenCalledWith(
      expect.any(Array),
      true,
    );

    fireEvent.change(screen.getByDisplayValue("No"), {
      target: { value: "Yes" },
    });
    expect(props.setConditionsWrapper).toHaveBeenCalledWith(
      expect.any(Array),
      true,
    );
  });
});
