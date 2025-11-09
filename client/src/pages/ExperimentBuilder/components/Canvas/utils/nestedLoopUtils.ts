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

/**
 * Agrega una branch a un trial o loop de forma recursiva
 */
export function addBranchToItemInHierarchy(
  items: TrialOrLoop[],
  parentId: number | string,
  newBranchTrial: Trial
): TrialOrLoop[] {
  const updated = items.map((item) => {
    const itemId = isTrial(item) ? item.id : item.id;

    if (itemId === parentId) {
      return {
        ...item,
        branches: [...(item.branches || []), newBranchTrial.id],
      };
    }

    if (isLoop(item)) {
      return {
        ...item,
        trials: addBranchToItemInHierarchy(
          item.trials,
          parentId,
          newBranchTrial
        ),
      };
    }

    return item;
  });

  // Agregar el nuevo trial al mismo nivel del padre
  return [...updated, newBranchTrial];
}

/**
 * Crea un loop anidado dentro de un loop padre específico
 */
export function createNestedLoop(
  items: TrialOrLoop[],
  parentLoopId: string,
  trialIndicesInParent: number[],
  loopProps?: Partial<Omit<Loop, "trials" | "id">>
): TrialOrLoop[] {
  return items.map((item) => {
    if (isLoop(item) && item.id === parentLoopId) {
      // Encontramos el loop padre, crear el loop anidado
      const parentTrials = item.trials;

      if (trialIndicesInParent.length < 2) return item;

      const loopCount = parentTrials.filter((t) => isLoop(t)).length;
      const loopName = `Loop ${loopCount + 1}`;

      // Obtener los trials que se van a agrupar
      const trialsToGroup = trialIndicesInParent
        .map((i) => parentTrials[i])
        .filter((t) => t && isTrial(t))
        .map((trial) => ({
          ...trial,
          csvJson: undefined,
          csvColumns: undefined,
          csvFromLoop: true,
          branches: ("branches" in trial && trial.branches) || undefined,
        }));

      // Crear el nuevo loop anidado
      const newLoop: Loop = {
        id: "loop_" + Date.now(),
        name: loopProps?.name || loopName,
        repetitions: loopProps?.repetitions ?? 1,
        randomize: loopProps?.randomize ?? false,
        orders: loopProps?.orders ?? false,
        stimuliOrders: loopProps?.stimuliOrders ?? [],
        orderColumns: loopProps?.orderColumns ?? [],
        categoryColumn: loopProps?.categoryColumn ?? "",
        categories: loopProps?.categories ?? false,
        categoryData: loopProps?.categoryData ?? [],
        trials: trialsToGroup as TrialOrLoop[],
        code: "",
        parentLoopId: parentLoopId,
        depth: (item.depth || 0) + 1,
      };

      // Calcular dónde insertar el loop
      const insertIndex = Math.min(...trialIndicesInParent);

      // Remover los trials agrupados e insertar el loop
      const newTrials: TrialOrLoop[] = [];
      for (let i = 0; i < parentTrials.length; i++) {
        if (i === insertIndex) {
          newTrials.push(newLoop);
        }
        if (!trialIndicesInParent.includes(i)) {
          newTrials.push(parentTrials[i]);
        }
      }

      return {
        ...item,
        trials: newTrials,
      };
    }

    // Buscar recursivamente en loops anidados
    if (isLoop(item)) {
      return {
        ...item,
        trials: createNestedLoop(
          item.trials,
          parentLoopId,
          trialIndicesInParent,
          loopProps
        ),
      };
    }

    return item;
  });
}
