import { useMemo } from "react";
import {
  LAYOUT_CONSTANTS,
  createTrialNode,
  createLoopNode,
  createEdge,
} from "../utils/layoutUtils";
import { Loop, Trial } from "../../ConfigurationPanel/types";
import { TimelineItem } from "../../../contexts/TrialsContext";
import { Size } from "../hooks/useResizable";

type Props = {
  loopTimeline: TimelineItem[];
  size: Size;
  selectedTrial: Trial | null;
  selectedLoop: Loop | null;
  onSelectTrial: (trial: Trial) => void;
  onSelectLoop: (loop: Loop) => void;
  onOpenNestedLoop: ((loopId: string | number) => void) | undefined;
  getTrial: (id: string | number) => Promise<Trial | null>;
  getLoop: (id: string | number) => Promise<Loop | null>;
  onAddBranch: (parentId: string | number) => Promise<void>;
};

export default function GenerateNodesAndEdges({
  onAddBranch,
  getLoop,
  getTrial,
  selectedLoop,
  selectedTrial,
  loopTimeline,
  size,
  onSelectTrial,
  onSelectLoop,
  onOpenNestedLoop,
}: Props) {
  // Generar nodes y edges basándose en loopTimeline
  const { nodes, edges } = useMemo(() => {
    const nodes: any[] = [];
    const edges: any[] = [];
    const renderedItems = new Map<number | string, string>();
    const { yStep, branchHorizontalSpacing, branchVerticalOffset } =
      LAYOUT_CONSTANTS;

    const xTrial = size.width / 3.1;

    // Recopilar todos los IDs de branches (recursivamente)
    const collectAllBranchIds = (
      items: TimelineItem[],
    ): Set<number | string> => {
      const branchIds = new Set<number | string>();

      const collectBranches = (item: TimelineItem) => {
        if (item.branches && item.branches.length > 0) {
          item.branches.forEach((branchId) => {
            branchIds.add(branchId);
            const branchItem = items.find((i) => i.id === branchId);
            if (branchItem) {
              collectBranches(branchItem);
            }
          });
        }
      };

      items.forEach(collectBranches);
      return branchIds;
    };

    const branchItemIds = collectAllBranchIds(loopTimeline);
    const mainItems = loopTimeline.filter(
      (item) => !branchItemIds.has(item.id),
    );

    // Función recursiva para renderizar un item y sus branches
    const renderItemWithBranches = (
      item: TimelineItem,
      parentId: string,
      x: number,
      y: number,
      depth: number = 0,
    ): number => {
      const isTrial = item.type === "trial";
      const nodeId = isTrial ? `trial-${item.id}` : `loop-${item.id}`;

      if (renderedItems.has(item.id)) {
        const existingNodeId = renderedItems.get(item.id)!;
        if (parentId !== "root") {
          edges.push(createEdge(parentId, existingNodeId));
        }
        return y;
      }

      renderedItems.set(item.id, nodeId);

      // Crear nodo
      const isSelected = isTrial
        ? selectedTrial?.id === item.id
        : selectedLoop?.id === item.id;

      const handleSelect = async () => {
        if (isTrial) {
          const trial = await getTrial(item.id);
          if (trial) onSelectTrial(trial);
        } else {
          const loop = await getLoop(item.id);
          if (loop) onSelectLoop(loop);
        }
      };

      if (isTrial) {
        nodes.push(
          createTrialNode(
            nodeId,
            item.name,
            x,
            y,
            isSelected,
            handleSelect,
            isSelected ? () => onAddBranch(item.id) : undefined,
          ),
        );
      } else {
        nodes.push(
          createLoopNode(
            nodeId,
            item.name,
            x,
            y,
            isSelected,
            handleSelect,
            isSelected ? () => onAddBranch(item.id) : undefined,
            onOpenNestedLoop ? () => onOpenNestedLoop(item.id) : undefined,
          ),
        );
      }

      if (parentId !== "root") {
        edges.push(createEdge(parentId, nodeId));
      }

      let maxY = y;

      // Renderizar branches
      if (item.branches && item.branches.length > 0) {
        const branches = item.branches
          .map((branchId) => loopTimeline.find((i) => i.id === branchId))
          .filter((b): b is TimelineItem => b !== undefined);

        if (branches.length > 0) {
          const startX =
            x -
            (branches.length * branchHorizontalSpacing) / 2 +
            branchHorizontalSpacing / 2;

          branches.forEach((branch, index) => {
            const branchX = startX + index * branchHorizontalSpacing;
            const branchY = y + branchVerticalOffset;

            const finalY = renderItemWithBranches(
              branch,
              nodeId,
              branchX,
              branchY,
              depth + 1,
            );
            maxY = Math.max(maxY, finalY);
          });
        }
      }

      return maxY;
    };

    // Renderizar items principales y sus branches
    let yPos = 60;
    mainItems.forEach((item, index) => {
      const finalY = renderItemWithBranches(item, "root", xTrial, yPos, 0);

      if (index < mainItems.length - 1) {
        yPos = finalY + yStep;
      }
    });

    // Agregar edges entre items principales (secuencia vertical)
    for (let i = 0; i < mainItems.length - 1; i++) {
      const currentItem = mainItems[i];
      const nextItem = mainItems[i + 1];

      const currentNodeId =
        currentItem.type === "trial"
          ? `trial-${currentItem.id}`
          : `loop-${currentItem.id}`;
      const nextNodeId =
        nextItem.type === "trial"
          ? `trial-${nextItem.id}`
          : `loop-${nextItem.id}`;

      edges.push(createEdge(currentNodeId, nextNodeId));
    }

    return { nodes, edges };
  }, [
    loopTimeline,
    selectedTrial,
    selectedLoop,
    onSelectTrial,
    onSelectLoop,
    onAddBranch,
    onOpenNestedLoop,
    getTrial,
    getLoop,
    size.width,
  ]);
  return { nodes, edges };
}
