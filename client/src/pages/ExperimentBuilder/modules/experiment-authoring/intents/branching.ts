import type {
  BranchCondition,
  Loop,
  RepeatCondition,
  Trial,
} from "../../../components/ConfigurationPanel/types";
import type { Condition } from "../../../components/ConfigurationPanel/TrialsConfiguration/BranchedTrial/types";
import type { Parameter } from "../../../components/ConfigurationPanel/TrialsConfiguration/BranchedTrial/types";
import type { TimelineItem } from "../../../contexts/TrialsContext";
import {
  idsEqual,
  includesId,
  isForwardSameScopeTarget,
  itemIdKey,
} from "../../../utils/branchGraphUtils";

type BranchRuleField = keyof Condition["rules"][number];

export type BranchingSaveUpdates = {
  branches?: (string | number)[];
  branchConditions: BranchCondition[];
  repeatConditions: RepeatCondition[];
};

export type BranchingMutationDependencies = {
  updateTrial: (
    id: string | number,
    updates: Partial<Trial>,
  ) => Promise<unknown>;
  updateLoop: (
    id: string | number,
    updates: Partial<Loop>,
  ) => Promise<unknown>;
};

export function addBranchingCondition(
  conditions: Condition[],
  id = Date.now(),
): Condition[] {
  return [
    ...conditions,
    {
      id,
      rules: [{ column: "", op: "==", value: "" }],
      nextTrialId: null,
      customParameters: {},
    },
  ];
}

export function removeBranchingCondition(
  conditions: Condition[],
  conditionId: number,
): Condition[] {
  return conditions.filter((condition) => condition.id !== conditionId);
}

export function addBranchingRule(
  conditions: Condition[],
  conditionId: number,
): Condition[] {
  return conditions.map((condition) =>
    condition.id === conditionId
      ? {
          ...condition,
          rules: [
            ...condition.rules,
            { column: "", op: "==", value: "" },
          ],
        }
      : condition,
  );
}

export function removeBranchingRule(
  conditions: Condition[],
  conditionId: number,
  ruleIndex: number,
): Condition[] {
  return conditions.map((condition) =>
    condition.id === conditionId
      ? {
          ...condition,
          rules: condition.rules.filter((_, index) => index !== ruleIndex),
        }
      : condition,
  );
}

export function updateBranchingRule(
  conditions: Condition[],
  conditionId: number,
  ruleIndex: number,
  field: BranchRuleField,
  value: string | number,
): Condition[] {
  return conditions.map((condition) =>
    condition.id === conditionId
      ? {
          ...condition,
          rules: condition.rules.map((rule, index) =>
            index === ruleIndex ? { ...rule, [field]: value } : rule,
          ),
        }
      : condition,
  );
}

export function selectBranchingTarget(
  conditions: Condition[],
  conditionId: number,
  nextTrialId: string | number | null,
): Condition[] {
  return conditions.map((condition) =>
    condition.id === conditionId
      ? { ...condition, nextTrialId, customParameters: {} }
      : condition,
  );
}

export function setBranchingCustomParameters(
  conditions: Condition[],
  conditionId: number,
  customParameters: Condition["customParameters"],
): Condition[] {
  return conditions.map((condition) =>
    condition.id === conditionId
      ? { ...condition, customParameters: { ...(customParameters ?? {}) } }
      : condition,
  );
}

export function addBranchingCustomParameter(options: {
  conditions: Condition[];
  conditionId: number;
  isTargetDynamic: boolean;
  targetTrialParameters: Record<string | number, Parameter[]>;
  uniqueKey?: string;
}): Condition[] {
  return options.conditions.map((condition) => {
    if (condition.id !== options.conditionId) return condition;

    const customParameters = { ...(condition.customParameters ?? {}) };
    if (options.isTargetDynamic) {
      const key = options.uniqueKey ?? `components::::_${Date.now()}`;
      customParameters[key] = { source: "none", value: null };
    } else {
      const existingKeys = Object.keys(customParameters);
      const availableParameters = condition.nextTrialId
        ? options.targetTrialParameters[condition.nextTrialId] ?? []
        : [];
      const nextParameter = availableParameters.find(
        (parameter) => !existingKeys.includes(parameter.key),
      );
      if (nextParameter) {
        customParameters[nextParameter.key] = { source: "none", value: null };
      }
    }

    return { ...condition, customParameters };
  });
}

export function isBranchTargetFromUserContext(options: {
  selectedItem: Trial | Loop;
  targetId: string | number | null;
  scopeTimeline: TimelineItem[];
  topLevelLoopTrialIds?: Set<string>;
}): boolean {
  const { selectedItem, targetId, scopeTimeline } = options;
  if (!targetId) return false;
  if (includesId(selectedItem.branches, targetId)) return true;

  const target = scopeTimeline.find((item) => idsEqual(item.id, targetId));
  if (!target) return false;
  if (
    !("parentLoopId" in selectedItem && selectedItem.parentLoopId) &&
    target.type === "trial" &&
    (target.parentLoopId ||
      options.topLevelLoopTrialIds?.has(itemIdKey(target.id)))
  ) {
    return false;
  }

  return isForwardSameScopeTarget(scopeTimeline, selectedItem.id, targetId);
}

export function buildBranchingSaveUpdates(options: {
  conditions: Condition[];
  existingBranches?: (string | number)[];
  isBranchTarget: (trialId: string | number) => boolean;
}): BranchingSaveUpdates {
  const branchConditions: BranchCondition[] = [];
  const repeatConditions: RepeatCondition[] = [];
  const nextBranches = [...(options.existingBranches ?? [])];
  let addedBranchTarget = false;

  options.conditions.forEach((condition) => {
    if (!condition.nextTrialId) return;

    if (options.isBranchTarget(condition.nextTrialId)) {
      if (!includesId(nextBranches, condition.nextTrialId)) {
        nextBranches.push(condition.nextTrialId);
        addedBranchTarget = true;
      }
      branchConditions.push({
        id: condition.id,
        rules: condition.rules,
        nextTrialId: condition.nextTrialId,
        customParameters: condition.customParameters,
      });
      return;
    }

    repeatConditions.push({
      id: condition.id,
      rules: condition.rules,
      jumpToTrialId: condition.nextTrialId,
    });
  });

  return {
    ...(addedBranchTarget ? { branches: nextBranches } : {}),
    branchConditions,
    repeatConditions,
  };
}

export async function saveBranchingIntent(options: {
  item: Trial | Loop;
  conditions: Condition[];
  isBranchTarget: (trialId: string | number) => boolean;
  dependencies: BranchingMutationDependencies;
}): Promise<BranchingSaveUpdates> {
  const updates = buildBranchingSaveUpdates({
    conditions: options.conditions,
    existingBranches: options.item.branches ?? [],
    isBranchTarget: options.isBranchTarget,
  });

  if ("trials" in options.item) {
    await options.dependencies.updateLoop(options.item.id, updates);
  } else {
    await options.dependencies.updateTrial(options.item.id, updates);
  }
  return updates;
}
