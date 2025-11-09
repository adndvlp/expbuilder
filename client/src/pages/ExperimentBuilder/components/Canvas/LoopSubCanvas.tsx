import "@xyflow/react/dist/style.css";
import { useMemo, useState } from "react";
import ReactFlow, { Connection } from "reactflow";
import TrialNode from "./TrialNode";
import ResizeHandle from "./components/ResizeHandle";
import BranchedTrial from "../ConfigPanel/TrialsConfig/BranchedTrial";
import ParamsOverride from "../ConfigPanel/TrialsConfig/ParamsOverride";
import { Trial } from "../ConfigPanel/types";
import { useDraggable } from "./hooks/useDraggable";
import { useResizable } from "./hooks/useResizable";
import { TbBinaryTree } from "react-icons/tb";
import { FiX, FiSettings } from "react-icons/fi";
import {
  findTrialById,
  generateUniqueName,
  validateConnection,
} from "./utils/trialUtils";
import {
  LAYOUT_CONSTANTS,
  calculateBranchWidth,
  createTrialNode,
  createEdge,
} from "./utils/layoutUtils";
import { getPatternStyle } from "./utils/styleUtils";

const nodeTypes = {
  trial: TrialNode,
};

interface LoopSubCanvasProps {
  trials: Trial[];
  loopName: string;
  onClose: () => void;
  isDark: boolean;
  selectedTrial: Trial | null;
  onSelectTrial: (trial: Trial) => void;
  onUpdateTrial?: (trial: Trial) => void;
  onAddBranch?: (parentTrialId: number, newBranchTrial: Trial) => void;
}

