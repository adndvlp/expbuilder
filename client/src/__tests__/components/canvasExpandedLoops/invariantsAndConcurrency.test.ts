import { act } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { TimelineItem } from "../../../pages/ExperimentBuilder/contexts/TrialsContext";
import {
  loopReference,
  pathIds,
  setupExpandedLoopPath,
  trialItem,
} from "./testHarness";

const deferred = <Value,>() => {
  let resolve!: (value: Value) => void;
  let reject!: (cause: unknown) => void;
  const promise = new Promise<Value>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
};

describe("useExpandedLoopPath invariants and concurrency", () => {
  it("rejects operations for scopes that are not in the visible path", async () => {
    const { result, loadLoopItems } = setupExpandedLoopPath();

    await act(async () => {
      expect(
        await result.current.expandLoop(loopReference("child"), "missing-parent"),
      ).toBe(false);
    });
    expect(result.current.error?.operation).toBe("expand");

    await act(async () => {
      expect(await result.current.activateScope("missing")).toBe(false);
    });
    expect(result.current.error?.operation).toBe("activate");

    await act(async () => {
      expect(await result.current.collapseLoop("missing")).toBe(false);
    });
    expect(result.current.error?.operation).toBe("collapse");

    await act(async () => {
      expect(await result.current.refreshLoop("missing")).toBe(false);
    });
    expect(result.current.error?.operation).toBe("refresh");
    expect(await result.current.refreshLoop()).toBe(false);
    expect(result.current.syncActiveItems([])).toBe(false);
    expect(loadLoopItems).not.toHaveBeenCalled();
  });

  it("trims sibling descendants and prevents duplicate scopes in a cycle", async () => {
    const updatedParentItems = [trialItem("parent-updated")];
    const { result, loadLoopItems } = setupExpandedLoopPath();
    loadLoopItems
      .mockResolvedValueOnce([trialItem("parent")])
      .mockResolvedValueOnce([trialItem("child")])
      .mockResolvedValueOnce([trialItem("grandchild")])
      .mockResolvedValueOnce([trialItem("sibling")])
      .mockResolvedValueOnce(updatedParentItems);

    await act(async () => {
      await result.current.expandLoop(loopReference("parent"));
      await result.current.expandLoop(loopReference("child"), "parent");
      await result.current.expandLoop(loopReference("grandchild"), "child");
      await result.current.expandLoop(loopReference("sibling"), "parent");
    });
    expect(pathIds(result.current.expandedPath)).toEqual(["parent", "sibling"]);

    await act(async () => {
      await result.current.expandLoop(loopReference("parent"), "sibling");
    });
    expect(pathIds(result.current.expandedPath)).toEqual(["parent"]);
    expect(result.current.expandedPath[0].loop.parentLoopId).toBeNull();
    expect(result.current.expandedPath[0].items).toEqual(updatedParentItems);
    expect(result.current.activeEntry?.loop.id).toBe("parent");
  });

  it("matches numeric and string forms of the same scope id", async () => {
    const { result, loadLoopItems } = setupExpandedLoopPath();
    loadLoopItems.mockResolvedValue([]);

    await act(async () => {
      await result.current.expandLoop({ id: 1, name: "Parent" });
      expect(
        await result.current.expandLoop(loopReference("child"), "1"),
      ).toBe(true);
    });

    expect(pathIds(result.current.expandedPath)).toEqual([1, "child"]);
  });

  it("supports collapsing the whole route and an already empty route", async () => {
    const { result, loadLoopItems, activateRoot } = setupExpandedLoopPath();
    loadLoopItems.mockResolvedValue([trialItem("parent")]);

    await act(async () => {
      await result.current.expandLoop(loopReference("parent"));
      expect(await result.current.collapseAll()).toBe(true);
      expect(await result.current.collapseAll()).toBe(true);
    });

    expect(result.current.expandedPath).toEqual([]);
    expect(result.current.activeScopeId).toBeNull();
    expect(activateRoot).toHaveBeenCalledTimes(2);
  });

  it("keeps cached items when activation or refresh fails", async () => {
    const cachedItems = [trialItem("cached")];
    const activateFailure = new Error("activation failed");
    const refreshFailure = new Error("refresh failed");
    const { result, loadLoopItems } = setupExpandedLoopPath();
    loadLoopItems
      .mockResolvedValueOnce(cachedItems)
      .mockRejectedValueOnce(activateFailure)
      .mockRejectedValueOnce(refreshFailure);

    await act(async () => {
      await result.current.expandLoop(loopReference("parent"));
      expect(await result.current.activateScope("parent")).toBe(false);
    });
    expect(result.current.error?.cause).toBe(activateFailure);

    await act(async () => {
      expect(await result.current.refreshLoop("parent")).toBe(false);
    });
    expect(result.current.expandedPath[0].items).toEqual(cachedItems);
    expect(result.current.activeScopeId).toBe("parent");
    expect(result.current.error?.cause).toBe(refreshFailure);
  });

  it("ignores a stale successful loop request after a newer expansion wins", async () => {
    const slowItems = deferred<TimelineItem[]>();
    const { result, loadLoopItems } = setupExpandedLoopPath();
    loadLoopItems
      .mockImplementationOnce(() => slowItems.promise)
      .mockResolvedValueOnce([trialItem("winner")]);

    let slowExpansion!: Promise<boolean>;
    act(() => {
      slowExpansion = result.current.expandLoop(loopReference("slow"));
    });
    expect(result.current.pending?.scopeId).toBe("slow");
    expect(result.current.isLoading).toBe(true);

    await act(async () => {
      expect(await result.current.expandLoop(loopReference("winner"))).toBe(true);
    });
    slowItems.resolve([trialItem("slow")]);
    await act(async () => {
      expect(await slowExpansion).toBe(false);
    });

    expect(pathIds(result.current.expandedPath)).toEqual(["winner"]);
    expect(result.current.pending).toBeNull();
  });

  it("ignores stale root failures after a newer expansion wins", async () => {
    const slowRoot = deferred<void>();
    const { result, loadLoopItems, activateRoot } = setupExpandedLoopPath();
    activateRoot.mockImplementationOnce(() => slowRoot.promise);
    loadLoopItems.mockResolvedValueOnce([trialItem("winner")]);

    let rootActivation!: Promise<boolean>;
    act(() => {
      rootActivation = result.current.activateScope(null);
    });
    await act(async () => {
      await result.current.expandLoop(loopReference("winner"));
    });
    slowRoot.reject(new Error("obsolete root failure"));
    await act(async () => {
      expect(await rootActivation).toBe(false);
    });

    expect(pathIds(result.current.expandedPath)).toEqual(["winner"]);
    expect(result.current.error).toBeNull();
  });

  it("works without a root activation callback", async () => {
    const loadLoopItems = vi.fn().mockResolvedValue([trialItem("parent")]);
    const { result } = setupExpandedLoopPath();
    result.current.clearError();
    expect(loadLoopItems).not.toHaveBeenCalled();
  });
});
