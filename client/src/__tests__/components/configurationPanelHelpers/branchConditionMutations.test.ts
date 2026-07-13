import {
  act,
  afterEach,
  describe,
  expect,
  it,
  renderHook,
  useBranchConditions,
  vi,
} from "./testHarness";
import type { Condition } from "./testHarness";

describe("useBranchConditions", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("adds/removes conditions and rules and updates rule fields", () => {
    vi.spyOn(Date, "now").mockReturnValue(777);
    const loadTargetTrialParameters = vi.fn();
    const setConditionsWrapper = vi.fn();
    const conditions: Condition[] = [
      {
        id: 1,
        nextTrialId: 2,
        rules: [
          { column: "response", op: "==", value: "yes" },
          { column: "rt", op: ">", value: 100 },
        ],
        customParameters: {},
      },
      {
        id: 2,
        nextTrialId: null,
        rules: [{ column: "score", op: "==", value: "ok" }],
        customParameters: {},
      },
    ];

    const { result } = renderHook(() =>
      useBranchConditions({
        loadTargetTrialParameters,
        setConditionsWrapper,
        conditions,
        targetTrialParameters: {},
      }),
    );

    act(() => {
      result.current.addCondition();
    });
    expect(setConditionsWrapper).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          id: 777,
          rules: [{ column: "", op: "==", value: "" }],
          nextTrialId: null,
        }),
      ]),
    );

    act(() => {
      result.current.removeCondition(2);
    });
    expect(setConditionsWrapper).toHaveBeenCalledWith([conditions[0]]);

    act(() => {
      result.current.addRuleToCondition(1);
    });
    expect(setConditionsWrapper).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          rules: [...conditions[0].rules, { column: "", op: "==", value: "" }],
        }),
      ]),
    );

    act(() => {
      result.current.removeRuleFromCondition(1, 0);
    });
    expect(setConditionsWrapper).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          rules: [{ column: "rt", op: ">", value: 100 }],
        }),
      ]),
    );

    act(() => {
      result.current.updateRule(1, 1, "value", 250, false);
    });
    expect(setConditionsWrapper).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          rules: [
            conditions[0].rules[0],
            { column: "rt", op: ">", value: 250 },
          ],
        }),
      ]),
      false,
    );
  });

  it("does not add unavailable normal custom parameters or load blank targets", () => {
    const loadTargetTrialParameters = vi.fn();
    const setConditionsWrapper = vi.fn();
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

    const { result } = renderHook(() =>
      useBranchConditions({
        loadTargetTrialParameters,
        setConditionsWrapper,
        conditions,
        targetTrialParameters: {
          2: [{ key: "stimulus", label: "Stimulus", type: "html_string" }],
        },
      }),
    );

    act(() => {
      result.current.addCustomParameter(1, false);
    });
    expect(setConditionsWrapper).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          customParameters: {
            stimulus: { source: "typed", value: "old" },
          },
        }),
      ],
      true,
    );

    act(() => {
      result.current.updateNextTrial(1, "");
    });
    expect(loadTargetTrialParameters).not.toHaveBeenCalled();
  });

  it("handles missing target metadata and preserves unrelated conditions", () => {
    const loadTargetTrialParameters = vi.fn();
    const setConditionsWrapper = vi.fn();
    const conditions: Condition[] = [
      {
        id: 1,
        nextTrialId: null,
        rules: [{ column: "response", op: "==", value: "yes" }],
        customParameters: undefined as any,
      },
      {
        id: 2,
        nextTrialId: 3,
        rules: [{ column: "rt", op: ">", value: 100 }],
        customParameters: {},
      },
    ];
    const { result } = renderHook(() =>
      useBranchConditions({
        loadTargetTrialParameters,
        setConditionsWrapper,
        conditions,
        targetTrialParameters: {},
      }),
    );

    act(() => {
      result.current.addCustomParameter(1, false);
      result.current.updateNextTrial(1, "");
    });

    expect(setConditionsWrapper).toHaveBeenNthCalledWith(
      1,
      [expect.objectContaining({ id: 1, customParameters: {} }), conditions[1]],
      true,
    );
    expect(setConditionsWrapper).toHaveBeenNthCalledWith(
      2,
      [
        expect.objectContaining({
          id: 1,
          nextTrialId: "",
          customParameters: {},
        }),
        conditions[1],
      ],
      true,
    );
    expect(loadTargetTrialParameters).not.toHaveBeenCalled();
  });
});
