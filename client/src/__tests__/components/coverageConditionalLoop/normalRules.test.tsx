import { conditionFixture, normalRule, renderRuleRow } from "./testHarness";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

describe("conditional loop normal rule rows", () => {
  it("updates trial selections, fields, operators, values and removal", async () => {
    const props = renderRuleRow();
    const selects = screen.getAllByRole("combobox");
    fireEvent.change(selects[1], { target: { value: "rt" } });
    expect(props.setConditionsWrapper).toHaveBeenCalledWith(
      expect.any(Array),
      true,
    );
    fireEvent.change(selects[2], { target: { value: "!=" } });
    expect(props.updateRule).toHaveBeenCalledWith(1, 0, "op", "!=");
    fireEvent.change(screen.getByPlaceholderText("Value"), {
      target: { value: "no" },
    });
    expect(props.updateRule).toHaveBeenCalledWith(1, 0, "value", "no");
    fireEvent.click(screen.getByTitle("Remove rule"));
    expect(props.removeRuleFromCondition).toHaveBeenCalledWith(1, 0);

    props.setConditionsWrapper.mockClear();
    fireEvent.change(selects[0], { target: { value: "trial-b" } });
    await waitFor(() => {
      expect(props.loadTrialOrLoop).toHaveBeenCalledWith("trial-b");
      expect(props.loadTrialDataFields).toHaveBeenCalledWith("trial-b");
      expect(props.setConditionsWrapper).toHaveBeenCalledWith(
        expect.any(Array),
        true,
      );
    });
    props.loadTrialOrLoop.mockClear();
    props.loadTrialDataFields.mockClear();
    fireEvent.change(selects[0], { target: { value: "" } });
    await waitFor(() =>
      expect(props.setConditionsWrapper).toHaveBeenCalledWith(
        expect.any(Array),
        true,
      ),
    );
    expect(props.loadTrialOrLoop).not.toHaveBeenCalled();
    expect(props.loadTrialDataFields).not.toHaveBeenCalled();
  });

  it("renders loading and data-field fallback states", () => {
    const condition = conditionFixture({
      rules: [normalRule(), normalRule({ prop: "rt", value: "200" })],
    });
    const foreignCondition = conditionFixture({ id: 99 });
    const props = renderRuleRow({
      condition,
      rule: condition.rules[0],
      conditions: [condition, foreignCondition],
      loadingData: {},
      trialDataFields: { "trial-a": [{ key: "score", label: "" }] },
    });
    expect(screen.getByRole("option", { name: "score" })).toHaveValue("score");
    fireEvent.change(screen.getAllByRole("combobox")[1], {
      target: { value: "score" },
    });
    expect(props.setConditionsWrapper).toHaveBeenCalledWith(
      expect.arrayContaining([foreignCondition]),
      true,
    );
    renderRuleRow({ loadingData: { "trial-a": true } });
    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });
});
