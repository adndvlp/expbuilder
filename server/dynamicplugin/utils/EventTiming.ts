export const EVENT_TIMESTAMP_MAX_SKEW_MS = 60_000;

export type EventTimestampSource =
  | "event.timeStamp"
  | "performance.now_fallback";

export type EventTimestampInfo = {
  responseTime: number;
  handlerTime: number;
  source: EventTimestampSource;
  eventLag: number;
};

/**
 * The single implementation that validates `Event.timeStamp`.
 *
 * Valid timestamps share the `performance.now()` origin and lie within
 * EVENT_TIMESTAMP_MAX_SKEW_MS of the handler time. Anything else falls back
 * to the handler-time `performance.now()` sample.
 */
export function readEventTimestamp(
  event: Event,
  nowFn: () => number = () => performance.now(),
): EventTimestampInfo {
  const handlerTime = nowFn();
  const raw = event.timeStamp;
  const valid =
    typeof raw === "number" &&
    Number.isFinite(raw) &&
    raw > 0 &&
    Math.abs(raw - handlerTime) <= EVENT_TIMESTAMP_MAX_SKEW_MS;

  const responseTime = valid ? (raw as number) : handlerTime;
  return {
    responseTime,
    handlerTime,
    source: valid ? "event.timeStamp" : "performance.now_fallback",
    eventLag: handlerTime - responseTime,
  };
}
