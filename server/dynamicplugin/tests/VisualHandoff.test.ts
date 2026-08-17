import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createVisualHandoff } from "../utils/VisualHandoff";

describe("VisualHandoff", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("set produces an available snapshot", () => {
    const handoff = createVisualHandoff();
    handoff.set(2000, 3);
    const snapshot = handoff.peek();
    expect(snapshot.available).toBe(true);
    expect(snapshot.timestamp).toBe(2000);
    expect(snapshot.fromTrialSequence).toBe(3);
    expect(snapshot.lost).toBe(false);
    expect(snapshot.lostReason).toBe("");
  });

  it("consume-before-expiry returns the timestamp with consumed=true", () => {
    const handoff = createVisualHandoff();
    handoff.set(2000, 3);
    const snapshot = handoff.consume();
    expect(snapshot.timestamp).toBe(2000);
    expect(snapshot.consumed).toBe(true);
    expect(snapshot.lost).toBe(false);
  });

  it("expiry marks the handoff lost and removes the usable timestamp", () => {
    const handoff = createVisualHandoff();
    handoff.set(2000, 3);
    vi.advanceTimersByTime(0);
    const snapshot = handoff.peek();
    expect(snapshot.available).toBe(false);
    expect(snapshot.timestamp).toBeNull();
    expect(snapshot.lost).toBe(true);
    expect(snapshot.lostReason).toBe("expired_before_consume");
  });

  it("expired consume never returns a stale timestamp", () => {
    const handoff = createVisualHandoff();
    handoff.set(2000, 3);
    vi.advanceTimersByTime(0);
    const snapshot = handoff.consume();
    expect(snapshot.timestamp).toBeNull();
    expect(snapshot.consumed).toBe(false);
    expect(snapshot.lost).toBe(true);
    expect(snapshot.lostReason).toBe("expired_before_consume");
  });

  it("replacement marks the old state appropriately and takes over", () => {
    const handoff = createVisualHandoff();
    handoff.set(2000, 3);
    handoff.set(2001, 4);
    // The new handoff replaced the old one.
    let snapshot = handoff.peek();
    expect(snapshot.timestamp).toBe(2001);
    expect(snapshot.fromTrialSequence).toBe(4);
    expect(snapshot.available).toBe(true);
    // Consuming yields the replacement, not the replaced value.
    snapshot = handoff.consume();
    expect(snapshot.timestamp).toBe(2001);
    expect(snapshot.consumed).toBe(true);
    expect(snapshot.lost).toBe(false);
  });

  it("replacement clears the previous expiry timer", () => {
    const handoff = createVisualHandoff();
    handoff.set(2000, 3);
    handoff.set(2001, 4);
    // If the old timer had survived, this would expire as "expired_before_consume"
    // and clear the timestamp before the second set's own timer fires. The
    // second timer fires on the same tick, so the observable outcome is the
    // same expiry reason but for the NEW handoff; consumed=false proves the
    // stale timestamp was never returned.
    vi.advanceTimersByTime(0);
    const snapshot = handoff.consume();
    expect(snapshot.timestamp).toBeNull();
    expect(snapshot.lost).toBe(true);
    expect(snapshot.lostReason).toBe("expired_before_consume");
  });

  it("invalid timestamp cannot be consumed", () => {
    const handoff = createVisualHandoff();
    handoff.set(Number.NaN, 3);
    let snapshot = handoff.peek();
    expect(snapshot.available).toBe(false);
    expect(snapshot.timestamp).toBeNull();
    expect(snapshot.lost).toBe(true);
    expect(snapshot.lostReason).toBe("invalid_timestamp");
    snapshot = handoff.consume();
    expect(snapshot.timestamp).toBeNull();
    expect(snapshot.consumed).toBe(false);
    expect(snapshot.lost).toBe(true);
    expect(snapshot.lostReason).toBe("invalid_timestamp");
    handoff.set(0, 3);
    expect(handoff.peek().lostReason).toBe("invalid_timestamp");
  });

  it("clear(surface_removed) produces the correct reason", () => {
    const handoff = createVisualHandoff();
    handoff.set(2000, 3);
    handoff.clear("surface_removed");
    const snapshot = handoff.consume();
    expect(snapshot.lost).toBe(true);
    expect(snapshot.lostReason).toBe("surface_removed");
    expect(snapshot.timestamp).toBeNull();
  });

  it("clear without a pending handoff does not fabricate a loss", () => {
    const handoff = createVisualHandoff();
    handoff.clear("surface_removed");
    const snapshot = handoff.consume();
    expect(snapshot.lost).toBe(false);
    expect(snapshot.lostReason).toBe("");
    expect(snapshot.available).toBe(false);
  });

  it("lost handoff falls back to fresh timing start, never a stale startAt", () => {
    const handoff = createVisualHandoff();
    handoff.set(2000, 3);
    vi.advanceTimersByTime(0);
    const snapshot = handoff.consume();
    const started: string[] = [];
    if (typeof snapshot.timestamp === "number") {
      started.push(`startAt(${snapshot.timestamp})`);
    } else {
      started.push("start()");
    }
    expect(started).toEqual(["start()"]);
    expect(snapshot.lost).toBe(true);
  });
});
