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

  // Agrupa trials/loops en un loop (soporta nested loops)
  const groupTrialsAsLoop = (
    trialIndices: number[],
    loopProps?: Partial<Omit<Loop, "trials" | "id">>
  ) => {
    if (trialIndices.length < 2) return;

    const loopCount = trials.filter((t) => "trials" in t).length;
    const loopName = `Loop ${loopCount + 1}`;

    // Get the IDs that will be grouped (can be trials or loops)
    const idsToGroup = trialIndices
      .map((i) => trials[i])
      .filter((t) => t && "id" in t)
      .map((t) => t.id);

    // Extract the items to group, preserving their structure
    const itemsToGroup = trialIndices
      .map((i) => trials[i])
      .filter((t) => t && "id" in t)
      .map((item) => {
        if ("trials" in item) {
          // Es un Loop - preservar toda su estructura
          return {
            ...item,
            // Los loops mantienen su CSV propio si lo tienen
          };
        } else {
          // Es un Trial
          return {
            ...item,
            csvJson: undefined,
            csvColumns: undefined,
            csvFromLoop: true,
            // Preserve branches if they exist
            branches: item.branches || undefined,
          };
        }
      });

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
      trials: itemsToGroup as TrialOrLoop[],
      code: "",
    };

    // Calculate where to insert the loop BEFORE removing trials
    const insertIndex = Math.min(...trialIndices);

    // Check if the items being grouped are branches of another trial or loop
    let parentId: number | string | null = null;
    for (const item of trials) {
      if ("branches" in item && item.branches && Array.isArray(item.branches)) {
        const hasBranchToGroup = item.branches.some((branchId) => {
          return idsToGroup.includes(branchId);
        });

        if (hasBranchToGroup) {
          parentId = "parameters" in item ? (item as Trial).id : item.id;
          break;
        }
      }
    }

    // Remove the grouped items from the main array
    const newTrials: TrialOrLoop[] = [];

    for (let i = 0; i < trials.length; i++) {
      // If this is where the loop should be inserted
      if (i === insertIndex) {
        newTrials.push(newLoop);
      }

      // If this item is NOT being grouped, add it
      if (!trialIndices.includes(i)) {
        const item = trials[i];

        // If this item has branches, remove any that are being grouped and add the loop
        if (
          "branches" in item &&
          item.branches &&
          Array.isArray(item.branches)
        ) {
          const updatedBranches = item.branches.filter((branchId) => {
            return !idsToGroup.includes(branchId);
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
      const draggedIndex = newTrials.findIndex((item) =>
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
      // Helper recursivo para encontrar y eliminar el loop
      const removeLoopRecursive = (
        items: TrialOrLoop[]
      ): { newItems: TrialOrLoop[]; found: boolean; loop?: Loop } => {
        for (let idx = 0; idx < items.length; idx++) {
          const item = items[idx];

          // Si encontramos el loop a eliminar
          if ("trials" in item && item.id === loopId) {
            const loop = item as Loop;

            // Verificar si es un branch de otro item en este nivel
            let parentItem: TrialOrLoop | null = null;
            for (const potentialParent of items) {
              if (
                "branches" in potentialParent &&
                potentialParent.branches?.includes(loopId)
              ) {
                parentItem = potentialParent;
                break;
              }
            }

            let newItems: TrialOrLoop[];

            if (parentItem) {
              // Es un branch - restaurar trials como branches del parent
              newItems = [...items.slice(0, idx), ...items.slice(idx + 1)];
              newItems = [
                ...newItems,
                ...loop.trials.map((trial) => ({
                  ...trial,
                  csvJson: undefined,
                  csvColumns: undefined,
                  csvFromLoop: undefined,
                })),
              ];

              // Encontrar root trials
              const branchIdsInLoop = new Set<number | string>();
              loop.trials.forEach((trial) => {
                if (trial.branches) {
                  trial.branches.forEach((branchId) =>
                    branchIdsInLoop.add(branchId)
                  );
                }
              });

              const rootTrialIds = loop.trials
                .filter((trial) => !branchIdsInLoop.has(trial.id))
                .map((trial) => trial.id);

              // Actualizar branches del parent
              newItems = newItems.map((item) => {
                const itemId =
                  "parameters" in item ? (item as Trial).id : item.id;
                const parentId =
                  "parameters" in parentItem
                    ? (parentItem as Trial).id
                    : parentItem.id;

                if (
                  itemId === parentId &&
                  "branches" in item &&
                  item.branches
                ) {
                  const updatedBranches = item.branches.flatMap((branchId) => {
                    if (branchId === loopId) {
                      return rootTrialIds;
                    }
                    return branchId;
                  });
                  return { ...item, branches: updatedBranches };
                }
                return item;
              });
            } else {
              // No es un branch - insertar trials en la posición del loop
              newItems = [
                ...items.slice(0, idx),
                ...loop.trials.map((trial) => ({
                  ...trial,
                  csvJson: undefined,
                  csvColumns: undefined,
                  csvFromLoop: undefined,
                })),
                ...items.slice(idx + 1),
              ];
            }

            return { newItems, found: true, loop };
          }

          // Si es un loop, buscar recursivamente
          if ("trials" in item) {
            const result = removeLoopRecursive(item.trials);
            if (result.found) {
              const updatedItem = {
                ...item,
                trials: result.newItems,
              };
              const newItems = [
                ...items.slice(0, idx),
                updatedItem,
                ...items.slice(idx + 1),
              ];
              return { newItems, found: true, loop: result.loop };
            }
          }
        }

        return { newItems: items, found: false };
      };

      const result = removeLoopRecursive(prevTrials);

      if (result.found) {
        // Actualiza en el backend
        fetch(`${API_URL}/api/save-trials/${experimentID}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ trials: result.newItems }),
        });

        return result.newItems;
      }

      return prevTrials;
    });
    setSelectedLoop(null);
  };

  useEffect(() => {
    fetch(`${API_URL}/api/load-trials/${experimentID}`)
      .then((res) => res.json())
      .then((data) => {
        if (
          data.trials &&
          data.trials.trials &&
          data.trials.trials.length > 0
        ) {
          setTrials(data.trials.trials);
        } else {
          const newTrial: Trial = {
            id: Date.now(),
            plugin: "plugin-dynamic",
            name: "New Trial",
            parameters: {},
            trialCode: "",
            columnMapping: {
              components: {
                source: "typed",
                value: [
                  {
                    type: "HtmlComponent",
                    stimulus:
                      '<div id="i9zw" style="box-sizing: border-box;">Welcome to the experiment, press \'Start\' to begin</div>',
                    coordinates: { x: 0, y: 0 },
                    width: 200,
                    height: 50,
                  },
                ],
              },
              response_components: {
                source: "typed",
                value: [
                  {
                    type: "ButtonResponseComponent",
                    choices: ["Start"],
                    coordinates: { x: 0, y: 0.15 },
                    width: 200,
                    height: 50,
                  },
                ],
              },
            },
            type: "Trial",
          };
          setTrials([newTrial]);
        }
      });
  }, [experimentID]);

  useEffect(() => {
    if (trials.length === 0) return;
    // Guardar trials en backend cuando cambian
    fetch(`${API_URL}/api/save-trials/${experimentID}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ trials }),
    });
  }, [trials, experimentID]);

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
