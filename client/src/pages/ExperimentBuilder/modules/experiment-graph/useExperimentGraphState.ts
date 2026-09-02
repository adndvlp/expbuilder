import { useCallback, useRef, useState } from "react";
import type { SetStateAction } from "react";
import { loadExperimentGraph } from "./api";
import type {
  ExperimentGraphSnapshot,
  GraphScopeView,
  TimelineItem,
} from "./types";

type ReplaceLoopTimelines = (
  scopes: Record<string, GraphScopeView>,
) => void;

export function useExperimentGraphState(
  experimentId: string | undefined,
  replaceLoopTimelines: ReplaceLoopTimelines,
) {
  const [graph, setGraph] = useState<ExperimentGraphSnapshot | null>(null);
  const [timeline, setTimelineState] = useState<TimelineItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const timelineRef = useRef<TimelineItem[]>([]);
  const requestVersionRef = useRef(0);

  const setTimeline = useCallback((update: SetStateAction<TimelineItem[]>) => {
    const next =
      typeof update === "function" ? update(timelineRef.current) : update;
    if (Object.is(next, timelineRef.current)) return;
    requestVersionRef.current += 1;
    timelineRef.current = next;
    setTimelineState(next);
    setIsLoading(false);
  }, []);

  const applyGraphSnapshot = useCallback(
    (snapshot: ExperimentGraphSnapshot) => {
      requestVersionRef.current += 1;
      timelineRef.current = snapshot.root.items;
      setGraph(snapshot);
      setTimelineState(snapshot.root.items);
      replaceLoopTimelines(snapshot.scopes);
      setIsLoading(false);
    },
    [replaceLoopTimelines],
  );

  const getTimeline = useCallback(async () => {
    if (!experimentId) return null;
    const requestVersion = ++requestVersionRef.current;
    setIsLoading(true);
    try {
      const snapshot = await loadExperimentGraph(experimentId);
      if (requestVersion !== requestVersionRef.current) return null;
      applyGraphSnapshot(snapshot);
      return snapshot;
    } catch (error: unknown) {
      console.error("Error loading experiment graph:", error);
      if (requestVersion === requestVersionRef.current) setIsLoading(false);
      return null;
    }
  }, [applyGraphSnapshot, experimentId]);

  const clearGraph = useCallback(() => {
    requestVersionRef.current += 1;
    timelineRef.current = [];
    setGraph(null);
    setTimelineState([]);
    setIsLoading(false);
  }, []);

  return {
    graph,
    timeline,
    isLoading,
    setTimeline,
    applyGraphSnapshot,
    getTimeline,
    clearGraph,
  };
}
