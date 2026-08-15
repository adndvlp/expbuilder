import { jest } from "@jest/globals";
import {
  formatSessionLog,
  logSessionEvent,
} from "../modules/session-persistence/sessionLog.js";

describe("session persistence diagnostics", () => {
  test("keeps identifiers and excludes scientific payloads", () => {
    const entry = formatSessionLog("trial-stored", {
      experimentID: "experiment-1",
      sessionId: "session-1",
      eventId: "event-4",
      sequence: 4,
      result: "stored",
      response: { answer: "private" },
      payload: { stimulus: "private" },
    });

    expect(entry).toMatchObject({
      event: "trial-stored",
      experimentID: "experiment-1",
      sessionId: "session-1",
      eventId: "event-4",
      sequence: 4,
      result: "stored",
    });
    expect(entry).not.toHaveProperty("response");
    expect(entry).not.toHaveProperty("payload");
    expect(Number.isNaN(Date.parse(entry.timestamp))).toBe(false);
  });

  test("normalizes errors and stays quiet in the test environment", () => {
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    const entry = logSessionEvent("error", "trial-failed", {
      error: new Error("database unavailable"),
    });

    expect(entry.error).toBe("database unavailable");
    expect(errorSpy).not.toHaveBeenCalled();
  });
});
