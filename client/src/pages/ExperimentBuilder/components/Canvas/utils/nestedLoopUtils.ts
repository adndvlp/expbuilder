import { Trial, Loop, TrialOrLoop } from "../../ConfigPanel/types";

export function isTrial(item: any): item is Trial {
  return item && "parameters" in item;
}

export function isLoop(item: any): item is Loop {
  return item && "trials" in item && !("parameters" in item);
}

/**
 * Busca un loop por ID de forma recursiva en toda la jerarquía
 */
export function findLoopByIdRecursive(
  items: TrialOrLoop[],
  loopId: string
): Loop | null {
  for (const item of items) {
    if (isLoop(item)) {
      if (item.id === loopId) {
        return item;
      }
      // Buscar recursivamente en los trials del loop
      const found = findLoopByIdRecursive(item.trials, loopId);
      if (found) return found;
    }
  }
  return null;
}

/**
 * Busca un trial por ID de forma recursiva en toda la jerarquía
 */
export function findTrialByIdRecursive(
  items: TrialOrLoop[],
  trialId: number
): Trial | null {
  for (const item of items) {
    if (isTrial(item) && item.id === trialId) {
      return item;
    }
    if (isLoop(item)) {
      const found = findTrialByIdRecursive(item.trials, trialId);
      if (found) return found;
    }
  }
  return null;
}

/**
 * Busca cualquier item (trial o loop) por ID de forma recursiva
 */
export function findItemByIdRecursive(
  items: TrialOrLoop[],
  id: number | string
): TrialOrLoop | null {
  if (typeof id === "string" && id.startsWith("loop_")) {
    return findLoopByIdRecursive(items, id);
  }
  return findTrialByIdRecursive(items, id as number);
}

/**
 * Cuenta solo los trials directos de un loop (no loops anidados)
 */
export function countDirectTrials(loop: Loop): number {
  return loop.trials.filter((item) => isTrial(item)).length;
}

/**
 * Cuenta los loops anidados directamente en un loop
 */
export function countNestedLoops(loop: Loop): number {
  return loop.trials.filter((item) => isLoop(item)).length;
}

/**
 * Propaga CSV solo a trials directos, NO a loops anidados
 */
export function propagateCSVToTrials(loop: Loop): Loop {
  if (!loop.csvJson || !loop.csvColumns) {
    return loop;
  }

  const updatedTrials = loop.trials.map((item) => {
    if (isTrial(item)) {
      return {
        ...item,
        csvJson: loop.csvJson,
        csvColumns: loop.csvColumns,
        csvFromLoop: true,
      } as Trial;
    }
    // Es loop anidado, no propagar
    return item;
  });

  return {
    ...loop,
    trials: updatedTrials,
  };
}

/**
 * Detecta si crear un loop anidado causaría un ciclo circular
 */
export function detectCircularNesting(
  loopId: string,
  targetLoopId: string,
  trials: TrialOrLoop[]
): boolean {
  const targetLoop = findLoopByIdRecursive(trials, targetLoopId);
  if (!targetLoop) return false;

  const hasLoop = (loop: Loop, searchId: string): boolean => {
    if (loop.id === searchId) return true;

    return loop.trials.some((item) => {
      if (isLoop(item)) {
        return hasLoop(item, searchId);
      }
      return false;
    });
  };

  return hasLoop(targetLoop, loopId);
}

/**
 * Obtiene todos los nombres existentes en la jerarquía completa
 */
export function getAllExistingNamesRecursive(items: TrialOrLoop[]): string[] {
  const names: string[] = [];

  for (const item of items) {
    names.push(item.name);
    if (isLoop(item)) {
      names.push(...getAllExistingNamesRecursive(item.trials));
    }
  }

  return names;
}

/**
 * Actualiza un loop en cualquier nivel de la jerarquía
 */
export function updateLoopInHierarchy(
  items: TrialOrLoop[],
  loopId: string,
  updater: (loop: Loop) => Loop
): TrialOrLoop[] {
  return items.map((item) => {
    if (isLoop(item)) {
      if (item.id === loopId) {
        return updater(item);
      }
      return {
        ...item,
        trials: updateLoopInHierarchy(item.trials, loopId, updater),
      };
    }
    return item;
  });
}

/**
 * Actualiza un trial en cualquier nivel de la jerarquía
 */
export function updateTrialInHierarchy(
  items: TrialOrLoop[],
  trialId: number,
  updater: (trial: Trial) => Trial
): TrialOrLoop[] {
  return items.map((item) => {
    if (isTrial(item) && item.id === trialId) {
      return updater(item);
    }
    if (isLoop(item)) {
      return {
        ...item,
        trials: updateTrialInHierarchy(item.trials, trialId, updater),
      };
    }
    return item;
  });
}

/**
 * Encuentra el loop padre de un item dado
 */
export function findParentLoop(
  items: TrialOrLoop[],
  childId: number | string
): Loop | null {
  for (const item of items) {
    if (isLoop(item)) {
      const hasChild = item.trials.some((child) => {
        if (isTrial(child)) {
          return child.id === childId;
        }
        return child.id === childId;
      });

      if (hasChild) {
        return item;
      }

      // Buscar recursivamente
      const found = findParentLoop(item.trials, childId);
      if (found) return found;
    }
  }
  return null;
}

/**
 * Obtiene la ruta completa de loops desde la raíz hasta un loop específico
 */
export function getLoopPath(
  items: TrialOrLoop[],
  targetLoopId: string,
  currentPath: Loop[] = []
): Loop[] | null {
  for (const item of items) {
    if (isLoop(item)) {
      const newPath = [...currentPath, item];

      if (item.id === targetLoopId) {
        return newPath;
      }

      const foundPath = getLoopPath(item.trials, targetLoopId, newPath);
      if (foundPath) {
        return foundPath;
      }
    }
  }
  return null;
}
