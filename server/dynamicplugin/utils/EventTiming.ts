export const EVENT_TIMESTAMP_MAX_SKEW_MS = 60_000;

export type EventTimestampSource =
  | "event.timeStamp"
  | "explicit"
  | "performance.now_fallback";

export interface ParticipantResponseSignal {
  event?: Event;
  timestamp: number;
  timestampSource: EventTimestampSource;
  handlerTimestamp: number;
  eventLag: number;
  componentId?: string;
  eventType?: string;
}

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

export function createParticipantResponseSignal(
  event?: Event,
  options: {
    timestamp?: number;
    timestampSource?: EventTimestampSource;
    componentId?: string;
    eventType?: string;
    nowFn?: () => number;
  } = {},
): ParticipantResponseSignal {
  const nowFn = options.nowFn ?? (() => performance.now());
  if (typeof options.timestamp === "number" && Number.isFinite(options.timestamp)) {
    const handlerTimestamp = nowFn();
    return {
      event,
      timestamp: options.timestamp,
      timestampSource: options.timestampSource ?? "explicit",
      handlerTimestamp,
      eventLag: handlerTimestamp - options.timestamp,
      componentId: options.componentId,
      eventType: options.eventType ?? event?.type,
    };
  }
  if (event) {
    const timestamp = readEventTimestamp(event, nowFn);
    return {
      event,
      timestamp: timestamp.responseTime,
      timestampSource: timestamp.source,
      handlerTimestamp: timestamp.handlerTime,
      eventLag: timestamp.eventLag,
      componentId: options.componentId,
      eventType: options.eventType ?? event.type,
    };
  }
  const handlerTimestamp = nowFn();
  return {
    timestamp: handlerTimestamp,
    timestampSource: "performance.now_fallback",
    handlerTimestamp,
    eventLag: 0,
    componentId: options.componentId,
    eventType: options.eventType,
  };
}

export function isParticipantResponseSignal(
  value: unknown,
): value is ParticipantResponseSignal {
  return (
    !!value &&
    typeof value === "object" &&
    typeof (value as ParticipantResponseSignal).timestamp === "number" &&
    typeof (value as ParticipantResponseSignal).timestampSource === "string"
  );
}
