import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import useBranchConditions from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/BranchedTrial/BranchConditions/useBranchConditions";
import type { Condition } from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/BranchedTrial/types";
import * as branchRuleHelpers from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/BranchedTrial/ruleUpdateHelpers";
import { useOrdersAndCategories } from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/OrdersAndCategories/useOrdersAndCategories";
import * as paramsActions from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/ParamsOverride/ConditionActions";
import * as paramsRuleHelpers from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/ParamsOverride/ruleUpdateHelpers";
import type { ParamsOverrideCondition } from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/ParamsOverride/types";
import * as loopActions from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/LoopsConfiguration/ConditionalLoop/ConditionActions";
import * as loopRuleHelpers from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/LoopsConfiguration/ConditionalLoop/ruleUpdateHelpers";
import type { LoopCondition } from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/LoopsConfiguration/ConditionalLoop/types";

describe("useOrdersAndCategories", () => {
  it("maps CSV order columns from 1-based rows to 0-based stimuli orders", () => {
    const { result } = renderHook(() => useOrdersAndCategories());

    act(() => {
      result.current.mapOrdersFromCsv(
        [
          { order_a: "1", order_b: 3 },
          { order_a: "2", order_b: "bad" },
          { order_a: "bad", order_b: 1 },
        ],
        ["order_a", "order_b"],
      );
    });

    expect(result.current.stimuliOrders).toEqual([
      [0, 1],
      [2, 0],
    ]);
  });

  it("maps and clears category data from CSV", () => {
    const { result } = renderHook(() => useOrdersAndCategories());

    act(() => {
      result.current.mapCategoriesFromCsv(
        [{ category: "practice" }, { category: "main" }],
        "category",
      );
    });

    expect(result.current.categoryData).toEqual(["practice", "main"]);

    act(() => {
      result.current.mapCategoriesFromCsv([], "category");
    });

    expect(result.current.categoryData).toEqual([]);
  });
});

describe("BranchedTrial rule helpers", () => {
  it("resets dependent dynamic-plugin fields when field type changes", () => {
    const conditions: Condition[] = [
      {
        id: 1,
        nextTrialId: 2,
        rules: [
          {
            column: "old_column",
            op: "==",
            value: "yes",
            fieldType: "components",
            componentIdx: "0",
            prop: "response",
          },
        ],
      },
    ];

    expect(branchRuleHelpers.updateFieldType(conditions, 1, 0, "survey")).toEqual([
      {
        id: 1,
        nextTrialId: 2,
        rules: [
          {
            column: "",
            op: "==",
            value: "",
            fieldType: "survey",
            componentIdx: "",
            prop: "",
          },
        ],
      },
    ]);
  });

  it("resets property, column and value when component index changes", () => {
    const conditions: Condition[] = [
      {
        id: 1,
        nextTrialId: 2,
        rules: [
          {
            column: "old_column",
            op: "==",
            value: "yes",
            fieldType: "components",
            componentIdx: "0",
            prop: "response",
          },
        ],
      },
    ];

    expect(branchRuleHelpers.updateComponentIdx(conditions, 1, 0, "2")).toEqual([
      {
        id: 1,
        nextTrialId: 2,
        rules: [
          {
            column: "",
            op: "==",
            value: "",
            fieldType: "components",
            componentIdx: "2",
            prop: "",
          },
        ],
      },
    ]);
  });
});

