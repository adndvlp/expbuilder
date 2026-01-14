import { Trial } from "../../ConfigPanel/types";

const API_URL = import.meta.env.VITE_API_URL;

export function isTrial(item: any): item is Trial {
  // En la estructura plana: loops tienen "trials" array, trials NO
  return !("trials" in item);
}

// ==================== FUNCIONES QUE USAN SOLO TIMELINE METADATA ====================

export function findTrialById(
  timeline: any[],
  id: number | string
): any | null {
  const numId = typeof id === "string" ? parseInt(id) : id;
  const found = timeline.find(
    (item) => item.type === "trial" && item.id === numId
  );
  return found || null;
}

export function findLoopById(timeline: any[], id: string): any | null {
  const found = timeline.find((item) => item.type === "loop" && item.id === id);
  return found || null;
}

export function findItemById(timeline: any[], id: number | string): any | null {
  if (typeof id === "string" && id.startsWith("loop_")) {
    return findLoopById(timeline, id);
  }
  return findTrialById(timeline, id);
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

export function collectAllBranchIds(timeline: any[]): Set<number | string> {
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
          const branchTrial = findTrialById(timeline, numId);
          if (branchTrial) {
            processItem(branchTrial);
          }
        }
      });
    }
  };

  timeline.forEach(processItem);
  return branchIds;
}

export function getTrialIdsInLoops(timeline: any[]): (number | string)[] {
  return timeline
    .filter((item) => item.type === "loop")
    .flatMap((loop: any) => loop.trials || []);
}

// ==================== FUNCIONES ASYNC QUE USAN ENDPOINTS ====================

/**
 * Obtiene todos los nombres existentes (incluyendo trials dentro de loops)
 * desde el backend
 */
export async function getAllExistingNames(
  experimentID: string
): Promise<string[]> {
  try {
    const response = await fetch(
      `${API_URL}/api/timeline-names/${experimentID}`
    );
    const data = await response.json();
    return data.names || [];
  } catch (error) {
    console.error("Error fetching timeline names:", error);
    return [];
  }
}

/**
 * Verifica si sourceId es un ancestro de targetId en la jerarquía
 * Esto previene crear dependencias circulares
 */
export async function isAncestor(
  sourceId: number | string,
  targetId: number | string,
  experimentID: string
): Promise<boolean> {
  try {
    const response = await fetch(
      `${API_URL}/api/validate-ancestor/${experimentID}?source=${sourceId}&target=${targetId}`
    );
    const data = await response.json();
    return data.isAncestor || false;
  } catch (error) {
    console.error("Error validating ancestor:", error);
    return false;
  }
}

/**
 * Valida si una conexión entre source y target es válida
 * Retorna un objeto con isValid y errorMessage
 */
export async function validateConnection(
  sourceId: number | string,
  targetId: number | string,
  experimentID: string
): Promise<{ isValid: boolean; errorMessage?: string }> {
  try {
    const response = await fetch(
      `${API_URL}/api/validate-connection/${experimentID}?source=${sourceId}&target=${targetId}`
    );
    const data = await response.json();
    return {
      isValid: data.isValid,
      errorMessage: data.errorMessage,
    };
  } catch (error) {
    console.error("Error validating connection:", error);
    return {
      isValid: false,
      errorMessage: "Error validating connection",
    };
  }
}
