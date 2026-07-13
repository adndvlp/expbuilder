import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

type EffectCallback = () => void | (() => void);

describe("BranchedTrial useLoadData idempotency guard", () => {
  afterEach(() => {
    vi.doUnmock("react");
    vi.resetModules();
  });

  it("skips the second open-load effect execution on a replayed mount", async () => {
    vi.resetModules();
    const actualReact = await vi.importActual<typeof import("react")>("react");
    vi.doMock("react", () => ({
      ...actualReact,
      useEffect: (callback: EffectCallback) => {
        callback();
        callback();
      },
    }));

    const { default: useLoadData } = await import(
      "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/BranchedTrial/useLoadData"
    );
    const setConditions = vi.fn();
    const setRepeatConditions = vi.fn();

    renderHook(() =>
      useLoadData({
        isOpen: true,
        conditions: [],
        selectedTrial: {
          id: 1,
          plugin: "plugin-html-keyboard-response",
          branchConditions: [],
        },
        targetTrialParameters: {},
        loadTargetTrialParameters: vi.fn(async () => {}),
        setData: vi.fn(),
        setError: vi.fn(),
        setLoading: vi.fn(),
        loadPluginParameters: vi.fn(async () => ({
          parameters: [],
          data: [],
        })),
        getLoopTimeline: vi.fn(async () => []),
        setConditions,
        setRepeatConditions,
      }),
    );

    expect(setConditions).toHaveBeenCalledTimes(1);
    expect(setRepeatConditions).toHaveBeenCalledTimes(1);
  });
});
