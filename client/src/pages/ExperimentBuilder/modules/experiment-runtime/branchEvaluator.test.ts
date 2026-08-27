import { describe, expect, it } from "vitest";
import {
  compareBranchValue,
  decideBranch,
  evaluateBranchCondition,
  evaluateReferencedCondition,
  findLatestTrialData,
  readBranchRuleValue,
} from "./branchEvaluator";

describe("canonical runtime branch evaluator", () => {
  it.each([
    [4, ">", "3", true],
    [4, "<", "3", false],
    [4, ">=", "4", true],
    [4, "<=", "4", true],
    ["yes", "==", "yes", true],
    ["yes", "!=", "no", true],
  ])("compares %j %s %j", (value, op, expected, result) => {
    expect(compareBranchValue(value, { op, value: expected })).toBe(result);
  });

  it("resolves direct, array, and nested survey response shapes", () => {
    const data = {
      response: "yes",
      ButtonResponseComponent_1_response: ["accept"],
      SurveyComponent_1_response: { consent: "yes" },
    };
    expect(readBranchRuleValue(data, { column: "response", op: "==", value: "yes" })).toBe("yes");
    expect(evaluateBranchCondition(data, {
      rules: [{ column: "ButtonResponseComponent_1_response", op: "==", value: "accept" }],
    })).toBe(true);
    expect(evaluateBranchCondition(data, {
      rules: [{ column: "SurveyComponent_1_consent", op: "==", value: "yes" }],
    })).toBe(true);
  });

  it("returns the matched route and parameters, or the explicit first-branch fallback", () => {
    const matched = decideBranch({ score: 8 }, [10, 20], [{
      id: 7,
      rules: [{ column: "score", op: ">=", value: 5 }],
      nextTrialId: 20,
      customParameters: { stimulus: "matched" },
    }]);
    const fallback = decideBranch({ score: 1 }, [10, 20], [{
      id: 7,
      rules: [{ column: "score", op: ">=", value: 5 }],
      nextTrialId: 20,
    }]);

    expect(matched).toEqual({
      targetId: 20,
      conditionId: 7,
      customParameters: { stimulus: "matched" },
      usedDefault: false,
    });
    expect(fallback).toEqual({
      targetId: 10,
      conditionId: null,
      customParameters: null,
      usedDefault: true,
    });
  });

  it("evaluates cross-trial conditions against the latest matching row", () => {
    const rows = [
      { builder_id: 1, response: "old" },
      { trial_id: 2, score: 8 },
      { builder_id: 1, response: "latest" },
    ];

    expect(findLatestTrialData(rows, 1)).toEqual(rows[2]);
    expect(evaluateReferencedCondition(rows, {
      rules: [
        { trialId: 1, column: "response", op: "==", value: "latest" },
        { trialId: 2, column: "score", op: ">=", value: "8" },
      ],
    })).toBe(true);
  });

  it("does not match a referenced rule without a trial identity or row", () => {
    expect(evaluateReferencedCondition([], {
      rules: [{ column: "response", op: "==", value: "yes" }],
    })).toBe(false);
    expect(evaluateReferencedCondition([{ builder_id: 1, response: "yes" }], {
      rules: [{ trialId: 2, column: "response", op: "==", value: "yes" }],
    })).toBe(false);
  });
});