function LoopSubCanvas({
  trials,
  loopName,
  onClose,
  isDark,
  selectedTrial,
  onSelectTrial,
  onUpdateTrial,
  onAddBranch,
}: LoopSubCanvasProps) {
  const { dragging, pos, handleMouseDown } = useDraggable({ x: 150, y: 250 });
  const { resizing, size, handleResizeMouseDown } = useResizable({
    width: 420,
    height: 320,
  });
  const [showBranchedModal, setShowBranchedModal] = useState(false);
  const [showParamsOverrideModal, setShowParamsOverrideModal] = useState(false);

  const { nodes, edges } = useMemo(() => {
    const nodes: any[] = [];
    const edges: any[] = [];
    const renderedTrials = new Map<number | string, string>(); // Map trial.id -> nodeId
    const { yStep, branchHorizontalSpacing, branchVerticalOffset } =
      LAYOUT_CONSTANTS;
    // Calculate the center X position based on the modal width
    const xTrial = size.width / 3.1;

    // Collect all trial IDs that are branches (recursively)
    const collectAllBranchIds = (trialsList: Trial[]): Set<number> => {
      const branchIds = new Set<number>();
      const processItem = (trial: Trial) => {
        if (trial.branches && Array.isArray(trial.branches)) {
          trial.branches.forEach((branchId: number | string) => {
            const numId =
              typeof branchId === "string" ? parseInt(branchId) : branchId;
            branchIds.add(numId);
            const branchTrial = findTrialById(trials, numId);
            if (branchTrial) {
              processItem(branchTrial);
            }
          });
        }
      };
      trialsList.forEach(processItem);
      return branchIds;
    };

    const branchTrialIds = collectAllBranchIds(trials);
    const mainTrials = trials.filter((trial) => !branchTrialIds.has(trial.id));

    // Recursive function to render a trial and all its branches
    const renderTrialWithBranches = (
      trial: Trial,
      parentId: string,
      x: number,
      y: number,
      depth: number = 0
    ): number => {
      const trialId = `${parentId}-${trial.id}`;
      const isSelected = selectedTrial && selectedTrial.id === trial.id;

      // Check if this trial has already been rendered
      const existingNodeId = renderedTrials.get(trial.id);

      if (existingNodeId) {
        // Trial already rendered, just create the edge without rendering again
        edges.push(createEdge(parentId, existingNodeId));
        return 0; // No depth added since we're not rendering
      }

      // Mark this trial as rendered
      renderedTrials.set(trial.id, trialId);

      // Create edge from parent to this trial
      edges.push(createEdge(parentId, trialId));

      const handleAddBranchForTrial = () => {
        if (onAddBranch) {
          const existingNames = trials.map((t) => t.name);
          const newName = generateUniqueName(existingNames);

          const newBranchTrial: Trial = {
            id: Date.now(),
            type: "Trial",
            name: newName,
            parameters: {},
            trialCode: "",
          };

          onAddBranch(trial.id, newBranchTrial);
        }
      };

      nodes.push(
        createTrialNode(
          trialId,
          trial.name,
          x,
          y,
          !!isSelected,
          () => onSelectTrial(trial),
          isSelected ? handleAddBranchForTrial : undefined
        )
      );

      let maxDepth = 0;

      if (
        trial.branches &&
        Array.isArray(trial.branches) &&
        trial.branches.length > 0
      ) {
        const branchWidths = trial.branches.map((branchId: number | string) =>
          calculateBranchWidth(branchId, trials, branchHorizontalSpacing)
        );
        const totalWidth = branchWidths.reduce(
          (sum: number, width: number) => sum + width,
          0
        );

        let currentX = x - totalWidth / 2;

        trial.branches.forEach((branchId: number | string, index: number) => {
          const branchTrial = findTrialById(trials, branchId);
          if (branchTrial) {
            const branchWidth = branchWidths[index];
            const branchX = currentX + branchWidth / 2;
            const branchY = y + branchVerticalOffset;

            const branchDepth = renderTrialWithBranches(
              branchTrial,
              trialId,
              branchX,
              branchY,
              depth + 1
            );
            maxDepth = Math.max(maxDepth, branchDepth);

            // Edge is created inside renderTrialWithBranches now

            currentX += branchWidth;
          }
        });
      }

      return maxDepth + 1;
    };

    // Render main sequence trials and their branches
    let yPos = 60;
    mainTrials.forEach((trial) => {
      const isSelected = selectedTrial && selectedTrial.id === trial.id;

      // Mark main sequence trials as rendered
      renderedTrials.set(trial.id, String(trial.id));

      const handleAddBranchForTrial = () => {
        if (onAddBranch) {
          const existingNames = trials.map((t) => t.name);
          const newName = generateUniqueName(existingNames);

          const newBranchTrial: Trial = {
            id: Date.now(),
            type: "Trial",
            name: newName,
            parameters: {},
            trialCode: "",
          };

          onAddBranch(trial.id, newBranchTrial);
        }
      };

      nodes.push(
        createTrialNode(
          String(trial.id),
          trial.name,
          xTrial,
          yPos,
          !!isSelected,
          () => onSelectTrial(trial),
          isSelected ? handleAddBranchForTrial : undefined
        )
      );

      // Render branches recursively and calculate max depth
      let maxBranchDepth = 0;
      if (
        trial.branches &&
        Array.isArray(trial.branches) &&
        trial.branches.length > 0
      ) {
        const branchWidths = trial.branches.map((branchId: number | string) =>
          calculateBranchWidth(branchId, trials, branchHorizontalSpacing)
        );
        const totalWidth = branchWidths.reduce(
          (sum: number, width: number) => sum + width,
          0
        );
        let currentX = xTrial - totalWidth / 2;

        trial.branches.forEach((branchId: number | string, index: number) => {
          const branchTrial = findTrialById(trials, branchId);
          if (branchTrial) {
            const branchWidth = branchWidths[index];
            const branchX = currentX + branchWidth / 2;

            const branchDepth = renderTrialWithBranches(
              branchTrial,
              String(trial.id),
              branchX,
              yPos + branchVerticalOffset,
              0
            );
            maxBranchDepth = Math.max(maxBranchDepth, branchDepth);

            // Edge is created inside renderTrialWithBranches now

            currentX += branchWidth;
          }
        });
      }

      yPos += yStep + maxBranchDepth * branchVerticalOffset;
    });

    // Add edges between main sequence trials (vertical connection)
    for (let i = 0; i < mainTrials.length - 1; i++) {
      edges.push(
        createEdge(String(mainTrials[i].id), String(mainTrials[i + 1].id))
      );
    }

    return { nodes, edges };
  }, [
    trials,
    selectedTrial,
    onSelectTrial,
    onAddBranch,
    onUpdateTrial,
    size.width,
  ]);

  // Handler for connecting trials manually within the loop
  const handleConnect = (connection: Connection) => {
    if (!connection.source || !connection.target || !onUpdateTrial) return;

    // Extract the actual trial IDs from the node IDs
    const extractTrialId = (nodeId: string): number | null => {
      const segments = nodeId.split("-");
      const lastSegment = segments[segments.length - 1];
      const parsed = parseInt(lastSegment);
      return isNaN(parsed) ? null : parsed;
    };

    const sourceId = extractTrialId(connection.source);
    const targetId = extractTrialId(connection.target);

    if (sourceId === null || targetId === null) {
      console.error("Invalid connection IDs");
      return;
    }

    // Validate the connection
    const validation = validateConnection(sourceId, targetId, trials);
    if (!validation.isValid) {
      alert(validation.errorMessage || "Invalid connection");
      return;
    }

    // Find and update the source trial
    const sourceTrial = findTrialById(trials, sourceId);
    if (sourceTrial) {
      const branches = sourceTrial.branches || [];
      // Only add if not already present
      if (!branches.includes(targetId)) {
        const updatedTrial = {
          ...sourceTrial,
          branches: [...branches, targetId],
        };
        onUpdateTrial(updatedTrial);
      }
    }
  };

  const subCanvasBg = {
    background: isDark
      ? "radial-gradient(circle at 50% 50%, #23272f 80%, #181a20 100%)"
      : "radial-gradient(circle at 50% 50%, #f7f8fa 80%, #e9ecf3 100%)",
  };

  const patternStyle = getPatternStyle(isDark);

  return (
    <div
      style={{
        position: "fixed",
        left: pos.x,
        top: pos.y,
        zIndex: 2000,
        width: size.width,
        minHeight: size.height,
        height: size.height,
        ...subCanvasBg,
        borderRadius: 12,
        boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
        border: "2px solid #3d92b4",
        overflow: "hidden",
        userSelect: dragging ? "none" : "auto",
        transition: resizing ? "none" : "width 0.1s, height 0.1s",
      }}
    >
      <div
        style={{
          background: "#3d92b4",
          color: "#fff",
          padding: "8px 16px",
          cursor: "grab",
          fontWeight: "bold",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
        onMouseDown={handleMouseDown}
      >
        {loopName}
        <button
          style={{
            background: "none",
            border: "none",
            color: "#fff",
            fontSize: 18,
            cursor: "pointer",
            marginLeft: 8,
          }}
          onClick={onClose}
          title="Close"
        >
          ×
        </button>
      </div>
      <div
        style={{
          width: "100%",
          height: size.height - 40,
          position: "relative",
          ...subCanvasBg,
        }}
      >
        <div style={patternStyle} />

        {/* Branches button - show if there's more than one trial in the loop */}
        {trials.length > 1 && selectedTrial && (
          <button
            style={{
              position: "absolute",
              top: 16,
              right: 16,
              width: 40,
              height: 40,
              borderRadius: "50%",
              background: "#4caf50",
              color: "#fff",
              border: "none",
              cursor: "pointer",
              fontSize: 20,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 2px 8px rgba(0,0,0,0.18)",
              zIndex: 10,
            }}
            title="Branches"
            onClick={() => setShowBranchedModal(true)}
          >
            <TbBinaryTree size={20} color="#fff" />
          </button>
        )}

        {/* Params Override button */}
        {selectedTrial && (
          <button
            style={{
              position: "absolute",
              top: 16,
              right: 64,
              width: 40,
              height: 40,
              borderRadius: "50%",
              background: "#FFD166",
              color: "#fff",
              border: "none",
              cursor: "pointer",
              fontSize: 20,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 2px 8px rgba(0,0,0,0.18)",
              zIndex: 10,
            }}
            title="Parameters Override"
            onClick={() => setShowParamsOverrideModal(true)}
          >
            <FiSettings size={20} color="#fff" />
          </button>
        )}

        {showBranchedModal && (
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              width: "100vw",
              height: "100vh",
              background: "rgba(0,0,0,0.32)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 9999,
            }}
          >
            <div style={{ position: "relative", zIndex: 10000 }}>
              <button
                style={{
                  position: "absolute",
                  top: 12,
                  right: 12,
                  width: 36,
                  height: 36,
                  borderRadius: "50%",
                  background: "rgba(0,0,0,0.5)",
                  color: "#fff",
                  border: "none",
                  cursor: "pointer",
                  fontWeight: "bold",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 22,
                  boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
                }}
                onClick={() => setShowBranchedModal(false)}
                title="Close"
              >
                <FiX />
              </button>
              <BranchedTrial
                selectedTrial={selectedTrial}
                onClose={() => setShowBranchedModal(false)}
              />
            </div>
          </div>
        )}

        {showParamsOverrideModal && (
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              width: "100vw",
              height: "100vh",
              background: "rgba(0,0,0,0.32)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 9999,
            }}
          >
            <div style={{ position: "relative", zIndex: 10000 }}>
              <button
                style={{
                  position: "absolute",
                  top: 12,
                  right: 12,
                  width: 36,
                  height: 36,
                  borderRadius: "50%",
                  background: "rgba(0,0,0,0.5)",
                  color: "#fff",
                  border: "none",
                  cursor: "pointer",
                  fontWeight: "bold",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 22,
                  boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
                }}
                onClick={() => setShowParamsOverrideModal(false)}
                title="Close"
              >
                <FiX />
              </button>
              <ParamsOverride
                selectedTrial={selectedTrial}
                onClose={() => setShowParamsOverrideModal(false)}
              />
            </div>
          </div>
        )}

        <ReactFlow
          proOptions={{ hideAttribution: true }}
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          style={{ background: "transparent", zIndex: 2 }}
          onConnect={handleConnect}
        />
        <ResizeHandle onMouseDown={handleResizeMouseDown} />
      </div>
    </div>
  );
}

export default LoopSubCanvas;
