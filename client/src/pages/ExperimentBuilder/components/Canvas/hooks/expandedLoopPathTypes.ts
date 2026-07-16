import type { TimelineItem } from "../../../contexts/TrialsContext";

export type LoopScopeId = TimelineItem["id"];

export type ExpandedLoopReference = Pick<TimelineItem, "id" | "name">;

export type ExpandedLoopScope = ExpandedLoopReference & {
  parentLoopId: LoopScopeId | null;
};

export type ExpandedLoopEntry = {
  loop: ExpandedLoopScope;
  items: TimelineItem[];
};

export type ExpandedLoopOperation =
  | "expand"
  | "activate"
  | "collapse"
  | "refresh";

export type ExpandedLoopPending = {
  operation: ExpandedLoopOperation;
  scopeId: LoopScopeId | null;
};

export type ExpandedLoopPathError = ExpandedLoopPending & {
  cause: unknown;
};

export type LoadLoopItemsOptions = {
  forceRefresh: boolean;
};

export type LoadLoopItems = (
  loopId: LoopScopeId,
  options: LoadLoopItemsOptions,
) => Promise<TimelineItem[]>;

export type UseExpandedLoopPathOptions = {
  loadLoopItems: LoadLoopItems;
  activateRoot?: () => void | Promise<void>;
};
