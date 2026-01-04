/**
 * Normalizador de estructura de trials
 * Convierte entre formato anidado (UI) y formato normalizado (DB)
 */

/**
 * Convierte de estructura anidada → normalizada
 * @param {Array} nestedTrials - Array de trials/loops anidados
 * @returns {Object} { trials, loops, timeline }
 */
export function normalize(nestedTrials) {
  if (!Array.isArray(nestedTrials)) {
    return {
      trials: {},
      loops: {},
      timeline: { root: [] },
    };
  }

  const trials = {};
  const loops = {};
  const timeline = { root: [] };

  function processLevel(items, parentLoopId = null) {
    const timelineItems = [];

    items.forEach((item, index) => {
      if (item.plugin) {
        // Es un Trial
        const { csvFromLoop, ...trialData } = item;
        trials[item.id] = {
          ...trialData,
          csvFromLoop: csvFromLoop || false,
        };

        timelineItems.push({
          type: "trial",
          id: item.id,
          order: index,
        });
      } else if (item.trials && Array.isArray(item.trials)) {
        // Es un Loop
        const { trials: nestedTrials, code, ...loopData } = item;

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

/**
 * Convierte de estructura normalizada → anidada
 * @param {Object} normalizedData - { trials, loops, timeline }
 * @returns {Array} Array de trials/loops anidados
 */
export function denormalize(normalizedData) {
  if (!normalizedData || !normalizedData.timeline) {
    return [];
  }

  const { trials, loops, timeline } = normalizedData;

  function reconstructLevel(timelineItems) {
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
            if (child && child.plugin && child.csvFromLoop) {
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
          };
        }
        return null;
      })
      .filter(Boolean);
  }

  return reconstructLevel(timeline.root);
}
