import { describe, expect, it } from "vitest";
import { getResumeResolver } from "./testHarness";

describe("resumeCode", () => {
  it("returns null for missing, corrupt or terminal resume data", () => {
    const resolveResumeBranch = getResumeResolver();

    expect(resolveResumeBranch(null)).toBeNull();
    expect(resolveResumeBranch("not-json")).toBeNull();
    expect(
      resolveResumeBranch(JSON.stringify({ branches: [], trialData: {} })),
    ).toBeNull();
  });

  it("returns the only branch without evaluating conditions", () => {
    const resolveResumeBranch = getResumeResolver();

    expect(
      resolveResumeBranch(
        JSON.stringify({
          branches: [42],
          branchConditions: [],
          trialData: { response: "anything" },
        }),
      ),
    ).toBe("42");
  });

  it("uses matching condition.nextTrialId for multiple branches", () => {
    const resolveResumeBranch = getResumeResolver();

    expect(
      resolveResumeBranch(
        JSON.stringify({
          branches: [2, 3],
          branchConditions: [
            {
              id: 1,
              nextTrialId: 3,
              rules: [{ column: "response", op: "==", value: "yes" }],
            },
          ],
          trialData: { response: "yes" },
        }),
      ),
    ).toBe("3");
  });

  it("supports nested survey response fields and array comparisons", () => {
    const resolveResumeBranch = getResumeResolver();

    expect(
      resolveResumeBranch(
        JSON.stringify({
          branches: [2, 3],
          branchConditions: [
            {
              id: 1,
              nextTrialId: 3,
              rules: [
                {
                  column: "SurveyComponent_1_choice",
                  op: "==",
                  value: "blue",
                },
                {
                  column: "selected_values",
                  op: "==",
                  value: "ready",
                },
              ],
            },
          ],
          trialData: {
            SurveyComponent_1_response: { choice: "blue" },
            selected_values: ["ready", "go"],
          },
        }),
      ),
    ).toBe("3");
  });

  it("falls back to the first branch when no conditions match", () => {
    const resolveResumeBranch = getResumeResolver();

    expect(
      resolveResumeBranch(
        JSON.stringify({
          branches: [2, 3],
          branchConditions: [
            {
              id: 1,
              nextTrialId: 3,
              rules: [{ column: "response", op: "==", value: "yes" }],
            },
          ],
          trialData: { response: "no" },
        }),
      ),
    ).toBe("2");
  });
});
