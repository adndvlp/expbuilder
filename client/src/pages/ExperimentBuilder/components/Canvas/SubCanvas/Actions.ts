import { Connection } from "reactflow";
import { generateUniqueName } from "../utils/trialUtils";
import { Loop, Trial } from "../../ConfigurationPanel/types";
import { TimelineItem } from "../../../contexts/TrialsContext";
import { SetStateAction } from "react";

type Props = {
  onSelectTrial: (trial: Trial) => void;
  onSelectLoop: (loop: Loop) => void;
  onRefreshMetadata: (() => void) | undefined;
  loopTimeline: TimelineItem[];
  getTrial: (id: string | number) => Promise<Trial | null>;
  getLoop: (id: string | number) => Promise<Loop | null>;
  timeline: TimelineItem[];
  createTrial: (trial: Omit<Trial, "id">) => Promise<Trial>;
  updateLoop: (
    id: string | number,
    loop: Partial<Loop>,
  ) => Promise<Loop | null>;
  updateTrial: (
    id: string | number,
    trial: Partial<Trial>,
  ) => Promise<Trial | null>;
  loopId: string | number;
  setShowLoopModal: (value: SetStateAction<boolean>) => void;
  createLoop: (loop: Omit<Loop, "id">) => Promise<Loop>;
};

export default function Actions({
  onSelectTrial,
  onSelectLoop,
  onRefreshMetadata,
  getLoop,
  updateLoop,
  getTrial,
  updateTrial,
  loopTimeline,
  timeline,
  loopId,
  createTrial,
  setShowLoopModal,
  createLoop,
}: Props) {
  // Handler para agregar branch
  const onAddBranch = async (parentId: number | string) => {
    // Obtener TODOS los nombres existentes: del timeline principal + del loop actual
    const timelineNames = timeline.map((item) => item.name);
    const loopTrialNames = loopTimeline.map((item) => item.name);
    const allNames = [...new Set([...timelineNames, ...loopTrialNames])];
    const newName = generateUniqueName(allNames);

    try {
      // Crear el trial branch con parentLoopId para que no se agregue al timeline principal
      const newBranchTrial = await createTrial({
        type: "Trial",
        name: newName,
        parameters: {},
        trialCode: "",
        parentLoopId: loopId, // Importante: establece que este trial está dentro del loop
      });

      // Actualizar el parent (trial o loop) para incluir este branch
      const parentItem = loopTimeline.find((item) => item.id === parentId);
      if (!parentItem) return;

      if (parentItem.type === "trial") {
        const parentTrial = await getTrial(parentId);
        if (parentTrial) {
          await updateTrial(parentId, {
            branches: [...(parentTrial.branches || []), newBranchTrial.id],
          });
        }
      } else {
        const parentLoop = await getLoop(parentId);
        if (parentLoop) {
          await updateLoop(parentId, {
            branches: [...(parentLoop.branches || []), newBranchTrial.id],
          });
        }
      }

      onSelectTrial(newBranchTrial);
      if (onRefreshMetadata) onRefreshMetadata();
    } catch (error) {
      console.error("Error adding branch:", error);
    }
  };

  // Handler para crear loop anidado
  const handleCreateNestedLoop = () => {
    const confirmed = window.confirm(
      "Are you sure you want to group these trials/loops into a nested loop?",
    );
    if (!confirmed) {
      return;
    }

    setShowLoopModal(true);
  };

  const handleAddLoop = async (itemIds: (number | string)[]) => {
    if (itemIds.length < 2) {
      alert("You must select at least 2 trials/loops to create a loop.");
      setShowLoopModal(false);
      return;
    }

    try {
      // Obtener el loop padre completo para contar loops anidados
      const parentLoop = await getLoop(loopId);
      if (!parentLoop) return;

      // Obtener TODOS los nombres existentes: del timeline principal + del loop actual
      const timelineNames = timeline.map((item) => item.name);
      const loopTrialNames = loopTimeline.map((item) => item.name);
      const allNames = [...new Set([...timelineNames, ...loopTrialNames])];
      const loopName = generateUniqueName(allNames, "Nested Loop 1");

      const newLoop = await createLoop({
        name: loopName,
        repetitions: 1,
        randomize: false,
        orders: false,
        stimuliOrders: [],
        orderColumns: [],
        categoryColumn: "",
        categories: false,
        categoryData: [],
        trials: itemIds,
        code: "",
        parentLoopId: loopId, // Importante: establece que este loop está dentro del loop padre
      });

      // Actualizar el loop padre para incluir el nuevo loop anidado
      const updatedTrials = [
        ...(parentLoop.trials || []).filter((id) => !itemIds.includes(id)),
        newLoop.id,
      ];

      await updateLoop(loopId, {
        trials: updatedTrials,
      });

      onSelectLoop(newLoop);
      setShowLoopModal(false);
      if (onRefreshMetadata) onRefreshMetadata();
    } catch (error) {
      console.error("Error creating nested loop:", error);
      setShowLoopModal(false);
    }
  };

  // Handler para conectar trials manualmente
  const handleConnect = async (connection: Connection) => {
    if (!connection.source || !connection.target) return;

    // Extraer IDs de los nodos
    const extractId = (nodeId: string): number | string | null => {
      if (nodeId.startsWith("loop-")) {
        return nodeId.substring(5);
      }
      const segments = nodeId.split("-");
      const lastSegment = segments[segments.length - 1];
      const parsed = parseInt(lastSegment);
      return isNaN(parsed) ? lastSegment : parsed;
    };

    const sourceId = extractId(connection.source);
    const targetId = extractId(connection.target);

    if (sourceId === null || targetId === null) {
      console.error("Invalid connection IDs");
      return;
    }

    try {
      // Buscar el source en loopTimeline
      const sourceItem = loopTimeline.find((item) => item.id === sourceId);
      if (!sourceItem) return;

      if (sourceItem.type === "trial") {
        const sourceTrial = await getTrial(sourceId);
        if (!sourceTrial) return;

        const branches = sourceTrial.branches || [];
        if (!branches.includes(targetId)) {
          await updateTrial(sourceId, {
            branches: [...branches, targetId],
          });
        }
      } else {
        const sourceLoop = await getLoop(sourceId);
        if (!sourceLoop) return;

        const branches = sourceLoop.branches || [];
        if (!branches.includes(targetId)) {
          await updateLoop(sourceId, {
            branches: [...branches, targetId],
          });
        }
      }

      if (onRefreshMetadata) onRefreshMetadata();
    } catch (error) {
      console.error("Error connecting items:", error);
    }
  };

  return {
    onAddBranch,
    handleCreateNestedLoop,
    handleAddLoop,
    handleConnect,
  };
}