describe("useBranchConditions", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("adds the first available custom parameter for normal target trials", () => {
    const conditions: Condition[] = [
      {
        id: 1,
        nextTrialId: 2,
        rules: [{ column: "response", op: "==", value: "yes" }],
        customParameters: {
          stimulus: { source: "typed", value: "old" },
        },
      },
    ];
    const setConditionsWrapper = vi.fn();

    const { result } = renderHook(() =>
      useBranchConditions({
        loadTargetTrialParameters: vi.fn(),
        setConditionsWrapper,
        conditions,
        targetTrialParameters: {
          2: [
            { key: "stimulus", label: "Stimulus", type: "html_string" },
            { key: "choices", label: "Choices", type: "string_array" },
          ],
        },
      }),
    );

    act(() => {
      result.current.addCustomParameter(1, false);
    });

    expect(setConditionsWrapper).toHaveBeenCalledWith(
      [
        {
          ...conditions[0],
          customParameters: {
            stimulus: { source: "typed", value: "old" },
            choices: { source: "none", value: null },
          },
        },
      ],
      true,
    );
  });

  it("adds dynamic target custom parameters with unique component keys", () => {
    vi.spyOn(Date, "now").mockReturnValue(999);
    const setConditionsWrapper = vi.fn();

    const { result } = renderHook(() =>
      useBranchConditions({
        loadTargetTrialParameters: vi.fn(),
        setConditionsWrapper,
        conditions: [
          {
            id: 1,
            nextTrialId: "loop_1",
            rules: [{ column: "response", op: "==", value: "yes" }],
            customParameters: {},
          },
        ],
        targetTrialParameters: {},
      }),
    );

    act(() => {
      result.current.addCustomParameter(1, true);
    });

    expect(setConditionsWrapper).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          customParameters: {
            "components::::_999": { source: "none", value: null },
          },
        }),
      ],
      true,
    );
  });

  it("resets custom parameters and loads target params when next trial changes", () => {
    const loadTargetTrialParameters = vi.fn();
    const setConditionsWrapper = vi.fn();

    const { result } = renderHook(() =>
      useBranchConditions({
        loadTargetTrialParameters,
        setConditionsWrapper,
        conditions: [
          {
            id: 1,
            nextTrialId: 2,
            rules: [{ column: "response", op: "==", value: "yes" }],
            customParameters: {
              stimulus: { source: "typed", value: "old" },
            },
          },
        ],
        targetTrialParameters: {},
      }),
    );

    act(() => {
      result.current.updateNextTrial(1, "3");
    });

    expect(setConditionsWrapper).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          nextTrialId: "3",
          customParameters: {},
        }),
      ],
      true,
    );
    expect(loadTargetTrialParameters).toHaveBeenCalledWith("3");
  });
});

describe("ParamsOverride condition helpers", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("adds conditions with default trial-scoped rule shape", () => {
    vi.spyOn(Date, "now").mockReturnValue(123);

    expect(paramsActions.addCondition([])).toEqual([
      {
        id: 123,
        rules: [{ trialId: "", column: "", op: "==", value: "", prop: "" }],
        paramsToOverride: {},
      },
    ]);
  });

  it("resets data-field selectors and loads data fields when trialId changes", () => {
    const loadTrialDataFields = vi.fn();
    const conditions: ParamsOverrideCondition[] = [
      {
        id: 1,
        rules: [
          {
            trialId: 1,
            column: "response",
            op: "==",
            value: "yes",
            prop: "response",
            fieldType: "components",
            componentIdx: "0",
          },
        ],
        paramsToOverride: {},
      },
    ];

    const updated = paramsActions.updateRule(
      conditions,
      1,
      0,
      "trialId",
      2,
      loadTrialDataFields,
    );

    expect(updated[0].rules[0]).toEqual({
      trialId: 2,
      column: "",
      op: "==",
      value: "yes",
      prop: "",
      fieldType: "",
      componentIdx: "",
    });
    expect(loadTrialDataFields).toHaveBeenCalledWith(2);
  });

  it("adds normal and dynamic parameters to override", () => {
    const conditions: ParamsOverrideCondition[] = [
      {
        id: 1,
        rules: [{ trialId: 1, column: "response", op: "==", value: "" }],
        paramsToOverride: {
          stimulus: { source: "typed", value: "old" },
        },
      },
    ];

    const normal = paramsActions.addParameterToOverride(
      conditions,
      1,
      [
        { key: "stimulus", label: "Stimulus", type: "html_string" },
        { key: "choices", label: "Choices", type: "string_array" },
      ],
      false,
    );
    const dynamic = paramsActions.addParameterToOverride(conditions, 1, [], true);

    expect(normal[0].paramsToOverride).toEqual({
      stimulus: { source: "typed", value: "old" },
      choices: { source: "none", value: null },
    });
    expect(dynamic[0].paramsToOverride).toEqual({
      stimulus: { source: "typed", value: "old" },
      "::::": { source: "none", value: null },
    });
  });

  it("updates and removes parameter override values", () => {
    const conditions: ParamsOverrideCondition[] = [
      {
        id: 1,
        rules: [{ trialId: 1, column: "response", op: "==", value: "" }],
        paramsToOverride: {},
      },
    ];

    const updated = paramsActions.updateParameterOverride(
      conditions,
      1,
      "stimulus",
      "typed",
      "new stimulus",
    );
    const removed = paramsActions.removeParameterFromOverride(
      updated,
      1,
      "stimulus",
    );

    expect(updated[0].paramsToOverride.stimulus).toEqual({
      source: "typed",
      value: "new stimulus",
    });
    expect(removed[0].paramsToOverride).toEqual({});
  });

  it("resets dynamic selectors in ParamsOverride rule helpers", () => {
    const conditions: ParamsOverrideCondition[] = [
      {
        id: 1,
        rules: [
          {
            trialId: 1,
            column: "old_column",
            op: "==",
            value: "yes",
            prop: "response",
            fieldType: "components",
            componentIdx: "0",
          },
        ],
        paramsToOverride: {},
      },
    ];

    expect(paramsRuleHelpers.updateFieldType(conditions, 1, 0, "survey")[0].rules[0]).toEqual({
      trialId: 1,
      column: "",
      op: "==",
      value: "",
      prop: "",
      fieldType: "survey",
      componentIdx: "",
    });
    expect(paramsRuleHelpers.updateComponentIdx(conditions, 1, 0, "2")[0].rules[0]).toEqual({
      trialId: 1,
      column: "",
      op: "==",
      value: "",
      prop: "",
      fieldType: "components",
      componentIdx: "2",
    });
  });
});

