import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  conditionFixture,
  dynamicTrialFixture,
  renderRuleRow,
} from "./testHarness";

describe("params override rule rows", () => {
  it("updates a normal rule row", () => {
    const props = renderRuleRow();
    const selects = screen.getAllByRole("combobox");
    fireEvent.change(selects[0], { target: { value: "trial-b" } });
    expect(props.setConditionsWrapper).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          id: 1,
          rules: expect.arrayContaining([
            expect.objectContaining({
              trialId: "trial-b",
              column: "",
              value: "",
            }),
          ]),
        }),
        expect.objectContaining({ id: 2 }),
      ]),
      true,
    );
    fireEvent.change(selects[1], { target: { value: "rt" } });
    fireEvent.change(selects[2], { target: { value: "!=" } });
    fireEvent.change(screen.getByPlaceholderText("Value"), {
      target: { value: "no" },
    });
    expect(props.updateRule).toHaveBeenCalledWith(1, 0, "op", "!=");
    expect(props.updateRule).toHaveBeenCalledWith(
      1,
      0,
      "value",
      "no",
      undefined,
    );
    fireEvent.click(screen.getByTitle("Remove rule"));
    expect(props.removeRuleFromCondition).toHaveBeenCalledWith(1, 0);
  });

  it("renders params override rule row loading and empty-trial states", () => {
    renderRuleRow({ loadingData: { "trial-a": true }, canRemove: false });
    expect(screen.getByText("Loading...")).toBeInTheDocument();
    expect(screen.queryByTitle("Remove rule")).not.toBeInTheDocument();
  });

  it("renders a params override row without a selected trial", () => {
    renderRuleRow({
      rule: { trialId: "", prop: "", column: "", op: "==", value: "" },
      condition: conditionFixture({
        rules: [{ trialId: "", prop: "", column: "", op: "==", value: "" }],
      }),
      conditions: [
        conditionFixture({
          rules: [{ trialId: "", prop: "", column: "", op: "==", value: "" }],
        }),
      ],
      trialDataFields: {},
      loadingData: {},
    });
    const selects = screen.getAllByRole("combobox") as HTMLSelectElement[];
    expect(selects[1]).toBeDisabled();
  });

  it("updates a dynamic rule row", () => {
    const dynamicTrial = dynamicTrialFixture();
    const dynamicRule = {
      trialId: "dynamic-a",
      fieldType: "components",
      componentIdx: "survey",
      prop: "q1",
      column: "",
      op: "==",
      value: "Yes",
    };
    const props = renderRuleRow({
      rule: dynamicRule,
      condition: conditionFixture({ rules: [dynamicRule] }),
      conditions: [conditionFixture({ rules: [dynamicRule] })],
      availableTrials: [{ id: "dynamic-a", name: "Dynamic A" }],
      findTrialByIdSync: vi.fn((id) =>
        id === "dynamic-a" ? dynamicTrial : null,
      ),
      trialDataFields: {},
    });
    expect(screen.getByRole("option", { name: "survey" })).toHaveValue(
      "survey",
    );
    const selects = screen.getAllByRole("combobox");
    fireEvent.change(selects[1], { target: { value: "response_components" } });
    fireEvent.change(selects[2], { target: { value: "button" } });
    fireEvent.change(selects[3], { target: { value: "rt" } });
    fireEvent.change(selects[4], { target: { value: "<=" } });
    fireEvent.change(selects[5], { target: { value: "no" } });
    expect(props.setConditionsWrapper).toHaveBeenCalledWith(
      expect.any(Array),
      true,
    );
    expect(props.updateRule).toHaveBeenCalledWith(1, 0, "op", "<=");
  });

  it("handles dynamic rows without component arrays", () => {
    const dynamicTrial = { ...dynamicTrialFixture(), columnMapping: {} };
    const dynamicRule = {
      trialId: "dynamic-a",
      fieldType: "components",
      componentIdx: "missing",
      prop: "",
      column: "",
      op: "==",
      value: "",
    };
    renderRuleRow({
      rule: dynamicRule,
      condition: conditionFixture({ rules: [dynamicRule] }),
      conditions: [conditionFixture({ rules: [dynamicRule] })],
      availableTrials: [{ id: "dynamic-a", name: "Dynamic A" }],
      findTrialByIdSync: vi.fn((id) =>
        id === "dynamic-a" ? dynamicTrial : null,
      ),
      trialDataFields: {},
    });
    expect(screen.getAllByRole("combobox")[2]).toHaveValue("");
  });
});
