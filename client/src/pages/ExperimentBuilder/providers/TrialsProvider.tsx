import { ReactNode, useState, useEffect, useMemo } from "react";
import TrialsContext from "../contexts/TrialsContext";
import { Loop, Trial, TrialOrLoop } from "../components/ConfigPanel/types";
import { useExperimentID } from "../hooks/useExperimentID";
import {
  normalize,
  denormalize,
  NormalizedTrialsData,
  NormalizedLoop,
} from "../utils/trialsNormalizer";
import { createDefaultTrial } from "../utils/defaultTrial";

const API_URL = import.meta.env.VITE_API_URL;

type Props = {
  children: ReactNode;
};

export default function TrialsProvider({ children }: Props) {
  // Estado interno: estructura normalizada
  const [normalizedData, setNormalizedData] = useState<NormalizedTrialsData>({
    trials: {},
    loops: {},
    timeline: { root: [] },
  });

  const [selectedTrial, setSelectedTrial] = useState<Trial | null>(null);
  const [selectedLoop, setSelectedLoop] = useState<Loop | null>(null);

  const experimentID = useExperimentID();

  // Exponer trials como estructura anidada (para compatibilidad con componentes)
  const trials = useMemo(() => denormalize(normalizedData), [normalizedData]);

  // Wrapper para setTrials - convierte de anidado a normalizado
  const setTrials = (newTrials: TrialOrLoop[]) => {
    setNormalizedData(normalize(newTrials));
  };

  // Agrupa trials/loops en un loop
  const groupTrialsAsLoop = (
    trialIndices: number[],
    loopProps?: Partial<Omit<Loop, "trials" | "id">>
  ) => {
    if (trialIndices.length < 2) return;

    const currentTrials = denormalize(normalizedData);
    const loopCount = currentTrials.filter((t) => "trials" in t).length;
    const loopName = `Loop ${loopCount + 1}`;

    const itemsToGroup = trialIndices
      .map((i) => currentTrials[i])
      .filter((t) => t && "id" in t)
      .map((item) => {
        if ("trials" in item) {
          return { ...item };
        } else {
          return {
            ...item,
            csvJson: undefined,
            csvColumns: undefined,
            csvFromLoop: true,
          };
        }
      });

    const newLoop: Loop = {
      id: "loop_" + Date.now(),
      name: loopProps?.name || loopName,
      repetitions: loopProps?.repetitions ?? 1,
      randomize: loopProps?.randomize ?? false,
      orders: loopProps?.orders ?? false,
      stimuliOrders: loopProps?.stimuliOrders ?? [],
      orderColumns: loopProps?.orderColumns ?? [],
      categoryColumn: loopProps?.categoryColumn ?? "",
      categories: loopProps?.categories ?? false,
      categoryData: loopProps?.categoryData ?? [],
      trials: itemsToGroup as TrialOrLoop[],
      code: "",
    };

    const insertIndex = Math.min(...trialIndices);
    const newTrials: TrialOrLoop[] = [];

    for (let i = 0; i < currentTrials.length; i++) {
      if (i === insertIndex) {
        newTrials.push(newLoop);
      }
      if (!trialIndices.includes(i)) {
        const item = currentTrials[i];
        if (
          "branches" in item &&
          item.branches &&
          Array.isArray(item.branches)
        ) {
          const idsBeingGrouped = itemsToGroup.map((t) => t.id);
          const updatedBranches = item.branches.filter(
            (branchId) => !idsBeingGrouped.includes(branchId)
          );
          if (updatedBranches.length !== item.branches.length) {
            updatedBranches.push(newLoop.id);
          }
          newTrials.push({ ...item, branches: updatedBranches });
        } else {
          newTrials.push(item);
        }
      }
    }

    setTrials(newTrials);
  };

  type MoveItemParams = {
    dragged: { type: "trial" | "loop"; id: string | number };
    target: { type: "trial" | "loop"; id: string | number | null };
    position: "before" | "after" | "inside";
  };

  function moveTrialOrLoop({ dragged, target, position }: MoveItemParams) {
    const currentTrials = denormalize(normalizedData);
    let newTrials = [...currentTrials];

    const draggedIndex = newTrials.findIndex((item) =>
      dragged.type === "trial"
        ? "parameters" in item && item.id === dragged.id
        : "trials" in item && item.id === dragged.id
    );

    let draggedItem = newTrials[draggedIndex];

    if (dragged.type === "trial") {
      for (let i = 0; i < newTrials.length; i++) {
        const item = newTrials[i];
        if ("trials" in item) {
          const idx = item.trials.findIndex(
            (t: any) => "plugin" in t && t.id === dragged.id
          );
          if (idx !== -1) {
            draggedItem = item.trials[idx];
            item.trials = item.trials.filter((_: any, j: number) => j !== idx);
            break;
          }
        }
      }
    }

    if (draggedIndex !== -1) {
      newTrials.splice(draggedIndex, 1);
    }

    if (position === "inside" && target.type === "loop" && target.id) {
      const loopIndex = newTrials.findIndex(
        (item) => "trials" in item && item.id === target.id
      );
      if (loopIndex !== -1 && "trials" in newTrials[loopIndex]) {
        const loop = newTrials[loopIndex] as Loop;
        loop.trials = [...loop.trials, draggedItem];
        if (draggedItem && "plugin" in draggedItem) {
          (draggedItem as Trial).csvFromLoop = true;
        }
      }
    }

    const targetIndex = target.id
      ? newTrials.findIndex((item) =>
          target.type === "trial"
            ? "parameters" in item && item.id === target.id
            : "trials" in item && item.id === target.id
        )
      : newTrials.length;

    if (position === "before") {
      newTrials.splice(targetIndex, 0, draggedItem);
    } else if (position === "after") {
      newTrials.splice(targetIndex + 1, 0, draggedItem);
    }

    newTrials = newTrials.map((item) => {
      if ("trials" in item) {
        const loop = item as Loop;
        return {
          ...loop,
          trials: loop.trials.map((child: any) =>
            child && "plugin" in child ? { ...child, csvFromLoop: true } : child
          ),
        };
      }
      return item;
    });

    setTrials(newTrials);
  }

  const removeLoop = (loopId: string) => {
    const currentTrials = denormalize(normalizedData);

    const removeLoopRecursive = (
      items: TrialOrLoop[]
    ): { newItems: TrialOrLoop[]; found: boolean; loop?: Loop } => {
      let found = false;
      let foundLoop: Loop | undefined;
      const newItems: TrialOrLoop[] = [];

      for (const item of items) {
        if ("trials" in item && item.id === loopId) {
          found = true;
          foundLoop = item;
          for (const child of item.trials) {
            if ("plugin" in child) {
              newItems.push({ ...child, csvFromLoop: false });
            } else {
              newItems.push(child);
            }
          }
        } else if ("trials" in item) {
          const result = removeLoopRecursive(item.trials);
          if (result.found) {
            newItems.push({ ...item, trials: result.newItems });
            return { newItems, found: true, loop: result.loop };
          } else {
            newItems.push(item);
          }
        } else {
          newItems.push(item);
        }
      }

      return { newItems, found, loop: foundLoop };
    };

    const result = removeLoopRecursive(currentTrials);

    if (result.found) {
      setTrials(result.newItems);
      if (selectedLoop && selectedLoop.id === loopId) {
        setSelectedLoop(null);
      }
    }
  };

  // Cargar trials del backend
  useEffect(() => {
    fetch(`${API_URL}/api/load-trials/${experimentID}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.trials) {
          // Backend devuelve estructura normalizada
          setNormalizedData(data.trials);
        } else {
          // Experimento nuevo - crear trial por defecto
          const defaultTrial = createDefaultTrial();
          setNormalizedData(normalize([defaultTrial]));
        }
      })
      .catch((err) => {
        console.error("Error loading trials:", err);
      });
  }, [experimentID]);

  // ========== MÉTODOS OPTIMIZADOS ==========
  // Actualizar UN SOLO trial (sin mandar todo)
  const updateTrial = async (
    trialId: string | number,
    updatedData: Partial<Trial>
  ) => {
    const currentTrial = normalizedData.trials[trialId];
    if (!currentTrial) {
      console.error(`Trial ${trialId} not found`);
      return;
    }

    const updatedTrial = { ...currentTrial, ...updatedData };

    // Actualizar estado local
    setNormalizedData((prev) => ({
      ...prev,
      trials: {
        ...prev.trials,
        [trialId]: updatedTrial,
      },
    }));

    // Mandar SOLO este trial al backend
    try {
      await fetch(`${API_URL}/api/trials/${trialId}/${experimentID}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedTrial),
      });
      console.log(`✓ Trial ${trialId} updated`);
    } catch (err) {
      console.error("Error updating trial:", err);
    }
  };

  // Actualizar UN SOLO loop (sin mandar todo)
  const updateLoop = async (
    loopId: string,
    updatedData: Partial<NormalizedLoop>
  ) => {
    const currentLoop = normalizedData.loops[loopId];
    if (!currentLoop) {
      console.error(`Loop ${loopId} not found`);
      return;
    }

    const updatedLoop = { ...currentLoop, ...updatedData };

    // Actualizar estado local
    setNormalizedData((prev) => ({
      ...prev,
      loops: {
        ...prev.loops,
        [loopId]: updatedLoop,
      },
    }));

    // Mandar SOLO este loop al backend
    try {
      await fetch(`${API_URL}/api/loops/${loopId}/${experimentID}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedLoop),
      });
      console.log(`✓ Loop ${loopId} updated`);
    } catch (err) {
      console.error("Error updating loop:", err);
    }
  };

  return (
    <TrialsContext.Provider
      value={{
        trials,
        setTrials,
        selectedTrial,
        setSelectedTrial,
        selectedLoop,
        setSelectedLoop,
        groupTrialsAsLoop,
        moveTrialOrLoop,
        removeLoop,
        updateTrial, // Método optimizado
        updateLoop, // Método optimizado
      }}
    >
      {children}
    </TrialsContext.Provider>
  );
}
