import { describe, expect, it } from "vitest";
import {
  allowsJumpItem,
  createJumpRequest,
  enterJumpItem,
  observeJumpReload,
  type ExecutionAddress,
} from "./jumpRequest";

const nestedAddress: ExecutionAddress = {
  targetId: "target",
  targetKind: "trial",
  targetOwnerId: "inner",
  enterLoopIds: ["outer", "inner"],
};

describe("jump request path cursor", () => {
  it("[TJ-04] consumes each path segment and the final target exactly once", () => {
    const initial = createJumpRequest(
      nestedAddress,
      "revision-1",
      "source",
      7,
    );

    expect(allowsJumpItem(initial, "outer", "loop")).toBe(true);
    expect(initial.cursor).toEqual({ nextEnterIndex: 0, progress: 0 });

    const outer = enterJumpItem(initial, "outer", "loop");
    expect(outer).toMatchObject({
      allowed: true,
      consumed: "segment",
      segmentId: "outer",
      request: { cursor: { nextEnterIndex: 1, progress: 1 } },
    });
    expect(enterJumpItem(outer.request!, "outer", "loop").allowed).toBe(false);

    const inner = enterJumpItem(outer.request!, "inner", "loop");
    expect(inner).toMatchObject({
      allowed: true,
      consumed: "segment",
      segmentId: "inner",
      request: { cursor: { nextEnterIndex: 2, progress: 2 } },
    });
    expect(enterJumpItem(inner.request!, "target", "loop").allowed).toBe(false);

    expect(enterJumpItem(inner.request!, "target", "trial")).toEqual({
      allowed: true,
      consumed: "target",
      segmentId: null,
      request: null,
    });
  });

  it("[TJ-08] accepts a marked reload only when cursor progress changed", () => {
    const initial = createJumpRequest(
      nestedAddress,
      "revision-1",
      "source",
      7,
    );
    const firstReload = observeJumpReload(initial);
    expect(firstReload).toMatchObject({
      status: "ready",
      request: { reloadGuard: { observedProgress: 0 } },
    });
    expect(observeJumpReload(firstReload.request).status).toBe("stalled");

    const progressed = enterJumpItem(firstReload.request, "outer", "loop");
    const progressedReload = observeJumpReload(progressed.request!);
    expect(progressedReload).toMatchObject({
      status: "ready",
      request: {
        cursor: { nextEnterIndex: 0, progress: 1 },
        reloadGuard: { observedProgress: 1 },
      },
    });
    expect(observeJumpReload(progressedReload.request).status).toBe("stalled");
  });
});
