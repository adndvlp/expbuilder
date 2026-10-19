import { Trial } from "../../ConfigurationPanel/types";
import { getApiBaseUrl } from "../../../../../lib/apiBaseUrl";
export { generateUniqueName } from "../actions/generateUniqueName";

const API_URL = getApiBaseUrl();

export function isTrial(item: object): item is Trial {
  // In the flat structure: loops have a "trials" array, trials do NOT
  return !("trials" in item);
}

// ==================== FUNCTIONS THAT USE ONLY TIMELINE METADATA ====================

type TimelineMetadata = {
  id: string | number;
  type?: string;
  trials?: readonly (string | number)[];
};

export function findTrialById<T extends TimelineMetadata>(
  timeline: readonly T[],
  id: number | string,
): T | null {
  const found = timeline.find(
    (item) => item.type === "trial" && String(item.id) === String(id),
  );
  return found || null;
}

export function findLoopById<T extends TimelineMetadata>(
  timeline: readonly T[],
  id: string | number,
): T | null {
  const found = timeline.find(
    (item) => item.type === "loop" && String(item.id) === String(id),
  );
  return found || null;
}

export function findItemById<T extends TimelineMetadata>(
  timeline: readonly T[],
  id: number | string,
): T | null {
  return timeline.find((item) => String(item.id) === String(id)) ?? null;
}

export function getTrialIdsInLoops(
  timeline: readonly TimelineMetadata[],
): (number | string)[] {
  return timeline
    .filter((item) => item.type === "loop")
    .flatMap((loop) => loop.trials || []);
}

// ==================== ASYNC FUNCTIONS THAT USE ENDPOINTS ====================

/**
 * Gets all existing names (including trials inside loops)
 * from the backend
 */
export async function getAllExistingNames(
  experimentID: string,
): Promise<string[]> {
  try {
    const response = await fetch(
      `${API_URL}/api/timeline-names/${experimentID}`,
    );
    const data = await response.json();
    return data.names || [];
  } catch (error) {
    console.error("Error fetching timeline names:", error);
    return [];
  }
}

/**
 * Checks if sourceId is an ancestor of targetId in the hierarchy
 * This prevents creating circular dependencies
 */
export async function isAncestor(
  sourceId: number | string,
  targetId: number | string,
  experimentID: string,
): Promise<boolean> {
  try {
    const response = await fetch(
      `${API_URL}/api/validate-ancestor/${experimentID}?source=${sourceId}&target=${targetId}`,
    );
    const data = await response.json();
    return data.isAncestor || false;
  } catch (error) {
    console.error("Error validating ancestor:", error);
    return false;
  }
}

/**
 * Validates if a connection between source and target is valid
 * Returns an object with isValid and errorMessage
 */
export async function validateConnection(
  sourceId: number | string,
  targetId: number | string,
  experimentID: string,
): Promise<{ isValid: boolean; errorMessage?: string }> {
  try {
    const response = await fetch(
      `${API_URL}/api/validate-connection/${experimentID}?source=${sourceId}&target=${targetId}`,
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