describe("ConditionalLoop condition helpers", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("adds loop conditions with default rule shape", () => {
    vi.spyOn(Date, "now").mockReturnValue(456);

    expect(loopActions.addCondition([])).toEqual([
      {
        id: 456,
        rules: [
          {
            trialId: "",
            column: "",
            op: "==",
            value: "",
            prop: "",
            fieldType: "",
            componentIdx: "",
          },
        ],
      },
    ]);
  });

  it("resets selectors and loads data fields when loop condition trial changes", () => {
    const loadTrialDataFields = vi.fn();
    const conditions: LoopCondition[] = [
      {
        id: 1,
        rules: [
          {
            trialId: 1,
            column: "response",
            op: "==",
            value: "yes",
            prop: "response",
            fieldType: "components",
            componentIdx: "0",
          },
        ],
      },
    ];

    const updated = loopActions.updateRule(
      conditions,
      1,
      0,
      "trialId",
      2,
      loadTrialDataFields,
    );

    expect(updated[0].rules[0]).toEqual({
      trialId: 2,
      column: "",
      op: "==",
      value: "yes",
      prop: "",
      fieldType: "",
      componentIdx: "",
    });
    expect(loadTrialDataFields).toHaveBeenCalledWith(2);
  });

  it("resets dependent selectors in ConditionalLoop rule helpers", () => {
    const conditions: LoopCondition[] = [
      {
        id: 1,
        rules: [
          {
            trialId: 1,
            column: "old_column",
            op: "==",
            value: "yes",
            prop: "response",
            fieldType: "components",
            componentIdx: "0",
          },
        ],
      },
    ];

    expect(loopRuleHelpers.updateTrialSelection(conditions, 1, 0, "2")[0].rules[0]).toEqual({
      trialId: "2",
      column: "old_column",
      op: "==",
      value: "",
      prop: "",
      fieldType: "",
      componentIdx: "",
    });
    expect(loopRuleHelpers.updateFieldType(conditions, 1, 0, "survey")[0].rules[0]).toEqual({
      trialId: 1,
      column: "old_column",
      op: "==",
      value: "",
      prop: "",
      fieldType: "survey",
      componentIdx: "",
    });
    expect(loopRuleHelpers.updateComponentIdx(conditions, 1, 0, "2")[0].rules[0]).toEqual({
      trialId: 1,
      column: "old_column",
      op: "==",
      value: "",
      prop: "",
      fieldType: "components",
      componentIdx: "2",
    });
    expect(loopRuleHelpers.updateProp(conditions, 1, 0, "rt")[0].rules[0]).toEqual({
      trialId: 1,
      column: "old_column",
      op: "==",
      value: "",
      prop: "rt",
      fieldType: "components",
      componentIdx: "0",
    });
  });
});
