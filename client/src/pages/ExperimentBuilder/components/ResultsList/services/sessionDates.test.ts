import { describe, expect, it } from "vitest";
import { formatSessionDate, sessionTimestamp } from "./sessionDates";

describe("session dates", () => {
  it("never renders Invalid Date for absent or malformed values", () => {
    expect(formatSessionDate(undefined)).toBe("Date unavailable")
    expect(formatSessionDate("")).toBe("Date unavailable")
    expect(formatSessionDate("not-a-date")).toBe("Date unavailable")
    expect(sessionTimestamp("not-a-date")).toBe(0)
  });

  it("formats valid persisted timestamps", () => {
    const value = "2024-01-01T12:00:00.000Z";
    expect(formatSessionDate(value)).not.toBe("Date unavailable")
    expect(sessionTimestamp(value)).toBe(Date.parse(value))
  });
});
