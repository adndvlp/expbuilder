import type { Trial } from "./records";
export function isRegenerableTrialCode(
  trial: Pick<Trial, "plugin" | "parameters" | "trialCodeSource">,
): boolean;
