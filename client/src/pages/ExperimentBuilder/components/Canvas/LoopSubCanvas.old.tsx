import "@xyflow/react/dist/style.css";
import React, { useRef, useState } from "react";
import ReactFlow from "reactflow";
import TrialNode from "./TrialNode";
import { Trial } from "../ConfigPanel/types";

// Move nodeTypes outside the component to avoid recreating it on each render
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
  // Draggable logic
  const ref = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const [pos, setPos] = useState({ x: 150, y: 250 });
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  // Resizable logic
  const [size, setSize] = useState({ width: 420, height: 320 });
  const [resizing, setResizing] = useState(false);
  const [resizeStart, setResizeStart] = useState({
    x: 0,
    y: 0,
    width: 320,
    height: 220,
  });

  const handleMouseDown = (e: React.MouseEvent) => {
    setDragging(true);
    setOffset({
      x: e.clientX - pos.x,
      y: e.clientY - pos.y,
    });
  };
  const handleMouseUp = () => {
    setDragging(false);
    setResizing(false);
  };
  const handleMouseMove = (e: MouseEvent) => {
    if (dragging) {
      setPos({
        x: e.clientX - offset.x,
        y: e.clientY - offset.y,
      });
    }
    if (resizing) {
      const newWidth = Math.max(
        280,
        resizeStart.width + (e.clientX - resizeStart.x)
      );
      const newHeight = Math.max(
        180,
        resizeStart.height + (e.clientY - resizeStart.y)
      );
      setSize({ width: newWidth, height: newHeight });
    }
  };
  React.useEffect(() => {
    if (dragging || resizing) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    } else {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    }
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [dragging, resizing]);

  const handleResizeMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    setResizing(true);
    setResizeStart({
      x: e.clientX,
      y: e.clientY,
      width: size.width,
      height: size.height,
    });
  };

  // Helper to find trial by ID
  const findTrialById = (id: number | string): Trial | null => {
    const numId = typeof id === "string" ? parseInt(id) : id;
    return trials.find((t) => t.id === numId) || null;
  };

  // Layout for trials
  let nodes: any[] = [];
  let edges: any[] = [];
  const xTrial = 120;
  const yStep = 100;
  const branchHorizontalSpacing = 200;
  const branchVerticalOffset = 100;

  // Collect all trial IDs that are branches (recursively)
  const collectAllBranchIds = (trialsList: Trial[]): Set<number> => {
    const branchIds = new Set<number>();
    const processItem = (trial: Trial) => {
      if (trial.branches && Array.isArray(trial.branches)) {
        trial.branches.forEach((branchId: number | string) => {
          const numId =
            typeof branchId === "string" ? parseInt(branchId) : branchId;
          branchIds.add(numId);
          const branchTrial = findTrialById(numId);
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

  // Filter out branch trials from main sequence
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

    const handleAddBranchForTrial = () => {
      if (onAddBranch) {
        const existingNames = trials.map((t) => t.name);
        let baseName = "New Trial";
        let newName = baseName;
        let counter = 1;
        while (existingNames.includes(newName)) {
          newName = `${baseName} ${counter}`;
          counter++;
        }

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

    nodes.push({
      id: trialId,
      type: "trial",
      data: {
        name: trial.name,
        selected: isSelected,
        onAddBranch: isSelected ? handleAddBranchForTrial : undefined,
        onClick: () => onSelectTrial(trial),
      },
      position: { x, y },
      draggable: false,
    });

    let maxDepth = 0;

    // Recursively render branches
    if (
      trial.branches &&
      Array.isArray(trial.branches) &&
      trial.branches.length > 0
    ) {
      // Calculate total width needed for all branches and their sub-branches
      const calculateBranchWidth = (branchId: number | string): number => {
        const numId =
          typeof branchId === "string" ? parseInt(branchId) : branchId;
        const branchTrial = findTrialById(numId);
        if (!branchTrial) return branchHorizontalSpacing;

        if (!branchTrial.branches || branchTrial.branches.length === 0) {
          return branchHorizontalSpacing;
        }

        // If this branch has sub-branches, calculate their total width
        const subBranchesWidth = branchTrial.branches.reduce(
          (total: number, subBranchId: number | string) => {
            return total + calculateBranchWidth(subBranchId);
          },
          0
        );

        return Math.max(branchHorizontalSpacing, subBranchesWidth);
      };

      // Calculate positions for each branch
      const branchWidths = trial.branches.map((branchId) =>
        calculateBranchWidth(branchId)
      );
      const totalWidth = branchWidths.reduce((sum, width) => sum + width, 0);

      let currentX = x - totalWidth / 2;

      trial.branches.forEach((branchId: number | string, index: number) => {
        const branchTrial = findTrialById(branchId);
        if (branchTrial) {
          const branchWidth = branchWidths[index];
          const branchX = currentX + branchWidth / 2;
          const branchY = y + branchVerticalOffset;

          // Recursively render this branch and its sub-branches
          const branchDepth = renderTrialWithBranches(
            branchTrial,
            trialId,
            branchX,
            branchY,
            depth + 1
          );
          maxDepth = Math.max(maxDepth, branchDepth);

          // Create edge from parent trial to branch
          edges.push({
            id: `e${trialId}-${trialId}-${branchTrial.id}`,
            source: trialId,
            target: `${trialId}-${branchTrial.id}`,
            type: "default",
          });

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

    const handleAddBranchForTrial = () => {
      if (onAddBranch) {
        const existingNames = trials.map((t) => t.name);
        let baseName = "New Trial";
        let newName = baseName;
        let counter = 1;
        while (existingNames.includes(newName)) {
          newName = `${baseName} ${counter}`;
          counter++;
        }

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

    nodes.push({
      id: String(trial.id),
      type: "trial",
      data: {
        name: trial.name,
        selected: isSelected,
        onAddBranch: isSelected ? handleAddBranchForTrial : undefined,
        onClick: () => onSelectTrial(trial),
        onUpdate: onUpdateTrial,
      },
      position: { x: xTrial, y: yPos },
      draggable: false,
    });

    // Render branches recursively and calculate max depth
    let maxBranchDepth = 0;
    if (
      trial.branches &&
      Array.isArray(trial.branches) &&
      trial.branches.length > 0
    ) {
      // Calculate total width needed for all branches
      const calculateBranchWidth = (branchId: number | string): number => {
        const numId =
          typeof branchId === "string" ? parseInt(branchId) : branchId;
        const branchTrial = findTrialById(numId);
        if (!branchTrial) return branchHorizontalSpacing;

        if (!branchTrial.branches || branchTrial.branches.length === 0) {
          return branchHorizontalSpacing;
        }

        const subBranchesWidth = branchTrial.branches.reduce(
          (total: number, subBranchId: number | string) => {
            return total + calculateBranchWidth(subBranchId);
          },
          0
        );

        return Math.max(branchHorizontalSpacing, subBranchesWidth);
      };

      const branchWidths = trial.branches.map((branchId) =>
        calculateBranchWidth(branchId)
      );
      const totalWidth = branchWidths.reduce((sum, width) => sum + width, 0);
      let currentX = xTrial - totalWidth / 2;

      trial.branches.forEach((branchId: number | string, index: number) => {
        const branchTrial = findTrialById(branchId);
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

          // Create edge from parent trial to branch
          edges.push({
            id: `e${trial.id}-${trial.id}-${branchTrial.id}`,
            source: String(trial.id),
            target: `${trial.id}-${branchTrial.id}`,
            type: "default",
          });

          currentX += branchWidth;
        }
      });
    }

    // Increase yPos based on how many levels of branches exist
    yPos += yStep + maxBranchDepth * branchVerticalOffset;
  });

  // Add edges between main sequence trials (vertical connection)
  for (let i = 0; i < mainTrials.length - 1; i++) {
    edges.push({
      id: `e${mainTrials[i].id}-${mainTrials[i + 1].id}`,
      source: String(mainTrials[i].id),
      target: String(mainTrials[i + 1].id),
      type: "default",
    });
  }

  // Fondo dinámico igual que canvas principal
  const subCanvasBg = {
    background: isDark
      ? "radial-gradient(circle at 50% 50%, #23272f 80%, #181a20 100%)"
      : "radial-gradient(circle at 50% 50%, #f7f8fa 80%, #e9ecf3 100%)",
  };

  // Patrón de puntitos igual que el canvas principal
  const patternStyle: React.CSSProperties = {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    pointerEvents: "none",
    backgroundImage:
      "radial-gradient(circle, " +
      (isDark ? "#3a3f4b" : "#dbe2ea") +
      " 1px, transparent 1.5px)",
    backgroundSize: "28px 28px",
    zIndex: 0,
  };

  return (
    <div
      ref={ref}
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
        <ReactFlow
          proOptions={{ hideAttribution: true }}
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          style={{ background: "transparent", zIndex: 2 }}
        />
        {/* Resize handle */}
        <div
          style={{
            position: "absolute",
            right: 2,
            bottom: 2,
            width: 18,
            height: 18,
            background: "rgba(61,146,180,0.7)",
            borderRadius: 4,
            cursor: "nwse-resize",
            zIndex: 10,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            userSelect: "none",
          }}
          onMouseDown={handleResizeMouseDown}
          title="Redimensionar"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M2 12H12M6 8H12M10 4H12"
              stroke="#fff"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </div>
      </div>
    </div>
  );
}

export default LoopSubCanvas;
