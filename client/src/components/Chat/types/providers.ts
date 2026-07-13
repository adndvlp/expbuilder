import type { IconType } from "react-icons";

export type ModelTier = "fast" | "balanced" | "powerful";

export interface AIModel {
  id: string;
  name: string;
  shortName: string;
  contextK: number;
  description: string;
  tier: ModelTier;
}

export interface Provider {
  id: string;
  name: string;
  Icon: IconType;
  color: string;
  requiresKey: boolean;
  keyPlaceholder?: string;
  keyPrefix?: string;
  local?: boolean;
  models: AIModel[];
}
