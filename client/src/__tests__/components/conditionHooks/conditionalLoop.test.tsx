import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  currentParameters,
  installTrialsContext,
  mocks,
  previousData,
  useConditionalLoopHarness,
} from "./testHarness";
import type { Loop, LoopCondition } from "./testHarness";

const useConditionalLoop = useConditionalLoopHarness;

describe("condition hooks: ConditionalLoop", () => {
  it("loads ConditionalLoop conditions, filters used targets and loads loop/trial metadata", async () => {
    const loopCondition: LoopCondition = {
      id: 1,
      rules: [{ trialId: 1, column: "response", op: "==", value: "yes" }],
    };
    const loop = {
      id: "loop_1",
      name: "Parent Loop",
      loopConditions: [loopCondition],
    } as Loop;
    const onSave = vi.fn();

    const { result } = renderHook(() => useConditionalLoop(loop, onSave));

    await waitFor(() => {
      expect(result.current.trialDataFields[1]).toEqual(previousData);
    });

    expect(mocks.trialsContext.getLoopTimeline).toHaveBeenCalledWith("loop_1");
    expect(result.current.conditions).toEqual([loopCondition]);
    expect(result.current.getAvailableTrials(1)).toEqual([
      { id: 2, name: "Loop Prime" },
      { id: 3, name: "Loop Current" },
      { id: "loop_2", name: "Nested Loop" },
    ]);

    let nestedLoop: unknown;
    await act(async () => {
      nestedLoop = await result.current.loadTrialOrLoop("loop_2");
    });

    expect(mocks.trialsContext.getLoop).toHaveBeenCalledWith("loop_2");
    expect(nestedLoop).toEqual({
      id: "loop_2",
      name: "Loop loop_2",
      trials: [],
    });

    let trial: unknown;
    await act(async () => {
      trial = await result.current.loadTrialOrLoop(2);
    });

    expect(mocks.trialsContext.getTrial).toHaveBeenCalledWith(2);
    expect(trial).toEqual({
      id: 2,
      name: "Trial 2",
      plugin: "plugin-previous",
    });
  });

  it("covers ConditionalLoop guards, cached lookups and explicit saves", async () => {
    const getTrial = vi.fn(async (id: string | number) => {
      if (id === 404) return null;
      if (id === 405) throw new Error("lookup failed");
      if (id === 406) return { id, name: "No Plugin" };
      if (id === 407)
        return { id, name: "Broken Metadata", plugin: "plugin-broken" };
      return {
        id,
        name: `Trial ${id}`,
        plugin: "plugin-previous",
      };
    });
    installTrialsContext({ getTrial });
    mocks.loadPluginParameters.mockImplementation(
      async (pluginName: string) => {
        if (pluginName === "plugin-broken") {
          throw new Error("metadata failed");
        }
        return { parameters: currentParameters, data: previousData };
      },
    );
    const loop = {
      id: "loop_1",
      name: "Parent Loop",
    } as Loop;
    const onSave = vi.fn();

    const { result } = renderHook(() => useConditionalLoop(loop, onSave));

    await waitFor(() => {
      expect(result.current.conditions).toEqual([]);
    });

    await act(async () => {
      await result.current.loadTrialDataFields(4);
    });
    await waitFor(() => {
      expect(result.current.trialDataFields[4]).toEqual(previousData);
    });

    expect(result.current.findTrialByIdSync(null)).toBeNull();
    expect(result.current.findTrialByIdSync(4)).toEqual(
      expect.objectContaining({ id: 4, plugin: "plugin-previous" }),
    );
    expect(result.current.findTrialByIdSync(999)).toBeNull();
    expect(result.current.getAvailableTrials(999)).toEqual([
      { id: 1, name: "Loop Intro" },
      { id: 2, name: "Loop Prime" },
      { id: 3, name: "Loop Current" },
      { id: "loop_2", name: "Nested Loop" },
    ]);

    await act(async () => {
      await result.current.loadTrialDataFields(4);
    });
    expect(getTrial).toHaveBeenCalledWith(4);
    expect(getTrial.mock.calls.filter(([id]) => id === 4)).toHaveLength(1);

    await expect(result.current.loadTrialOrLoop(4)).resolves.toEqual(
      expect.objectContaining({ id: 4, plugin: "plugin-previous" }),
    );
    await expect(result.current.loadTrialOrLoop(404)).resolves.toBeNull();
    await expect(result.current.loadTrialOrLoop(405)).resolves.toBeNull();

    await act(async () => {
      await result.current.loadTrialDataFields(406);
      await result.current.loadTrialDataFields(407);
    });

    expect(console.log).toHaveBeenCalledWith("Trial/Loop not found:", 404);
    expect(console.log).toHaveBeenCalledWith(
      "Trial not found or has no plugin:",
      406,
    );
    expect(console.error).toHaveBeenCalledWith(
      "Error loading trial/loop:",
      expect.any(Error),
    );
    expect(console.error).toHaveBeenCalledWith(
      "Error loading trial data fields:",
      expect.any(Error),
    );

    act(() => {
      result.current.triggerSave();
      result.current.setConditionsWrapper([], false);
    });

    expect(onSave).toHaveBeenCalledWith([]);
  });

  it("handles a ConditionalLoop without an id, target or active timeline", async () => {
    const loopCondition: LoopCondition = {
      id: 9,
      rules: [{ column: "response", op: "==", value: "yes" } as any],
    };
    const loop = {
      id: "",
      name: "Detached Loop",
      loopConditions: [loopCondition],
    } as Loop;

    const { result } = renderHook(() => useConditionalLoop(loop, vi.fn()));

    await waitFor(() => {
      expect(result.current.conditions).toEqual([loopCondition]);
    });

    expect(mocks.trialsContext.getLoopTimeline).not.toHaveBeenCalled();
    expect(result.current.getAvailableTrials(9)).toEqual([]);
  });

  it("autosaves ConditionalLoop updates through the provided onSave callback", () => {
    vi.useFakeTimers();
    const loop = {
      id: "loop_1",
      name: "Parent Loop",
      loopConditions: [],
    } as Loop;
    const onSave = vi.fn();
    const newConditions: LoopCondition[] = [
      {
        id: 2,
        rules: [{ trialId: 1, column: "rt", op: ">", value: "500" }],
      },
    ];

    const { result } = renderHook(() => useConditionalLoop(loop, onSave));

    act(() => {
      result.current.setConditionsWrapper(newConditions, true);
    });

    expect(result.current.conditions).toEqual(newConditions);

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(onSave).toHaveBeenCalledWith(newConditions);
    expect(result.current.saveIndicator).toBe(true);

    act(() => {
      vi.advanceTimersByTime(1500);
    });

    expect(result.current.saveIndicator).toBe(false);
  });
});
