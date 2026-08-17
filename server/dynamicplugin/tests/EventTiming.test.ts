import { describe, expect, it, vi } from "vitest";
import {
  EVENT_TIMESTAMP_MAX_SKEW_MS,
  readEventTimestamp,
} from "../utils/EventTiming";

function eventWithTimestamp(timeStamp: unknown): Event {
  const event = new Event("input");
  Object.defineProperty(event, "timeStamp", { value: timeStamp });
  return event;
}

describe("EventTiming", () => {
  it("preserves a valid timestamp exactly", () => {
    const event = eventWithTimestamp(1250);
    const info = readEventTimestamp(event, () => 1260);
    expect(info.responseTime).toBe(1250);
    expect(info.handlerTime).toBe(1260);
    expect(info.source).toBe("event.timeStamp");
    expect(info.eventLag).toBe(10);
  });

  it("falls back for a zero timestamp", () => {
    const event = eventWithTimestamp(0);
    const info = readEventTimestamp(event, () => 1260);
    expect(info.responseTime).toBe(1260);
    expect(info.source).toBe("performance.now_fallback");
    expect(info.eventLag).toBe(0);
  });

  it("falls back for NaN", () => {
    const event = eventWithTimestamp(Number.NaN);
    const info = readEventTimestamp(event, () => 1260);
    expect(info.responseTime).toBe(1260);
    expect(info.source).toBe("performance.now_fallback");
  });

  it("falls back for Infinity", () => {
    const event = eventWithTimestamp(Number.POSITIVE_INFINITY);
    const info = readEventTimestamp(event, () => 1260);
    expect(info.responseTime).toBe(1260);
    expect(info.source).toBe("performance.now_fallback");
  });

  it("accepts the +60,000 ms skew boundary", () => {
    const event = eventWithTimestamp(1260 + EVENT_TIMESTAMP_MAX_SKEW_MS);
    const info = readEventTimestamp(event, () => 1260);
    expect(info.responseTime).toBe(1260 + EVENT_TIMESTAMP_MAX_SKEW_MS);
    expect(info.source).toBe("event.timeStamp");
  });

  it("rejects skew beyond 60,000 ms", () => {
    const event = eventWithTimestamp(1260 + EVENT_TIMESTAMP_MAX_SKEW_MS + 1);
    const info = readEventTimestamp(event, () => 1260);
    expect(info.responseTime).toBe(1260);
    expect(info.source).toBe("performance.now_fallback");
  });

  it("rejects negative timestamps", () => {
    const event = eventWithTimestamp(-5);
    const info = readEventTimestamp(event, () => 1260);
    expect(info.responseTime).toBe(1260);
    expect(info.source).toBe("performance.now_fallback");
  });

  it("samples handler time exactly once", () => {
    const nowFn = vi.fn(() => 1260);
    const event = eventWithTimestamp(1250);
    readEventTimestamp(event, nowFn);
    expect(nowFn).toHaveBeenCalledTimes(1);
  });

  it("computes eventLag = handlerTime - responseTime", () => {
    const event = eventWithTimestamp(1240);
    const info = readEventTimestamp(event, () => 1260);
    expect(info.eventLag).toBe(1260 - 1240);
  });
});
