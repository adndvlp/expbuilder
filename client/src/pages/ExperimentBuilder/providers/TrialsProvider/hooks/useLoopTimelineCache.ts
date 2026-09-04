import {
  SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type {
  LoopTimelineCache,
  LoopTimelineLoadOptions,
  TimelineItem,
} from "../../../contexts/TrialsContext";
import type { GraphScopeView } from "../../../modules/experiment-graph/types";
import { getApiBaseUrl } from "../../../../../lib/apiBaseUrl";

const API_URL = getApiBaseUrl();

type CacheUpdater = (cache: LoopTimelineCache) => LoopTimelineCache;

export type UpdateLoopTimelineItems = (
  loopId: string | number,
  update: SetStateAction<TimelineItem[]>,
) => void;

const keyOf = (loopId: string | number) => String(loopId);

const applyItemsUpdate = (
  items: TimelineItem[],
  update: SetStateAction<TimelineItem[]>,
) => (typeof update === "function" ? update(items) : update);

export default function useLoopTimelineCache(
  experimentID: string | undefined,
) {
  const [cache, setCache] = useState<LoopTimelineCache>({});
  const [activeLoopId, setActiveLoopId] = useState<
    string | number | null
  >(null);
  const cacheRef = useRef(cache);
  const requestVersionsRef = useRef(new Map<string, number>());
  const activationVersionRef = useRef(0);
  const experimentVersionRef = useRef(0);

  const updateCache = useCallback((updater: CacheUpdater) => {
    const next = updater(cacheRef.current);
    cacheRef.current = next;
    setCache(next);
  }, []);

  const resetLoopTimelineCache = useCallback(() => {
    experimentVersionRef.current += 1;
    activationVersionRef.current += 1;
    requestVersionsRef.current.clear();
    cacheRef.current = {};
    setCache({});
    setActiveLoopId(null);
  }, []);

  const replaceLoopTimelines = useCallback(
    (scopes: Record<string, GraphScopeView>) => {
      experimentVersionRef.current += 1;
      requestVersionsRef.current.clear();
      const next = Object.fromEntries(
        Object.entries(scopes).map(([key, scope]) => [
          key,
          {
            status: "ready" as const,
            items: scope.items,
            revision: (cacheRef.current[key]?.revision ?? 0) + 1,
          },
        ]),
      );
      cacheRef.current = next;
      setCache(next);
    },
    [],
  );

  useEffect(() => {
    resetLoopTimelineCache();
  }, [experimentID, resetLoopTimelineCache]);

  const activateLoopTimeline = useCallback(
    (loopId: string | number | null) => {
      activationVersionRef.current += 1;
      if (loopId === null) {
        setActiveLoopId(null);
        return true;
      }
      if (!cacheRef.current[keyOf(loopId)]) return false;
      setActiveLoopId(loopId);
      return true;
    },
    [],
  );

  const updateLoopTimelineItems = useCallback<UpdateLoopTimelineItems>(
    (loopId, update) => {
      const key = keyOf(loopId);
      const entry = cacheRef.current[key];
      if (!entry) return;
      const items = applyItemsUpdate(entry.items, update);
      if (items === entry.items) return;
      requestVersionsRef.current.set(
        key,
        (requestVersionsRef.current.get(key) ?? 0) + 1,
      );
      updateCache((previous) => {
        const current = previous[key];
        if (!current) return previous;
        return {
          ...previous,
          [key]: {
            status: "ready",
            items,
            revision: current.revision + 1,
          },
        };
      });
    },
    [updateCache],
  );

  const getLoopTimeline = useCallback(
    async (
      loopId: string | number,
      options: LoopTimelineLoadOptions = {},
    ): Promise<TimelineItem[]> => {
      const {
        mode = "activate",
        forceRefresh = false,
        throwOnError = false,
      } = options;
      const key = keyOf(loopId);
      const cached = cacheRef.current[key];
      const activationVersion =
        mode === "activate" ? ++activationVersionRef.current : null;

      if (mode !== "query" && !forceRefresh && cached?.status === "ready") {
        if (mode === "activate") setActiveLoopId(loopId);
        return cached.items;
      }

      const requestVersion =
        (requestVersionsRef.current.get(key) ?? 0) + 1;
      const experimentVersion = experimentVersionRef.current;
      if (mode !== "query") {
        requestVersionsRef.current.set(key, requestVersion);
        updateCache((previous) => {
          const entry = previous[key];
          return {
            ...previous,
            [key]: {
              status: "loading",
              items: entry?.items ?? [],
              revision: entry?.revision ?? 0,
            },
          };
        });
      }

      try {
        const response = await fetch(
          `${API_URL}/api/loop-trials-metadata/${experimentID}/${loopId}`,
        );
        if (!response.ok) {
          throw new Error("Failed to load loop trials timeline");
        }
        const data = await response.json();
        const items: TimelineItem[] = data.trialsMetadata || [];

        const isCurrent =
          experimentVersionRef.current === experimentVersion &&
          requestVersionsRef.current.get(key) === requestVersion;
        if (mode !== "query" && isCurrent) {
          updateCache((previous) => {
            const revision = (previous[key]?.revision ?? 0) + 1;
            return {
              ...previous,
              [key]: { status: "ready", items, revision },
            };
          });
          if (
            mode === "activate" &&
            activationVersionRef.current === activationVersion
          ) {
            setActiveLoopId(loopId);
          }
        }
        return items;
      } catch (error: unknown) {
        const isCurrent =
          experimentVersionRef.current === experimentVersion &&
          requestVersionsRef.current.get(key) === requestVersion;
        if (mode !== "query" && isCurrent) {
          updateCache((previous) => {
            const entry = previous[key];
            return {
              ...previous,
              [key]: {
                status: "error",
                items: entry?.items ?? [],
                revision: entry?.revision ?? 0,
                error,
              },
            };
          });
        }
        console.error("Error loading loop trials timeline:", error);
        if (throwOnError) throw error;
        return [];
      }
    },
    [experimentID, updateCache],
  );

  const loopTimeline = useMemo(() => {
    if (activeLoopId === null) return [];
    return cache[keyOf(activeLoopId)]?.items ?? [];
  }, [activeLoopId, cache]);

  return {
    loopTimeline,
    loopTimelineCache: cache,
    activeLoopId,
    getLoopTimeline,
    activateLoopTimeline,
    clearLoopTimeline: () => activateLoopTimeline(null),
    updateLoopTimelineItems,
    replaceLoopTimelines,
    resetLoopTimelineCache,
  };
}
