import type {
  BranchCondition,
  Loop,
  Trial,
} from "../../../components/ConfigurationPanel/types";
import type { Condition } from "../../../components/ConfigurationPanel/TrialsConfiguration/BranchedTrial/types";
import type { Parameter } from "../../../components/ConfigurationPanel/TrialsConfiguration/BranchedTrial/types";
import type { TimelineItem } from "../../../contexts/TrialsContext";
import { idsEqual, includesId } from "../../../utils/branchGraphUtils";

type BranchRuleField = keyof Condition["rules"][number];

export type BranchingSaveUpdates = {
  branches?: (string | number)[];
  branchConditions: BranchCondition[];
  defaultNextTrialId?: string | number | null;
};

export type BranchingMutationDependencies = {
  updateTrial: (
    id: string | number,
    updates: Partial<Trial>,
  ) => Promise<unknown>;
  updateLoop: (id: string | number, updates: Partial<Loop>) => Promise<unknown>;
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
          rules: [...condition.rules, { column: "", op: "==", value: "" }],
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
        ? (options.targetTrialParameters[condition.nextTrialId] ?? [])
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
  if (targetId == null || "trials" in selectedItem) return false;
  if (targetId === "FINISH_EXPERIMENT") return true;
  return scopeTimeline.some(
    (item) => idsEqual(item.id, targetId) && item.type === "trial",
  );
}

export function buildBranchingSaveUpdates(options: {
  conditions: Condition[];
  existingBranches?: (string | number)[];
  isBranchTarget: (trialId: string | number) => boolean;
}): BranchingSaveUpdates {
  const branches = [...(options.existingBranches ?? [])];
  const branchConditions: BranchCondition[] = [];
  for (const condition of options.conditions) {
    if (condition.nextTrialId == null) continue;
    if (!options.isBranchTarget(condition.nextTrialId))
      throw new Error("Branch destination must be a trial");
    if (
      condition.nextTrialId !== "FINISH_EXPERIMENT" &&
      !includesId(branches, condition.nextTrialId)
    )
      branches.push(condition.nextTrialId);
    branchConditions.push({ ...condition, nextTrialId: condition.nextTrialId });
  }
  return { branches, branchConditions };
}

export async function saveBranchingIntent(options: {
  item: Trial | Loop;
  conditions: Condition[];
  isBranchTarget: (trialId: string | number) => boolean;
  defaultNextTrialId?: string | number | null;
  dependencies: BranchingMutationDependencies;
}): Promise<BranchingSaveUpdates> {
  if ("trials" in options.item)
    throw new Error("Branch sources must be trials");
  const updates = buildBranchingSaveUpdates({
    conditions: options.conditions,
    existingBranches: options.item.branches ?? [],
    isBranchTarget: options.isBranchTarget,
  });
  updates.defaultNextTrialId =
    options.defaultNextTrialId === undefined
      ? options.item.defaultNextTrialId
      : options.defaultNextTrialId;
  if (
    updates.defaultNextTrialId != null &&
    updates.defaultNextTrialId !== "FINISH_EXPERIMENT" &&
    !includesId(updates.branches, updates.defaultNextTrialId)
  ) {
    if (!options.isBranchTarget(updates.defaultNextTrialId))
      throw new Error("Branch destination must be a trial");
    updates.branches?.push(updates.defaultNextTrialId);
  }
  await options.dependencies.updateTrial(options.item.id, updates);
  return updates;
}
