import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TableBodyHarness } from "./testHarness";

describe("coverage ConditionsList TableBody edge cases", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders TableBody with malformed dynamic survey parameter keys", () => {
    const condition = {
      id: 3,
      nextTrialId: "plain-dynamic",
      rules: [{ trialId: "source", prop: "rt", op: ">", value: "100" }],
      customParameters: {
        malformed: {},
        "components::plain": {},
        "components::plain::text": {},
        "components::plain::survey_json": {},
      },
    } as any;
    const findTrialById = vi.fn(() => ({
      id: "plain-dynamic",
      plugin: "plugin-dynamic",
      columnMapping: {
        components: {
          value: [{ name: "plain", type: "TextComponent" }],
        },
      },
    }));

    render(
      <table>
        <TableBodyHarness
          condition={condition}
          conditions={[condition]}
          findTrialById={findTrialById}
          updateRule={vi.fn()}
          addCustomParameter={vi.fn()}
          updateNextTrial={vi.fn()}
          setConditionsWrapper={vi.fn()}
          triggerSave={vi.fn()}
          removeRuleFromCondition={vi.fn()}
          getAvailableColumns={vi.fn(() => [])}
          branchTrials={[{ id: "other", name: "Other Trial", isLoop: false }]}
          targetTrialParameters={{ "plain-dynamic": [] }}
          targetTrialCsvColumns={{}}
          selectedTrial={{ id: "selected", plugin: "plugin-dynamic" } as any}
        />
      </table>,
    );

    expect(screen.getByTestId("override-3-malformed")).toHaveAttribute(
      "data-survey",
      "false",
    );
  });

  it("renders TableBody without a target or custom parameters", () => {
    const condition = {
      id: 4,
      nextTrialId: null,
      rules: [{ trialId: "source", prop: "rt", op: ">", value: "100" }],
      customParameters: undefined,
    } as any;

    render(
      <table>
        <TableBodyHarness
          condition={condition}
          conditions={[condition]}
          findTrialById={vi.fn(() => null)}
          updateRule={vi.fn()}
          addCustomParameter={vi.fn()}
          updateNextTrial={vi.fn()}
          setConditionsWrapper={vi.fn()}
          triggerSave={vi.fn()}
          removeRuleFromCondition={vi.fn()}
          getAvailableColumns={vi.fn(() => [])}
          branchTrials={[{ id: "other", name: "Other Trial", isLoop: false }]}
          targetTrialParameters={{}}
          targetTrialCsvColumns={{}}
          selectedTrial={{ id: "selected", plugin: "plugin-dynamic" } as any}
        />
      </table>,
    );

    expect(screen.getByRole("combobox")).toHaveValue("");
    expect(screen.getByTestId("override-4-empty")).toHaveAttribute(
      "data-survey",
      "false",
    );
  });

  it("handles a dynamic target without parameter or component metadata", () => {
    const condition = {
      id: 5,
      nextTrialId: "missing-dynamic",
      rules: [{ trialId: "source", prop: "rt", op: ">", value: "100" }],
      customParameters: {
        "components::missing::survey_json": {},
      },
    } as any;

    render(
      <table>
        <TableBodyHarness
          condition={condition}
          conditions={[condition]}
          findTrialById={vi.fn(() => ({
            id: "missing-dynamic",
            plugin: "plugin-dynamic",
          }))}
          updateRule={vi.fn()}
          addCustomParameter={vi.fn()}
          updateNextTrial={vi.fn()}
          setConditionsWrapper={vi.fn()}
          triggerSave={vi.fn()}
          removeRuleFromCondition={vi.fn()}
          getAvailableColumns={vi.fn(() => [])}
          branchTrials={[
            { id: "other", name: "Other Trial", isLoop: false }, { id: "return-trial", name: "Return Trial", isLoop: false },
          ]}
          targetTrialParameters={{}}
          targetTrialCsvColumns={{}}
          selectedTrial={{ id: "selected", plugin: "plugin-dynamic" } as any}
        />
      </table>,
    );

    expect(
      screen.getByRole("option", { name: "Other Trial" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "Return Trial" }),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("override-5-components::missing::survey_json"),
    ).toHaveAttribute("data-survey", "false");
  });

  it("offers another parameter for a normal target with available fields", () => {
    const condition = {
      id: 6,
      nextTrialId: "normal-target",
      rules: [{ trialId: "source", prop: "rt", op: ">", value: "100" }],
      customParameters: {},
    } as any;

    render(
      <table>
        <TableBodyHarness
          condition={condition}
          conditions={[condition]}
          findTrialById={vi.fn(() => ({
            id: "normal-target",
            plugin: "plugin-html-keyboard-response",
          }))}
          updateRule={vi.fn()}
          addCustomParameter={vi.fn()}
          updateNextTrial={vi.fn()}
          setConditionsWrapper={vi.fn()}
          triggerSave={vi.fn()}
          removeRuleFromCondition={vi.fn()}
          getAvailableColumns={vi.fn(() => [])}
          branchTrials={[{ id: "other", name: "Other Trial", isLoop: false }]}
          targetTrialParameters={{
            "normal-target": [
              { key: "stimulus", label: "Stimulus", type: "string" },
            ],
          }}
          targetTrialCsvColumns={{}}
          selectedTrial={{ id: "selected", plugin: "plugin-dynamic" } as any}
        />
      </table>,
    );

    expect(screen.getByTestId("add-param-6")).toHaveAttribute(
      "data-dynamic",
      "false",
    );
  });
});
