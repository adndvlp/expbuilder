import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useLoadDataHarness } from "./testHarness";

describe("BranchedTrial useLoadData target loading", () => {
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

  it("skips target requests that are already loaded from branch conditions", async () => {
    const loadTargetTrialParameters = vi.fn(async () => {});
    const targetTrialParameters = {
      2: [{ key: "stimulus", label: "Stimulus", type: "html_string" }],
    };

    renderHook(() =>
      useLoadDataHarness({
        selectedTrial: {
          id: 10,
          plugin: "plugin-html-keyboard-response",
          branchConditions: [
            {
              id: 1,
              rules: [{ column: "response", op: "==", value: "left" }],
              nextTrialId: 2,
            },
          ],
        },
        targetTrialParameters,
        loadTargetTrialParameters,
      }),
    );

    await waitFor(() => {
      expect(loadTargetTrialParameters).not.toHaveBeenCalled();
    });
  });

  it("allows retrying target parameter requests after a failed load", async () => {
    const loadTargetTrialParameters = vi
      .fn()
      .mockRejectedValueOnce(new Error("target failed"))
      .mockResolvedValueOnce(undefined);

    const { result } = renderHook(() =>
      useLoadDataHarness({
        selectedTrial: { id: 10, plugin: "plugin-html-keyboard-response" },
        initialConditions: [
          {
            id: 1,
            rules: [{ column: "response", op: "==", value: "left" }],
            nextTrialId: 4,
          },
        ],
        loadTargetTrialParameters,
      }),
    );

    await waitFor(() => {
      expect(loadTargetTrialParameters).toHaveBeenCalledTimes(1);
    });
    await Promise.resolve();

    act(() => {
      result.current.setConditions([
        {
          id: 2,
          rules: [{ column: "response", op: "==", value: "right" }],
          nextTrialId: 4,
        },
      ]);
    });

    await waitFor(() => {
      expect(loadTargetTrialParameters).toHaveBeenCalledTimes(2);
    });
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
