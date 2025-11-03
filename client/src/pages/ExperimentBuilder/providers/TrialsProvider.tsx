import { ReactNode, useState, useEffect } from "react";
import TrialsContext from "../contexts/TrialsContext";
import { Loop, Trial, TrialOrLoop } from "../components/ConfigPanel/types";
import { useExperimentID } from "../hooks/useExperimentID";
const API_URL = import.meta.env.VITE_API_URL;

type Props = {
  children: ReactNode;
};

export default function TrialsProvider({ children }: Props) {
  const [trials, setTrials] = useState<TrialOrLoop[]>([]);
  const [selectedTrial, setSelectedTrial] = useState<Trial | null>(null);
  const [selectedLoop, setSelectedLoop] = useState<Loop | null>(null);

  const experimentID = useExperimentID();

  // Agrupa trials en un loop
  const groupTrialsAsLoop = (
    trialIndices: number[],
    loopProps?: Partial<Omit<Loop, "trials" | "id">>
  ) => {
    if (trialIndices.length < 2) return;

    const loopCount = trials.filter((t) => "trials" in t).length;
    const loopName = `Loop ${loopCount + 1}`;

    // Get the trial IDs that will be grouped
    const trialIdsToGroup = trialIndices
      .map((i) => trials[i])
      .filter((t) => t && "id" in t)
      .map((t) => (t as Trial).id);

    // Extract the trials to group, preserving their structure (including branches property)
    const trialsToGroup = trialIndices
      .map((i) => trials[i])
      .filter((t) => t && "id" in t)
      .map((trial) => ({
        ...trial,
        csvJson: undefined,
        csvColumns: undefined,
        csvFromLoop: true,
        // Preserve branches if they exist
        branches: (trial as Trial).branches || undefined,
      }));

    // Create the loop
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
      trials: trialsToGroup as Trial[],
      code: "",
    };

    // Calculate where to insert the loop BEFORE removing trials
    const insertIndex = Math.min(...trialIndices);

    // Check if the trials being grouped are branches of another trial or loop
    let parentId: number | string | null = null;
    for (const item of trials) {
      if ("branches" in item && item.branches && Array.isArray(item.branches)) {
        const hasBranchToGroup = item.branches.some((branchId) => {
          const numBranchId =
            typeof branchId === "string" ? parseInt(branchId) : branchId;
          return trialIdsToGroup.includes(numBranchId);
        });

        if (hasBranchToGroup) {
          parentId = "parameters" in item ? (item as Trial).id : item.id;
          break;
        }
      }
    }

    // Remove the grouped trials from the main array
    const newTrials: TrialOrLoop[] = [];

    for (let i = 0; i < trials.length; i++) {
      // If this is where the loop should be inserted
      if (i === insertIndex) {
        newTrials.push(newLoop);
      }

      // If this trial is NOT being grouped, add it
      if (!trialIndices.includes(i)) {
        const item = trials[i];

        // If this item has branches, remove any that are being grouped and add the loop
        if (
          "branches" in item &&
          item.branches &&
          Array.isArray(item.branches)
        ) {
          const updatedBranches = item.branches.filter((branchId) => {
            const numBranchId =
              typeof branchId === "string" ? parseInt(branchId) : branchId;
            return !trialIdsToGroup.includes(numBranchId);
          });

          // If this is the parent (trial or loop) and some branches were grouped, add the loop ID
          const itemId = "parameters" in item ? (item as Trial).id : item.id;
          if (
            updatedBranches.length !== item.branches.length &&
            parentId &&
            itemId === parentId
          ) {
            updatedBranches.push(newLoop.id);
            newTrials.push({ ...item, branches: updatedBranches });
          } else if (updatedBranches.length !== item.branches.length) {
            newTrials.push({ ...item, branches: updatedBranches });
          } else {
            newTrials.push(item);
          }
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
    setTrials((prev) => {
      let newTrials = [...prev];

      // Encuentra el trial/loop arrastrado
      let draggedIndex = newTrials.findIndex((item) =>
        dragged.type === "trial"
          ? "parameters" in item && item.id === dragged.id
          : "trials" in item && item.id === dragged.id
      );

      let draggedItem = newTrials[draggedIndex];

      // Si el dragged está dentro de un loop, sácalo primero
      if (dragged.type === "trial") {
        const loopIndex = newTrials.findIndex(
          (item) =>
            "trials" in item &&
            (item as Loop).trials.some((t) => t.id === dragged.id)
        );
        if (loopIndex !== -1) {
          const loop = newTrials[loopIndex] as Loop;
          const trialIdx = loop.trials.findIndex((t) => t.id === dragged.id);
          let trial = loop.trials[trialIdx];
          loop.trials.splice(trialIdx, 1);
          // Si el loop queda vacío, elimínalo
          if (loop.trials.length === 0) {
            newTrials.splice(loopIndex, 1);
          }
          // Al sacar el trial del loop, NO restaurar ningún CSV previo
          trial = {
            ...trial,
            csvJson: undefined,
            csvColumns: undefined,
          };
          draggedItem = trial;
        }
      }

      // Elimina el dragged del array principal si está ahí
      if (draggedIndex !== -1) {
        newTrials.splice(draggedIndex, 1);
      }

      // Si el destino es dentro de un loop
      if (position === "inside" && target.type === "loop" && target.id) {
        const loopIndex = newTrials.findIndex(
          (item) => "trials" in item && item.id === target.id
        );
        if (loopIndex !== -1) {
          const loop = newTrials[loopIndex] as Loop;
          // Al meter el trial al loop, elimina cualquier CSV individual y marca csvFromLoop
          const trialWithLoopCsv = {
            ...draggedItem,
            csvJson: loop.csvJson,
            csvColumns: loop.csvColumns,
            csvFromLoop: true,
          };
          loop.trials.push(trialWithLoopCsv as Trial);

          // Propaga el CSV del loop a todos los trials dentro del loop
          if (loop.csvJson && loop.csvColumns) {
            loop.trials = loop.trials.map((trial) => ({
              ...trial,
              csvJson: loop.csvJson,
              csvColumns: loop.csvColumns,
              csvFromLoop: true,
            }));
          }
        }
        return [...newTrials];
      }

      // Si el destino es antes/después de un trial/loop
      let targetIndex = target.id
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

      // Propaga el CSV del loop a todos los trials dentro de cada loop
      newTrials = newTrials.map((item) => {
        if (item && "trials" in item && item.csvJson && item.csvColumns) {
          const loop = item as Loop;
          loop.trials = loop.trials.map((trial) => ({
            ...trial,
            csvJson: loop.csvJson,
            csvColumns: loop.csvColumns,
            csvFromLoop: true,
          }));
          return loop;
        }
        return item;
      });

      return [...newTrials];
    });
  }

  const removeLoop = (loopId: string) => {
    setTrials((prevTrials) => {
      const idx = prevTrials.findIndex(
        (item) => "trials" in item && item.id === loopId
      );
      if (idx === -1) return prevTrials;

      const loop = prevTrials[idx] as Loop;

      // Check if the loop is a branch of another trial or loop
      let parentItem: TrialOrLoop | null = null;
      for (const item of prevTrials) {
        if (
          "branches" in item &&
          item.branches &&
          Array.isArray(item.branches)
        ) {
          if (item.branches.includes(loopId)) {
            parentItem = item;
            break;
          }
        }
      }

      let newTrials: TrialOrLoop[];

      // If the loop was a branch, restore the trials as branches of the parent
      if (parentItem) {
        // Remove the loop from the main array without inserting the trials
        newTrials = [...prevTrials.slice(0, idx), ...prevTrials.slice(idx + 1)];

        // Add the loop's trials to the main array
        newTrials = [...newTrials, ...loop.trials];

        // Find which trials inside the loop are "root" trials (not branches of other trials in the loop)
        const branchIdsInLoop = new Set<number | string>();
        loop.trials.forEach((trial) => {
          if (trial.branches && Array.isArray(trial.branches)) {
            trial.branches.forEach((branchId) => branchIdsInLoop.add(branchId));
          }
        });

        // Only root trials (those not in branchIdsInLoop) should be added as branches of the parent
        const rootTrialIds = loop.trials
          .filter((trial) => !branchIdsInLoop.has(trial.id))
          .map((trial) => trial.id);

        // Update the parent's branches: replace loop ID with the root trial IDs
        newTrials = newTrials.map((item) => {
          const itemId = "parameters" in item ? (item as Trial).id : item.id;
          const parentId =
            "parameters" in parentItem
              ? (parentItem as Trial).id
              : parentItem.id;

          if (itemId === parentId && "branches" in item && item.branches) {
            // Replace the loop ID with only the root trial IDs from the loop
            const updatedBranches = item.branches.flatMap((branchId) => {
              if (branchId === loopId) {
                // Replace loop ID with only root trial IDs
                return rootTrialIds;
              }
              return branchId;
            });

            return { ...item, branches: updatedBranches };
          }
          return item;
        });
      } else {
        // If the loop was NOT a branch, insert trials in the position of the loop
        newTrials = [
          ...prevTrials.slice(0, idx),
          ...loop.trials,
          ...prevTrials.slice(idx + 1),
        ];
      }

      // Actualiza en el backend
      fetch(`${API_URL}/api/save-trials/${experimentID}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trials: newTrials }),
      });

      return newTrials;
    });
    setSelectedLoop(null);
  };

  useEffect(() => {
    fetch(`${API_URL}/api/load-trials/${experimentID}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.trials && data.trials.trials) {
          setTrials(data.trials.trials);
        }
      });
  }, []);

  useEffect(() => {
    if (trials.length === 0) return;
    // Guardar trials en backend cuando cambian
    fetch(`${API_URL}/api/save-trials/${experimentID}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ trials }),
    });
  }, [trials]);

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
      }}
    >
      {children}
    </TrialsContext.Provider>
  );
}
