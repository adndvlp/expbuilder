import { ReactNode, useState, useEffect } from "react";
import TrialsContext from "../contexts/TrialsContext";
import { Loop, Trial, TrialOrLoop } from "../components/ConfigPanel/types";
const API_URL = import.meta.env.VITE_API_URL;

type Props = {
  children: ReactNode;
};

export default function TrialsProvider({ children }: Props) {
  const [trials, setTrials] = useState<TrialOrLoop[]>([]);
  const [selectedTrial, setSelectedTrial] = useState<Trial | null>(null);
  const [selectedLoop, setSelectedLoop] = useState<Loop | null>(null);

  // Agrupa trials en un loop
  const groupTrialsAsLoop = (
    trialIndices: number[],
    loopProps?: Partial<Omit<Loop, "trials" | "id">>
  ) => {
    if (trialIndices.length < 2) return; // Deben ser al menos 2

    const loopCount = trials.filter((t) => "trials" in t).length;
    const loopName = `Loop ${loopCount + 1}`;

    // Extrae los trials a agrupar
    const trialsToGroup = trialIndices
      .map((i) => trials[i])
      .filter((t) => t && "id" in t);

    // Crea el loop
    const newLoop: Loop = {
      id: "loop_" + Date.now(),
      name: loopProps?.name || loopName,
      repetitions: loopProps?.repetitions ?? 1,
      randomize: loopProps?.randomize ?? false,
      // Orders
      orders: loopProps?.orders ?? false,
      stimuliOrders: loopProps?.stimuliOrders ?? [],
      orderColumns: loopProps?.orderColumns ?? [],
      // Categories
      categoryColumn: loopProps?.categoryColumn ?? "",
      categories: loopProps?.categories ?? false,
      categoryData: loopProps?.categoryData ?? [],
      trials: trialsToGroup as Trial[],
      code: "",
    };

    // Elimina los trials agrupados
    const newTrials = trials.filter((_, idx) => !trialIndices.includes(idx));
    // Inserta el loop en la posición más baja de los índices agrupados
    const insertIndex = Math.min(...trialIndices);
    newTrials.splice(insertIndex, 0, newLoop);

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
          // Restaura el CSV individual si existe
          if (trial.csvJson) {
            trial = {
              ...trial,
              csvJson: trial.csvJson,
              csvColumns: trial.csvColumns,
              csvFromLoop: false,
              csvJsonLoop: undefined,
              csvColumnsLoop: undefined,
            };
          } else {
            trial = {
              ...trial,
              csvFromLoop: false,
            };
          }
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
          // Copia el CSV del loop al trial y marca csvFromLoop
          const trialWithLoopCsv = {
            ...draggedItem,
            prevCsvJson: draggedItem.csvJson,
            prevCsvColumns: draggedItem.csvColumns,
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

      // Propaga el CSV del loop a todos los trials dentro de cada loop (por si se actualizó el CSV del loop)
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
      // Inserta los trials del loop en el lugar del loop
      const newTrials = [
        ...prevTrials.slice(0, idx),
        ...loop.trials,
        ...prevTrials.slice(idx + 1),
      ];

      // Actualiza en el backend
      fetch(`${API_URL}/api/save-trials`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trials: newTrials }),
      });

      return newTrials;
    });
    setSelectedLoop(null);
  };

  useEffect(() => {
    fetch(`${API_URL}/api/load-trials`)
      .then((res) => res.json())
      .then((data) => {
        if (data.trials && data.trials.trials) {
          setTrials(data.trials.trials);
        }
      });
  }, []);

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
