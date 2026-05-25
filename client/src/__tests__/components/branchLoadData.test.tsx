import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useState } from "react";
import useLoadData from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/BranchedTrial/useLoadData";
import type {
  BranchCondition,
  DataDefinition,
  RepeatCondition,
} from "../../pages/ExperimentBuilder/components/ConfigurationPanel/types";
import type {
  Condition,
  RepeatConditionState,
} from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/BranchedTrial/types";

function useLoadDataHarness({
  isOpen = true,
  selectedTrial,
  initialConditions = [],
  targetTrialParameters = {},
  loadTargetTrialParameters = vi.fn(async () => {}),
  loadPluginParameters = vi.fn(async () => ({
    parameters: [],
    data: [{ key: "response", label: "Response", type: "string" }],
  })),
  getLoopTimeline = vi.fn(async () => []),
}: {
  isOpen?: boolean;
  selectedTrial: any;
  initialConditions?: Condition[];
  targetTrialParameters?: Record<string, any[]>;
  loadTargetTrialParameters?: (trialId: string | number) => Promise<void>;
  loadPluginParameters?: (...args: any[]) => Promise<{
    parameters: any[];
    data: DataDefinition[];
  }>;
  getLoopTimeline?: (loopId: string | number) => Promise<any>;
}) {
  const [conditions, setConditions] = useState<Condition[]>(initialConditions);
  const [repeatConditions, setRepeatConditions] = useState<
    RepeatConditionState[]
  >([]);
  const [data, setData] = useState<DataDefinition[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useLoadData({
    isOpen,
    conditions,
    selectedTrial,
    targetTrialParameters,
    loadTargetTrialParameters,
    setData,
    setError,
    setLoading,
    loadPluginParameters,
    getLoopTimeline,
    setConditions,
    setRepeatConditions,
  });

  return {
    conditions,
    repeatConditions,
    data,
    error,
    loading,
    setConditions,
  };
}

describe("BranchedTrial useLoadData", () => {
  it("loads selected trial data fields from plugin metadata", async () => {
    const loadPluginParameters = vi.fn(async () => ({
      parameters: [],
      data: [
        { key: "response", label: "Response", type: "string" },
        { key: "rt", label: "RT", type: "number" },
      ],
    }));

    const { result } = renderHook(() =>
      useLoadDataHarness({
        selectedTrial: { id: 1, plugin: "plugin-html-keyboard-response" },
        loadPluginParameters,
      }),
    );

    await waitFor(() => {
      expect(result.current.data).toEqual([
        { key: "response", label: "Response", type: "string" },
        { key: "rt", label: "RT", type: "number" },
      ]);
    });

    expect(loadPluginParameters).toHaveBeenCalledWith(
      "plugin-html-keyboard-response",
    );
    expect(result.current.error).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it("reports plugin metadata loading errors and clears data", async () => {
    const loadPluginParameters = vi.fn(async () => {
      throw new Error("metadata failed");
    });

    const { result } = renderHook(() =>
      useLoadDataHarness({
        selectedTrial: { id: 1, plugin: "plugin-broken" },
        loadPluginParameters,
      }),
    );

    await waitFor(() => {
      expect(result.current.error).toBe("metadata failed");
    });

    expect(result.current.data).toEqual([]);
    expect(result.current.loading).toBe(false);
  });

  it("merges branch and repeat conditions when the modal opens", async () => {
    const branchConditions: BranchCondition[] = [
      {
        id: 1,
        rules: [{ column: "response", op: "==", value: "left" }],
        nextTrialId: 2,
      },
    ];
    const repeatConditions: RepeatCondition[] = [
      {
        id: 2,
        rules: [{ column: "rt", op: ">", value: "1000" }],
        jumpToTrialId: 99,
      },
    ];
    const loadTargetTrialParameters = vi.fn(async () => {});
    const getLoopTimeline = vi.fn(async () => []);

    const { result } = renderHook(() =>
      useLoadDataHarness({
        selectedTrial: {
          id: 10,
          plugin: "plugin-html-keyboard-response",
          parentLoopId: "loop_1",
          branchConditions,
          repeatConditions,
        },
        loadTargetTrialParameters,
        getLoopTimeline,
      }),
    );

    await waitFor(() => {
      expect(result.current.conditions).toEqual([
        {
          id: 1,
          rules: [{ column: "response", op: "==", value: "left" }],
          nextTrialId: 2,
          customParameters: {},
        },
        {
          id: 2,
          rules: [{ column: "rt", op: ">", value: "1000" }],
          nextTrialId: 99,
          customParameters: {},
        },
      ]);
    });

    expect(getLoopTimeline).toHaveBeenCalledWith("loop_1");
    expect(loadTargetTrialParameters).toHaveBeenCalledWith(2);
    expect(result.current.repeatConditions).toEqual(repeatConditions);
  });

  it("loads target parameters when conditions change and skips already loaded targets", async () => {
    const loadTargetTrialParameters = vi.fn(async () => {});
    const targetTrialParameters = {
      2: [{ key: "stimulus", label: "Stimulus", type: "html_string" }],
    };

    renderHook(() =>
      useLoadDataHarness({
        selectedTrial: { id: 10, plugin: "plugin-html-keyboard-response" },
        initialConditions: [
          {
            id: 1,
            rules: [{ column: "response", op: "==", value: "left" }],
            nextTrialId: 2,
          },
          {
            id: 2,
            rules: [{ column: "response", op: "==", value: "right" }],
            nextTrialId: 3,
          },
        ],
        targetTrialParameters,
        loadTargetTrialParameters,
      }),
    );

    await waitFor(() => {
      expect(loadTargetTrialParameters).toHaveBeenCalledWith(3);
    });
    expect(loadTargetTrialParameters).not.toHaveBeenCalledWith(2);
  });

  it("resets its open guard when the modal closes and reloads on reopen", async () => {
    const selectedTrial = {
      id: 10,
      plugin: "plugin-html-keyboard-response",
      branchConditions: [
        {
          id: 1,
          rules: [{ column: "response", op: "==", value: "left" }],
          nextTrialId: 2,
        },
      ],
    };
    const loadTargetTrialParameters = vi.fn(async () => {});

    const { rerender } = renderHook(
      ({ isOpen }) =>
        useLoadDataHarness({
          isOpen,
          selectedTrial,
          loadTargetTrialParameters,
        }),
      { initialProps: { isOpen: true } },
    );

    await waitFor(() => {
      expect(loadTargetTrialParameters).toHaveBeenCalledTimes(1);
    });

    rerender({ isOpen: true });
    expect(loadTargetTrialParameters).toHaveBeenCalledTimes(1);

    rerender({ isOpen: false });
    rerender({ isOpen: true });

    await waitFor(() => {
      expect(loadTargetTrialParameters).toHaveBeenCalledTimes(2);
    });
  });
});
