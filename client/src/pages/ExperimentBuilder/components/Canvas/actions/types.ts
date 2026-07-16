import type useTrials from "../../../hooks/useTrials";
import type { TimelineItem } from "../../../contexts/TrialsContext";

export type CanvasItemId = string | number;

export type CanvasItemToMove = Pick<TimelineItem, "id" | "name" | "type">;

export type RootCanvasActionScope = {
  kind: "root";
  items: TimelineItem[];
};

export type LoopCanvasActionScope = {
  kind: "loop";
  loopId: CanvasItemId;
  items: TimelineItem[];
  rootItems: TimelineItem[];
  refresh?: () => void | Promise<void>;
};

export type CanvasActionScope =
  | RootCanvasActionScope
  | LoopCanvasActionScope;

export type CanvasActionDependencies = Pick<
  ReturnType<typeof useTrials>,
  | "createTrial"
  | "createLoop"
  | "getTrial"
  | "getLoop"
  | "updateTrial"
  | "updateLoop"
  | "updateTrialField"
  | "updateTimeline"
>;

export type TrialSelection = {
  onSelectTrial?: ReturnType<typeof useTrials>["setSelectedTrial"];
};

export type LoopSelection = {
  onSelectLoop?: ReturnType<typeof useTrials>["setSelectedLoop"];
};

export type ScopedActionInput = {
  scope: CanvasActionScope;
  dependencies: CanvasActionDependencies;
};

export type CanvasMoveResult =
  | { status: "moved" }
  | { status: "destination-not-found" };
