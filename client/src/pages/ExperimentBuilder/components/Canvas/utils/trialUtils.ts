import { Trial, Loop } from "../../ConfigPanel/types";

export function isTrial(item: any): item is Trial {
  return "parameters" in item;
}

export function findTrialById(
  trials: any[],
  id: number | string
): Trial | null {
  const numId = typeof id === "string" ? parseInt(id) : id;
  const found = trials.find((t: any) => isTrial(t) && t.id === numId);
  return found && isTrial(found) ? found : null;
}

export function findLoopById(trials: any[], id: string): Loop | null {
  const found = trials.find((t: any) => !isTrial(t) && t.id === id);
  return found && !isTrial(found) ? (found as Loop) : null;
}

export function findItemById(
  trials: any[],
  id: number | string
): Trial | Loop | null {
  if (typeof id === "string" && id.startsWith("loop_")) {
    return findLoopById(trials, id);
  }
  return findTrialById(trials, id);
}

export function generateUniqueName(
  existingNames: string[],
  baseName = "New Trial"
): string {
  let newName = baseName;
  let counter = 1;
  while (existingNames.includes(newName)) {
    newName = `${baseName} ${counter}`;
    counter++;
  }
  return newName;
}

export function getAllExistingNames(trials: any[]): string[] {
  return [
    ...trials.filter((t) => isTrial(t)).map((t: any) => t.name),
    ...trials
      .filter((t) => "trials" in t)
      .flatMap((loop: any) => loop.trials.map((trial: any) => trial.name)),
  ];
}

export function collectAllBranchIds(items: any[]): Set<number | string> {
  const branchIds = new Set<number | string>();

  const processItem = (item: any) => {
    if (item.branches && Array.isArray(item.branches)) {
      item.branches.forEach((branchId: number | string) => {
        branchIds.add(branchId);

        const numId =
          typeof branchId === "string" && !branchId.startsWith("loop_")
            ? parseInt(branchId)
            : typeof branchId === "number"
              ? branchId
              : null;

        if (numId !== null) {
          const branchTrial = findTrialById(items, numId);
          if (branchTrial) {
            processItem(branchTrial);
          }
        }
      });
    }
  };

  items.forEach(processItem);
  return branchIds;
}

export function getTrialIdsInLoops(trials: any[]): number[] {
  return trials
    .filter((item) => "trials" in item)
    .flatMap((loop: any) => loop.trials.map((t: any) => t.id));
}

/**
 * Check if sourceId is an ancestor of targetId in the hierarchy
 * This prevents creating circular dependencies
 */
export function isAncestor(
  sourceId: number | string,
  targetId: number | string,
  items: any[],
  visited = new Set<number | string>()
): boolean {
  // Avoid infinite loops
  if (visited.has(targetId)) {
    return false;
  }
  visited.add(targetId);

  // If they are the same, return true
  if (sourceId === targetId) {
    return true;
  }

  // Find the target item
  const targetItem = findItemById(items, targetId);
  if (!targetItem || !targetItem.branches) {
    return false;
  }

  // Check if sourceId is in the branches of targetId
  if (targetItem.branches.includes(sourceId)) {
    return true;
  }

  // Recursively check all branches
  for (const branchId of targetItem.branches) {
    if (isAncestor(sourceId, branchId, items, visited)) {
      return true;
    }
  }

  return false;
}

/**
 * Validate if a connection between source and target is valid
 * Returns an object with isValid and errorMessage
 */
export function validateConnection(
  sourceId: number | string,
  targetId: number | string,
  items: any[]
): { isValid: boolean; errorMessage?: string } {
  // Can't connect to itself
  if (sourceId === targetId) {
    return {
      isValid: false,
      errorMessage: "Cannot connect a trial to itself",
    };
  }

  // Check if target is an ancestor of source (would create a cycle)
  if (isAncestor(targetId, sourceId, items)) {
    return {
      isValid: false,
      errorMessage:
        "Cannot connect to an ancestor trial (would create a circular dependency)",
    };
  }

  return { isValid: true };
}
