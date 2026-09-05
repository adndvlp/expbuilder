export type RuntimeBranchRule = {
  column?: string;
  componentIdx?: string;
  prop?: string;
  op: string;
  value: unknown;
};

export type RuntimeReferencedRule = RuntimeBranchRule & {
  trialId?: string | number | null;
};

export type RuntimeBranchCondition = {
  id?: string | number;
  rules?: RuntimeReferencedRule[];
  nextTrialId?: string | number | null;
  customParameters?: unknown;
};

export type RuntimeReferencedCondition = {
  id?: string | number;
  rules?: RuntimeReferencedRule[];
};

export type BranchDecision = {
  targetId: string | number | null;
  conditionId: string | number | null;
  customParameters: unknown;
  usedDefault: boolean;
};

export function readBranchRuleValue(
  trialData: Record<string, unknown>,
  rule: RuntimeBranchRule,
) {
  let column = rule.column || "";
  if (!column && rule.componentIdx && rule.prop) {
    column = `${rule.componentIdx}_${rule.prop}`;
  } else if (!column && rule.prop) {
    column = rule.prop;
  }
  if (!column) return undefined;
  if (trialData[column] !== undefined) return trialData[column];

  const parts = column.split("_");
  if (parts.length < 2) return undefined;
  const property = parts[parts.length - 1];
  const responseKey = `${parts.slice(0, -1).join("_")}_response`;
  const response = trialData[responseKey];
  if (!response || typeof response !== "object" || Array.isArray(response)) {
    return undefined;
  }
  return (response as Record<string, unknown>)[property];
}

export function compareBranchValue(value: unknown, rule: RuntimeBranchRule) {
  if (Array.isArray(value)) {
    const matches =
      value.includes(rule.value) || value.includes(String(rule.value));
    if (rule.op === "==") return matches;
    if (rule.op === "!=") return !matches;
    return false;
  }

  const left = Number.parseFloat(String(value));
  const right = Number.parseFloat(String(rule.value));
  const numeric = !Number.isNaN(left) && !Number.isNaN(right);
  switch (rule.op) {
    case "==":
      return numeric ? left === right : String(value) === String(rule.value);
    case "!=":
      return numeric ? left !== right : String(value) !== String(rule.value);
    case ">":
      return numeric && left > right;
    case "<":
      return numeric && left < right;
    case ">=":
      return numeric && left >= right;
    case "<=":
      return numeric && left <= right;
    default:
      return false;
  }
}

export function evaluateBranchCondition(
  trialData: Record<string, unknown>,
  condition: RuntimeBranchCondition,
) {
  if (!Array.isArray(condition.rules)) return false;
  return condition.rules.every((rule) => {
    const value = readBranchRuleValue(trialData, rule);
    return value !== undefined && compareBranchValue(value, rule);
  });
}

export function findLatestTrialData(
  rows: Array<Record<string, unknown>>,
  trialId: string | number,
) {
  for (let index = rows.length - 1; index >= 0; index -= 1) {
    const row = rows[index];
    const identities = [row.builder_id, row.trial_id, row.loop_id];
    if (identities.some((identity) => String(identity) === String(trialId))) {
      return row;
    }
  }
  return null;
}

export function evaluateReferencedCondition(
  rows: Array<Record<string, unknown>>,
  condition: RuntimeReferencedCondition,
) {
  if (!Array.isArray(condition.rules)) return false;
  return condition.rules.every((rule) => {
    if (rule.trialId === null || rule.trialId === undefined) return false;
    const trialData = findLatestTrialData(rows, rule.trialId);
    if (!trialData) return false;
    const value = readBranchRuleValue(trialData, rule);
    return value !== undefined && compareBranchValue(value, rule);
  });
}

export function decideBranch(
  trialData: Record<string, unknown>,
  branches: Array<string | number>,
  nestedConditions: Array<RuntimeBranchCondition | RuntimeBranchCondition[]>,
): BranchDecision {
  if (!Array.isArray(branches) || branches.length === 0) {
    return {
      targetId: null,
      conditionId: null,
      customParameters: null,
      usedDefault: false,
    };
  }

  const conditions: RuntimeBranchCondition[] = [];
  for (const entry of nestedConditions || []) {
    if (Array.isArray(entry)) conditions.push(...entry);
    else conditions.push(entry);
  }
  for (const condition of conditions) {
    if (!condition || !evaluateBranchCondition(trialData, condition)) continue;
    return {
      targetId: condition.nextTrialId ?? branches[0],
      conditionId: condition.id ?? null,
      customParameters: condition.customParameters ?? null,
      usedDefault: condition.nextTrialId === null || condition.nextTrialId === undefined,
    };
  }
  return {
    targetId: branches[0],
    conditionId: null,
    customParameters: null,
    usedDefault: true,
  };
}

export function getBranchEvaluatorRuntimeCode() {
  return `
    const readBranchRuleValue = ${readBranchRuleValue.toString()};
    const compareBranchValue = ${compareBranchValue.toString()};
    const evaluateBranchCondition = ${evaluateBranchCondition.toString()};
    const findLatestTrialData = ${findLatestTrialData.toString()};
    const evaluateReferencedCondition = ${evaluateReferencedCondition.toString()};
    const decideBranch = ${decideBranch.toString()};
    window.ExpBuilderBranching = {
      readRuleValue: readBranchRuleValue,
      compareValue: compareBranchValue,
      evaluateCondition: evaluateBranchCondition,
      evaluateReferencedCondition: evaluateReferencedCondition,
      decide: decideBranch
    };
  `;
}
