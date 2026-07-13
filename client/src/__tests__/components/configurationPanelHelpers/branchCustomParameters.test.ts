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
      {
        id: 2,
        nextTrialId: 2,
        rules: [{ column: "rt", op: ">", value: "500" }],
        customParameters: {},
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
        conditions[1],
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
