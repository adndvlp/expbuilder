import { act } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  loopReference,
  pathIds,
  setupExpandedLoopPath,
  trialItem,
} from "./testHarness";

describe("useExpandedLoopPath expansion and activation", () => {
  it("keeps parent and nested loop items visible while only the nested scope is active", async () => {
    const parentItems = [trialItem("parent-trial")];
    const childItems = [trialItem("child-trial")];
    const { result, loadLoopItems } = setupExpandedLoopPath();
    loadLoopItems
      .mockResolvedValueOnce(parentItems)
      .mockResolvedValueOnce(childItems);

    await act(async () => {
      expect(await result.current.expandLoop(loopReference("parent"))).toBe(
        true,
      );
    });
    await act(async () => {
      expect(
        await result.current.expandLoop(loopReference("child"), "parent"),
      ).toBe(true);
    });

    expect(pathIds(result.current.expandedPath)).toEqual(["parent", "child"]);
    expect(result.current.expandedPath[0].items).toEqual(parentItems);
    expect(result.current.expandedPath[1].items).toEqual(childItems);
    expect(result.current.expandedPath[1].loop.parentLoopId).toBe("parent");
    expect(result.current.activeScopeId).toBe("child");
    expect(loadLoopItems).toHaveBeenNthCalledWith(1, "parent", {
      forceRefresh: false,
    });
    expect(loadLoopItems).toHaveBeenNthCalledWith(2, "child", {
      forceRefresh: false,
    });
  });

  it("replaces the expanded route when another root loop opens", async () => {
    const { result, loadLoopItems } = setupExpandedLoopPath();
    loadLoopItems
      .mockResolvedValueOnce([trialItem("parent-trial")])
      .mockResolvedValueOnce([trialItem("child-trial")])
      .mockResolvedValueOnce([trialItem("other-trial")]);

    await act(async () => {
      await result.current.expandLoop(loopReference("parent"));
      await result.current.expandLoop(loopReference("child"), "parent");
      await result.current.expandLoop(loopReference("other-root"));
    });

    expect(pathIds(result.current.expandedPath)).toEqual(["other-root"]);
    expect(result.current.expandedPath[0].items).toEqual([
      trialItem("other-trial"),
    ]);
    expect(result.current.activeScopeId).toBe("other-root");
  });

  it("activates an ancestor or root without hiding expanded descendants", async () => {
    const originalChildItems = [trialItem("child-trial")];
    const refreshedParentItems = [trialItem("updated-parent-trial")];
    const { result, loadLoopItems, activateRoot } = setupExpandedLoopPath();
    loadLoopItems
      .mockResolvedValueOnce([trialItem("parent-trial")])
      .mockResolvedValueOnce(originalChildItems)
      .mockResolvedValueOnce(refreshedParentItems);

    await act(async () => {
      await result.current.expandLoop(loopReference("parent"));
      await result.current.expandLoop(loopReference("child"), "parent");
      expect(await result.current.activateScope("parent")).toBe(true);
    });

    expect(pathIds(result.current.expandedPath)).toEqual(["parent", "child"]);
    expect(result.current.expandedPath[0].items).toEqual(refreshedParentItems);
    expect(result.current.expandedPath[1].items).toEqual(originalChildItems);
    expect(result.current.activeScopeId).toBe("parent");

    await act(async () => {
      expect(await result.current.activateScope(null)).toBe(true);
    });

    expect(pathIds(result.current.expandedPath)).toEqual(["parent", "child"]);
    expect(result.current.activeScopeId).toBeNull();
    expect(activateRoot).toHaveBeenCalledTimes(1);
  });
});
