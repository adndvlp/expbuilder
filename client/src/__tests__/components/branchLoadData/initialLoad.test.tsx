import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type {
  BranchCondition,
} from "../../../pages/ExperimentBuilder/components/ConfigurationPanel/types";
import { useLoadDataHarness } from "./testHarness";

describe("BranchedTrial useLoadData initial loading", () => {
  it("does not load navigation conditions from loop containers", async () => {
    const loadTargetTrialParameters = vi.fn(async () => {});
    const { result } = renderHook(() =>
      useLoadDataHarness({
        selectedTrial: {
          id: "loop",
          trials: [],
          branchConditions: [{ id: 1, rules: [], nextTrialId: "invalid" }],
        },
        loadTargetTrialParameters,
      }),
    );
    await waitFor(() => expect(result.current.conditions).toEqual([]));
    expect(loadTargetTrialParameters).not.toHaveBeenCalled();
  });
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

  it("clears data without loading plugin metadata when the selected trial has no plugin", async () => {
    const loadPluginParameters = vi.fn(async () => ({
      parameters: [],
      data: [{ key: "unused", label: "Unused", type: "string" }],
    }));

    const { result } = renderHook(() =>
      useLoadDataHarness({
        selectedTrial: { id: "loop-trial", trials: [] },
        loadPluginParameters,
      }),
    );

    await waitFor(() => {
      expect(result.current.data).toEqual([]);
    });
    expect(result.current.error).toBeNull();
    expect(loadPluginParameters).not.toHaveBeenCalled();
  });

  it("opens without a selected trial without mutating conditions", async () => {
    const getLoopTimeline = vi.fn(async () => []);

    const { result } = renderHook(() =>
      useLoadDataHarness({
        selectedTrial: null,
        getLoopTimeline,
      }),
    );

    await waitFor(() => {
      expect(result.current.conditions).toEqual([]);
    });
    expect(getLoopTimeline).not.toHaveBeenCalled();
  });

  it("loads flat conditions and their destination parameters when the modal opens", async () => {
    const branchConditions: BranchCondition[] = [
      {
        id: 1,
        rules: [{ column: "response", op: "==", value: "left" }],
        nextTrialId: 2,
      },
    ];
    const additionalConditions: BranchCondition[] = [
      {
        id: 2,
        rules: [{ column: "rt", op: ">", value: "1000" }],
        nextTrialId: 99,
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
          branchConditions: [...branchConditions, ...additionalConditions],
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
  });

  it("keeps existing custom parameters and ignores branch conditions without a next trial", async () => {
    const loadTargetTrialParameters = vi.fn(async () => {});
    const getLoopTimeline = vi.fn(async () => []);

    const { result } = renderHook(() =>
      useLoadDataHarness({
        selectedTrial: {
          id: 10,
          plugin: "plugin-html-keyboard-response",
          branchConditions: [
            {
              id: 1,
              rules: [{ column: "response", op: "==", value: "left" }],
              customParameters: { stimulus: "custom" },
            },
          ],
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
          customParameters: { stimulus: "custom" },
        },
      ]);
    });
    expect(loadTargetTrialParameters).not.toHaveBeenCalled();
    expect(getLoopTimeline).not.toHaveBeenCalled();
  });
});
