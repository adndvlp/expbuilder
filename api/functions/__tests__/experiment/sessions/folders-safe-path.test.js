import { describe, expect, test } from "@jest/globals";
import { isSafeFolderPath } from "../../../experiment/sessions/services/folders/helpers.js";

describe("isSafeFolderPath", () => {
  test("accepts folder paths with hyphens, spaces and underscores", () => {
    expect(isSafeFolderPath("/ExpBuilder/my-experiment_1")).toBe(true);
    expect(isSafeFolderPath("/ExpBuilder/My Experiment (2026)")).toBe(true);
    expect(isSafeFolderPath("ExpBuilder/nested/folder")).toBe(true);
  });

  test("rejects traversal, backslashes, control chars and bad lengths", () => {
    expect(isSafeFolderPath("/ExpBuilder/../secrets")).toBe(false);
    expect(isSafeFolderPath("C:\\Users\\data")).toBe(false);
    expect(isSafeFolderPath("/ExpBuilder/bad\u0000name")).toBe(false);
    expect(isSafeFolderPath("/ExpBuilder/bad\u001Fname")).toBe(false);
    expect(isSafeFolderPath("")).toBe(false);
    expect(isSafeFolderPath("/")).toBe(false);
    expect(isSafeFolderPath(`/${"a".repeat(210)}`)).toBe(false);
    expect(isSafeFolderPath(`/${"a".repeat(1025)}`)).toBe(false);
  });
});
