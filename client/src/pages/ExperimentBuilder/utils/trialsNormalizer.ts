/**
 * Tipos para la estructura normalizada de trials
 */

import { Trial, Loop, TrialOrLoop } from "../components/ConfigPanel/types";

// Estructura normalizada (como se guarda en DB)
export type NormalizedTrialsData = {
  trials: Record<string | number, Trial>;
  loops: Record<string, NormalizedLoop>;
  timeline: {
    root: TimelineItem[];
    [loopId: string]: TimelineItem[];
  };
};

// Loop sin trials anidados (solo propiedades)
export type NormalizedLoop = Omit<Loop, "trials" | "code"> & {
  childCount?: number;
};

// Item del timeline (referencia ligera)
export type TimelineItem = {
  type: "trial" | "loop";
  id: string | number;
  order: number;
};

/**
 * Convierte de estructura normalizada (DB) → anidada (UI)
 */
export function denormalize(
  normalizedData: NormalizedTrialsData
): TrialOrLoop[] {
  if (!normalizedData || !normalizedData.timeline) {
    return [];
  }

  const { trials, loops, timeline } = normalizedData;

  function reconstructLevel(timelineItems: TimelineItem[]): TrialOrLoop[] {
    if (!Array.isArray(timelineItems)) return [];

    return timelineItems
      .sort((a, b) => a.order - b.order)
      .map((item) => {
        if (item.type === "trial") {
          const trial = trials[item.id];
          if (!trial) return null;
          return { ...trial };
        } else if (item.type === "loop") {
          const loop = loops[item.id];
          if (!loop) return null;

          const loopContent = timeline[item.id] || [];
          const nestedTrials = reconstructLevel(loopContent);

          // Propagar CSV del loop a trials hijos
          const trialsWithCsv = nestedTrials.map((child) => {
            if (child && "plugin" in child && child.csvFromLoop) {
              return {
                ...child,
                csvJson: loop.csvJson || child.csvJson,
                csvColumns: loop.csvColumns || child.csvColumns,
              };
            }
            return child;
          });

          return {
            ...loop,
            trials: trialsWithCsv,
            code: "",
          } as Loop;
        }
        return null;
      })
      .filter(Boolean) as TrialOrLoop[];
  }

  return reconstructLevel(timeline.root);
}

/**
 * Convierte de estructura anidada (UI) → normalizada (DB)
 */
export function normalize(nestedTrials: TrialOrLoop[]): NormalizedTrialsData {
  if (!Array.isArray(nestedTrials)) {
    return {
      trials: {},
      loops: {},
      timeline: { root: [] },
    };
  }

  const trials: Record<string | number, Trial> = {};
  const loops: Record<string, NormalizedLoop> = {};
  const timeline: { root: TimelineItem[]; [loopId: string]: TimelineItem[] } = {
    root: [],
  };

  function processLevel(
    items: TrialOrLoop[],
    _parentLoopId: string | null = null
  ): TimelineItem[] {
    const timelineItems: TimelineItem[] = [];

    items.forEach((item, index) => {
      if ("plugin" in item) {
        // Es un Trial
        const { csvFromLoop, ...trialData } = item;
        trials[item.id] = {
          ...trialData,
          csvFromLoop: csvFromLoop || false,
        } as Trial;

        timelineItems.push({
          type: "trial",
          id: item.id,
          order: index,
        });
      } else if ("trials" in item && Array.isArray(item.trials)) {
        // Es un Loop
        const { trials: nestedTrials, ...loopData } = item;

        loops[item.id] = {
          ...loopData,
          childCount: nestedTrials.length,
        };

        timelineItems.push({
          type: "loop",
          id: item.id,
          order: index,
        });

        timeline[item.id] = processLevel(nestedTrials, item.id);
      }
    });

    return timelineItems;
  }

  timeline.root = processLevel(nestedTrials, null);

  return { trials, loops, timeline };
}
