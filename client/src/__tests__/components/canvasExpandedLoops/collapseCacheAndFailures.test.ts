import { act } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  loopReference,
  pathIds,
  setupExpandedLoopPath,
  trialItem,
} from "./testHarness";

describe("useExpandedLoopPath collapse, cache and failures", () => {
  it("collapses an ancestor with every descendant and activates its parent", async () => {
    const refreshedParentItems = [trialItem("parent-refreshed")];
    const { result, loadLoopItems, activateRoot } = setupExpandedLoopPath();
    loadLoopItems
      .mockResolvedValueOnce([trialItem("parent")])
      .mockResolvedValueOnce([trialItem("child")])
      .mockResolvedValueOnce([trialItem("grandchild")])
      .mockResolvedValueOnce(refreshedParentItems);

    await act(async () => {
      await result.current.expandLoop(loopReference("parent"));
      await result.current.expandLoop(loopReference("child"), "parent");
      await result.current.expandLoop(loopReference("grandchild"), "child");
      expect(await result.current.collapseLoop("child")).toBe(true);
    });

    expect(pathIds(result.current.expandedPath)).toEqual(["parent"]);
    expect(result.current.expandedPath[0].items).toEqual(refreshedParentItems);
    expect(result.current.activeScopeId).toBe("parent");

    await act(async () => {
      expect(await result.current.collapseLoop("parent")).toBe(true);
    });

    expect(result.current.expandedPath).toEqual([]);
    expect(result.current.activeScopeId).toBeNull();
    expect(activateRoot).toHaveBeenCalledTimes(1);
  });

  it("synchronizes cached items locally and refreshes them explicitly", async () => {
    const synchronizedItems = [trialItem("synchronized")];
    const refreshedItems = [trialItem("refreshed")];
    const activeItems = [trialItem("active-sync")];
    const { result, loadLoopItems } = setupExpandedLoopPath();
    loadLoopItems
      .mockResolvedValueOnce([trialItem("initial")])
      .mockResolvedValueOnce(refreshedItems);

    await act(async () => {
      await result.current.expandLoop(loopReference("parent"));
    });
    act(() => {
      expect(result.current.syncLoopItems("parent", synchronizedItems)).toBe(
        true,
      );
      expect(result.current.syncLoopItems("missing", [])).toBe(false);
    });

    expect(result.current.expandedPath[0].items).toEqual(synchronizedItems);
    expect(loadLoopItems).toHaveBeenCalledTimes(1);

    await act(async () => {
      expect(await result.current.refreshLoop()).toBe(true);
    });

    expect(result.current.expandedPath[0].items).toEqual(refreshedItems);
    expect(loadLoopItems).toHaveBeenLastCalledWith("parent", {
      forceRefresh: true,
    });

    act(() => {
      expect(result.current.syncActiveItems(activeItems)).toBe(true);
    });
    expect(result.current.expandedPath[0].items).toEqual(activeItems);
  });

  it("preserves the current route, active scope and cache when loading fails", async () => {
    const parentItems = [trialItem("parent")];
    const childItems = [trialItem("child")];
    const failure = new Error("network unavailable");
    const { result, loadLoopItems } = setupExpandedLoopPath();
    loadLoopItems
      .mockResolvedValueOnce(parentItems)
      .mockResolvedValueOnce(childItems)
      .mockRejectedValueOnce(failure);

    await act(async () => {
      await result.current.expandLoop(loopReference("parent"));
      await result.current.expandLoop(loopReference("child"), "parent");
      expect(await result.current.expandLoop(loopReference("other-root"))).toBe(
        false,
      );
    });

    expect(pathIds(result.current.expandedPath)).toEqual(["parent", "child"]);
    expect(result.current.expandedPath[0].items).toEqual(parentItems);
    expect(result.current.expandedPath[1].items).toEqual(childItems);
    expect(result.current.activeScopeId).toBe("child");
    expect(result.current.pending).toBeNull();
    expect(result.current.error).toEqual({
      operation: "expand",
      scopeId: "other-root",
      cause: failure,
    });

    act(() => result.current.clearError());
    expect(result.current.error).toBeNull();
  });

  it("does not collapse a route when reactivating its parent fails", async () => {
    const failure = new Error("parent reload failed");
    const { result, loadLoopItems } = setupExpandedLoopPath();
    loadLoopItems
      .mockResolvedValueOnce([trialItem("parent")])
      .mockResolvedValueOnce([trialItem("child")])
      .mockRejectedValueOnce(failure);

    await act(async () => {
      await result.current.expandLoop(loopReference("parent"));
      await result.current.expandLoop(loopReference("child"), "parent");
      expect(await result.current.collapseLoop("child")).toBe(false);
    });

    expect(pathIds(result.current.expandedPath)).toEqual(["parent", "child"]);
    expect(result.current.activeScopeId).toBe("child");
    expect(result.current.error).toEqual({
      operation: "collapse",
      scopeId: "parent",
      cause: failure,
    });
  });

  it("reconciles renamed scopes and prunes entries removed from their parent", async () => {
    const { result, loadLoopItems } = setupExpandedLoopPath();
    loadLoopItems
      .mockResolvedValueOnce([
        { id: "child", type: "loop", name: "Child original" },
      ])
      .mockResolvedValueOnce([trialItem("inside-child")]);

    await act(async () => {
      await result.current.expandLoop(loopReference("parent", "Parent original"));
      await result.current.expandLoop(
        loopReference("child", "Child original"),
        "parent",
      );
    });

    act(() => {
      result.current.reconcilePath([
        { id: "parent", type: "loop", name: "Parent renamed" },
      ]);
    });
    expect(result.current.expandedPath.map((entry) => entry.loop.name)).toEqual([
      "Parent renamed",
      "Child original",
    ]);

    act(() => {
      result.current.syncLoopItems("parent", []);
      result.current.reconcilePath([
        { id: "parent", type: "loop", name: "Parent renamed" },
      ]);
    });
    expect(pathIds(result.current.expandedPath)).toEqual(["parent"]);
    expect(result.current.activeScopeId).toBe("parent");

    act(() => result.current.reconcilePath([]));
    expect(result.current.expandedPath).toEqual([]);
    expect(result.current.activeScopeId).toBeNull();
  });
});
