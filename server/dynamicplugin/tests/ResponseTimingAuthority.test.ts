import { describe, expect, it } from "vitest";
import {
  getResponseRT,
  setResponseStartTime,
} from "../utils/PrecisionTiming";
import type { ParticipantResponseSignal } from "../utils/EventTiming";

describe("mandatory global response timing authority", () => {
  const signal: ParticipantResponseSignal = {
    timestamp: 110,
    handlerTimestamp: 120,
    eventLag: 10,
    timestampSource: "explicit",
    eventType: "submit",
  };

  it("fails fast when response onset is initialized without FrameEngine", () => {
    expect(() => setResponseStartTime({}, null)).toThrow(
      "response_timing_requires_global_frame_engine",
    );
  });

  it("does not use performance.now when a component loses timing authority", () => {
    expect(() =>
      getResponseRT(
        {},
        { isGlobalFrameEngine: () => false, getOnsetTime: () => 100 },
        signal,
      ),
    ).toThrow("response_timing_requires_global_frame_engine");
  });

  it("uses the existing signal without resampling handler time", () => {
    const target: Record<string, unknown> = {};
    const rt = getResponseRT(
      target,
      { isGlobalFrameEngine: () => true, getOnsetTime: () => 100 },
      signal,
    );
    expect(rt).toBe(10);
    expect(target.responseTimestampSource).toBe("explicit");
    expect(target.responseSignal).toBe(signal);
  });
});
