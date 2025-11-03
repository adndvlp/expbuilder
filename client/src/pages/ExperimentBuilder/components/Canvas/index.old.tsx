import "@xyflow/react/dist/style.css";
import { FiRefreshCw } from "react-icons/fi";
import { TbBinaryTree } from "react-icons/tb";
import { FiX } from "react-icons/fi";
import { Trial, Loop } from "../ConfigPanel/types";
import LoopRangeModal from "../ConfigPanel/TrialsConfig/LoopsConfig/LoopRangeModal";
import useTrials from "../../hooks/useTrials";
import { useState } from "react";
import ReactFlow from "reactflow";
import TrialNode from "./TrialNode";
import LoopSubCanvas from "./LoopSubCanvas";
import BranchedTrial from "../ConfigPanel/TrialsConfig/BranchedTrial";

const nodeTypes = {
  trial: TrialNode,
};

type Props = {};

function Canvas({}: Props) {
  const {
    trials,
    setTrials,
    selectedTrial,
    setSelectedTrial,
    groupTrialsAsLoop,
    selectedLoop,
    setSelectedLoop,
  } = useTrials();

  const [showLoopModal, setShowLoopModal] = useState(false);
  const [openLoop, setOpenLoop] = useState<any>(null);
  const [showBranchedModal, setShowBranchedModal] = useState(false);

  function isTrial(trial: any): trial is Trial {
    return "parameters" in trial;
  }

  const onAddTrial = (type: string) => {
    const existingNames = [
      ...trials.filter((t) => "parameters" in t).map((t) => t.name),
      ...trials
        .filter((t) => "trials" in t)
        .flatMap((loop: any) => loop.trials.map((trial: any) => trial.name)),
    ];
    let baseName = "New Trial";
    let newName = baseName;
    let counter = 1;
    while (existingNames.includes(newName)) {
      newName = `${baseName} ${counter}`;
      counter++;
    }
    const newTrial: Trial = {
      id: Date.now(),
      type: type,
      name: newName,
      parameters: {},
      trialCode: "",
    };

    // If there's a selected trial or loop, insert the new trial after it
    // Otherwise, add it at the end
    if (selectedTrial) {
      const selectedIndex = trials.findIndex(
        (t) => "id" in t && t.id === selectedTrial.id
      );
      if (selectedIndex !== -1) {
        const newTrials = [...trials];
        newTrials.splice(selectedIndex + 1, 0, newTrial);
        setTrials(newTrials);
      } else {
        setTrials([...trials, newTrial]);
      }
    } else if (selectedLoop) {
      const selectedIndex = trials.findIndex(
        (t) => "id" in t && t.id === selectedLoop.id
      );
      if (selectedIndex !== -1) {
        const newTrials = [...trials];
        newTrials.splice(selectedIndex + 1, 0, newTrial);
        setTrials(newTrials);
      } else {
        setTrials([...trials, newTrial]);
      }
    } else {
      setTrials([...trials, newTrial]);
    }

    setSelectedTrial(newTrial);
    setSelectedLoop(null);
  };

  const onSelectTrial = (trial: Trial) => {
    setSelectedTrial(trial);
  };

  const handleAddLoop = (trialIds: number[]) => {
    console.log(trials);
    const indices = trialIds
      .map((id) => trials.findIndex((t) => "id" in t && t.id === id))
      .filter((idx) => idx !== -1);

    if (indices.length > 1 && groupTrialsAsLoop) {
      groupTrialsAsLoop(indices);
    }
    setShowLoopModal(false);
    console.log(trials);
  };

  const onAddBranch = (parentId: number | string) => {
    // Create new branch trial
    // Get all existing trial names including those in loops
    const existingNames = [
      ...trials.filter((t) => isTrial(t)).map((t: any) => t.name),
      ...trials
        .filter((t) => "trials" in t)
        .flatMap((loop: any) => loop.trials.map((trial: any) => trial.name)),
    ];
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

    // Add the new trial to trials list
    const updatedTrials = [...trials, newBranchTrial];

    // Update the parent (trial or loop) to include this branch
    const updatedTrialsWithBranch = updatedTrials.map((t: any) => {
      if (isTrial(t) && t.id === parentId) {
        return {
          ...t,
          branches: [...(t.branches || []), newBranchTrial.id],
        };
      } else if (!isTrial(t) && t.id === parentId) {
        // It's a loop
        return {
          ...t,
          branches: [...(t.branches || []), newBranchTrial.id],
        };
      }
      return t;
    });

    setTrials(updatedTrialsWithBranch);
    setSelectedTrial(newBranchTrial);
  };

  // Helper function to find a trial by ID
  const findTrialById = (id: number | string): Trial | null => {
    const numId = typeof id === "string" ? parseInt(id) : id;
    const found = trials.find((t: any) => isTrial(t) && t.id === numId);
    return found && isTrial(found) ? found : null;
  };

  // Helper function to find a loop by ID
  const findLoopById = (id: string): Loop | null => {
    const found = trials.find((t: any) => !isTrial(t) && t.id === id);
    return found && !isTrial(found) ? (found as Loop) : null;
  };

  // Helper function to find any item (trial or loop) by ID
  const findItemById = (id: number | string): Trial | Loop | null => {
    if (typeof id === "string" && id.startsWith("loop_")) {
      return findLoopById(id);
    }
    return findTrialById(id);
  };

  let nodes: any[] = [];
  let edges: any[] = [];
  const xTrial = 250;
  const yStep = 100;
  const branchHorizontalSpacing = 200; // Fixed horizontal spacing between branches
  const branchVerticalOffset = 100; // Fixed vertical offset for branches

  const trialIdsInLoops = trials
    .filter((item) => "trials" in item)
    .flatMap((loop: any) => loop.trials.map((t: any) => t.id));

  // Collect all trial IDs and loop IDs that are branches of other trials or loops (recursively)
  const collectAllBranchIds = (items: any[]): Set<number | string> => {
    const branchIds = new Set<number | string>();
    const processItem = (item: any) => {
      if (item.branches && Array.isArray(item.branches)) {
        item.branches.forEach((branchId: number | string) => {
          branchIds.add(branchId);

          // Check if it's a trial (number or numeric string)
          const numId =
            typeof branchId === "string" && !branchId.startsWith("loop_")
              ? parseInt(branchId)
              : typeof branchId === "number"
                ? branchId
                : null;

          if (numId !== null) {
            const branchTrial = findTrialById(numId);
            if (branchTrial) {
              processItem(branchTrial);
            }
          }
        });
      }
    };
    items.forEach(processItem);
    return branchIds;
  };

  const branchIds = collectAllBranchIds(trials);

  const allBlocks = trials.filter((item) => {
    if (isTrial(item)) {
      return !trialIdsInLoops.includes(item.id) && !branchIds.has(item.id);
    } else {
      // For loops, check if the loop ID is in branchIds
      return !branchIds.has(item.id);
    }
  });

  // Recursive function to render a loop and all its branches
  const renderLoopWithBranches = (
    loop: Loop,
    parentId: string,
    x: number,
    y: number,
    depth: number = 0
  ): number => {
    const loopId = `${parentId}-${loop.id}`;
    const isSelected =
      (selectedLoop && selectedLoop.id === loop.id) ||
      (openLoop && openLoop.id === loop.id);

    nodes.push({
      id: loopId,
      type: "trial",
      data: {
        name: loop.name,
        selected: isSelected,
        onAddBranch: isSelected ? () => onAddBranch(loop.id) : undefined,
        onClick: () => {
          setSelectedLoop(loop);
          setSelectedTrial(null);
          setOpenLoop(loop);
        },
      },
      position: { x, y },
      draggable: false,
    });

    let maxDepth = 0;

    // Recursively render branches
    if (
      loop.branches &&
      Array.isArray(loop.branches) &&
      loop.branches.length > 0
    ) {
      // Calculate total width needed for all branches and their sub-branches
      const calculateBranchWidth = (branchId: number | string): number => {
        const item = findItemById(branchId);
        if (!item) return branchHorizontalSpacing;

        if (isTrial(item)) {
          const branchTrial = item as Trial;
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
        } else {
          // For loops, just return standard spacing
          return branchHorizontalSpacing;
        }
      };

      const branchWidths = loop.branches.map((branchId) =>
        calculateBranchWidth(branchId)
      );
      const totalWidth = branchWidths.reduce((sum, width) => sum + width, 0);

      let currentX = x - totalWidth / 2;

      loop.branches.forEach((branchId: number | string, index: number) => {
        const item = findItemById(branchId);
        if (item) {
          const branchWidth = branchWidths[index];
          const branchX = currentX + branchWidth / 2;
          const branchY = y + branchVerticalOffset;

          if (isTrial(item)) {
            // Recursively render trial branch and its sub-branches
            const branchTrial = item as Trial;
            const branchDepth = renderTrialWithBranches(
              branchTrial,
              loopId,
              branchX,
              branchY,
              depth + 1
            );
            maxDepth = Math.max(maxDepth, branchDepth);

            // Create edge from loop to branch trial
            edges.push({
              id: `e${loopId}-${loopId}-${branchTrial.id}`,
              source: loopId,
              target: `${loopId}-${branchTrial.id}`,
              type: "default",
            });
          } else {
            // Recursively render nested loop branch
            const nestedLoop = item as Loop;
            const nestedDepth = renderLoopWithBranches(
              nestedLoop,
              loopId,
              branchX,
              branchY,
              depth + 1
            );
            maxDepth = Math.max(maxDepth, nestedDepth);

            // Create edge from loop to nested loop
            edges.push({
              id: `e${loopId}-${loopId}-${nestedLoop.id}`,
              source: loopId,
              target: `${loopId}-${nestedLoop.id}`,
              type: "default",
            });
          }

          currentX += branchWidth;
        }
      });
    }

    return maxDepth + 1;
  };

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

    nodes.push({
      id: trialId,
      type: "trial",
      data: {
        name: trial.name,
        selected: isSelected,
        onAddBranch: isSelected ? () => onAddBranch(trial.id) : undefined,
        onClick: () => {
          onSelectTrial(trial);
          setSelectedLoop(null);
        },
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
        const item = findItemById(branchId);
        if (!item) return branchHorizontalSpacing;

        // For loops, just return standard spacing (they don't have sub-branches)
        if (!isTrial(item)) {
          return branchHorizontalSpacing;
        }

        const branchTrial = item as Trial;
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
        const item = findItemById(branchId);
        if (item) {
          const branchWidth = branchWidths[index];
          const branchX = currentX + branchWidth / 2;
          const branchY = y + branchVerticalOffset;

          if (isTrial(item)) {
            // Recursively render trial branch and its sub-branches
            const branchTrial = item as Trial;
            const branchDepth = renderTrialWithBranches(
              branchTrial,
              trialId,
              branchX,
              branchY,
              depth + 1
            );
            maxDepth = Math.max(maxDepth, branchDepth);

            // Create edge from parent trial to branch trial
            edges.push({
              id: `e${trialId}-${trialId}-${branchTrial.id}`,
              source: trialId,
              target: `${trialId}-${branchTrial.id}`,
              type: "default",
            });
          } else {
            // Render loop branch and its sub-branches
            const loop = item as Loop;
            const loopDepth = renderLoopWithBranches(
              loop,
              trialId,
              branchX,
              branchY,
              depth + 1
            );
            maxDepth = Math.max(maxDepth, loopDepth);

            // Create edge from parent trial to loop
            edges.push({
              id: `e${trialId}-${trialId}-${loop.id}`,
              source: trialId,
              target: `${trialId}-${loop.id}`,
              type: "default",
            });
          }

          currentX += branchWidth;
        }
      });
    }

    return maxDepth + 1;
  };

  // Render main sequence trials and their branches
  let yPos = 100;
  allBlocks.forEach((item) => {
    const itemId = isTrial(item) ? String(item.id) : `loop-${item.id}`;

    const isSelected = isTrial(item)
      ? selectedTrial && selectedTrial.id === item.id
      : (selectedLoop && selectedLoop.id === item.id) ||
        (openLoop && openLoop.id === item.id);

    nodes.push({
      id: itemId,
      type: "trial",
      data: {
        name: item.name,
        selected: isSelected,
        onAddBranch: isSelected ? () => onAddBranch(item.id) : undefined,
        onClick: () => {
          if (isTrial(item)) {
            onSelectTrial(item);
            setSelectedLoop(null);
            const parentLoop = trials.find(
              (t: any) =>
                t.trials && t.trials.some((tr: any) => tr.id === item.id)
            );
            if (parentLoop) {
              setOpenLoop(parentLoop);
            } else {
              setOpenLoop(null);
            }
          } else {
            setSelectedLoop(item);
            setSelectedTrial(null);
            setOpenLoop(item);
          }
        },
      },
      position: { x: xTrial, y: yPos },
      draggable: false,
    });

    // Render branches recursively and calculate max depth
    let maxBranchDepth = 0;
    if (
      item.branches &&
      Array.isArray(item.branches) &&
      item.branches.length > 0
    ) {
      // Calculate total width needed for all branches
      const calculateBranchWidth = (branchId: number | string): number => {
        const branchItem = findItemById(branchId);
        if (!branchItem) return branchHorizontalSpacing;

        // For loops, just return standard spacing
        if (!isTrial(branchItem)) {
          return branchHorizontalSpacing;
        }

        const branchTrial = branchItem as Trial;
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

      const branchWidths = item.branches.map((branchId) =>
        calculateBranchWidth(branchId)
      );
      const totalWidth = branchWidths.reduce((sum, width) => sum + width, 0);
      let currentX = xTrial - totalWidth / 2;

      item.branches.forEach((branchId: number | string, index: number) => {
        const branchItem = findItemById(branchId);
        if (branchItem) {
          const branchWidth = branchWidths[index];
          const branchX = currentX + branchWidth / 2;

          if (isTrial(branchItem)) {
            // Render trial branch
            const branchTrial = branchItem as Trial;
            const branchDepth = renderTrialWithBranches(
              branchTrial,
              itemId,
              branchX,
              yPos + branchVerticalOffset,
              0
            );
            maxBranchDepth = Math.max(maxBranchDepth, branchDepth);

            // Create edge from parent to branch trial
            edges.push({
              id: `e${itemId}-${itemId}-${branchTrial.id}`,
              source: itemId,
              target: `${itemId}-${branchTrial.id}`,
              type: "default",
            });
          } else {
            // Render loop branch
            const loop = branchItem as Loop;
            const loopDepth = renderLoopWithBranches(
              loop,
              itemId,
              branchX,
              yPos + branchVerticalOffset,
              0
            );
            maxBranchDepth = Math.max(maxBranchDepth, loopDepth);

            // Create edge from parent to loop
            edges.push({
              id: `e${itemId}-${itemId}-${loop.id}`,
              source: itemId,
              target: `${itemId}-${loop.id}`,
              type: "default",
            });
          }

          currentX += branchWidth;
        }
      });
    }

    // Increase yPos based on how many levels of branches exist
    // Add extra spacing if there are branches to avoid visual confusion
    if (maxBranchDepth > 0) {
      yPos += yStep + maxBranchDepth * branchVerticalOffset + 20; // Extra 20px padding
    } else {
      yPos += yStep;
    }
  });

  // Create vertical edges between main sequence trials
  for (let i = 0; i < allBlocks.length - 1; i++) {
    const currentId = isTrial(allBlocks[i])
      ? String(allBlocks[i].id)
      : `loop-${allBlocks[i].id}`;
    const nextId = isTrial(allBlocks[i + 1])
      ? String(allBlocks[i + 1].id)
      : `loop-${allBlocks[i + 1].id}`;

    edges.push({
      id: `e${currentId}-${nextId}`,
      source: currentId,
      target: nextId,
      type: "default",
    });
  }

  const isDark =
    window.matchMedia &&
    window.matchMedia("(prefers-color-scheme: dark)").matches;

  const canvasBg: React.CSSProperties = {
    background: isDark
      ? "radial-gradient(circle at 50% 50%, #23272f 80%, #181a20 100%)"
      : "radial-gradient(circle at 50% 50%, #f7f8fa 80%, #e9ecf3 100%)",
    minHeight: "100vh",
    width: "100%",
    height: "100vh",
    position: "relative",
    overflow: "visible",
  };

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

  const fabStyle: React.CSSProperties = {
    width: "56px",
    height: "56px",
    background: isDark ? "#ffb300" : "#1976d2",
    color: isDark ? "#23272f" : "#fff",
    borderRadius: "50%",
    boxShadow: "0 4px 16px rgba(0,0,0,0.18)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    position: "fixed",
    bottom: "32px",
    right: "32px",
    zIndex: 10,
    fontSize: "32px",
    border: "none",
    outline: "none",
    transition: "background 0.2s",
  };

  return (
    <div style={canvasBg}>
      <div style={patternStyle} />
      <div
        style={{
          width: "100%",
          height: "100vh",
          position: "relative",
          zIndex: 1,
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 24,
            left: 24,
            display: "flex",
            gap: 16,
            zIndex: 10,
          }}
        >
          <button
            style={{
              ...fabStyle,
              position: "static",
              width: 48,
              height: 48,
              fontSize: 24,
              background: "#1976d2",
              color: "#fff",
              boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
            }}
            onClick={() => setShowLoopModal(true)}
            title="Add loop"
          >
            <FiRefreshCw size={24} color="#fff" />
          </button>
          <button
            style={{
              ...fabStyle,
              position: "static",
              width: 48,
              height: 48,
              fontSize: 28,
              background: "#ffb300",
              color: "#fff",
              boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
            }}
            onClick={() => onAddTrial("Trial")}
            title="Add trial"
          >
            <span style={{ fontWeight: "bold", color: "#fff" }}>+</span>
          </button>
          {selectedTrial && (
            <button
              style={{
                ...fabStyle,
                position: "static",
                width: 48,
                height: 48,
                fontSize: 24,
                background: "#4caf50",
                color: "#fff",
                boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
              }}
              title="Branch"
              onClick={() => setShowBranchedModal(true)}
            >
              <TbBinaryTree size={24} color="#fff" />
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
                    background: "none",
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
                  title="Cerrar"
                >
                  <FiX />
                </button>
                <BranchedTrial selectedTrial={selectedTrial} />
              </div>
            </div>
          )}
        </div>
        <ReactFlow
          proOptions={{ hideAttribution: true }}
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          style={{ background: "transparent", zIndex: 0 }}
        />
        {openLoop && openLoop.trials && (
          <LoopSubCanvas
            trials={openLoop.trials}
            loopName={openLoop.name}
            isDark={isDark}
            selectedTrial={selectedTrial}
            onClose={() => {
              setOpenLoop(null);
              setSelectedLoop(null);
            }}
            onSelectTrial={(trial) => {
              setSelectedTrial(trial);
              setSelectedLoop(null);
              const updatedLoop = trials.find((t: any) => t.id === openLoop.id);
              if (updatedLoop) setOpenLoop(updatedLoop);
            }}
            onUpdateTrial={(updatedTrial) => {
              const updatedLoops = trials.map((loop: any) => {
                if (loop.id === openLoop.id) {
                  return {
                    ...loop,
                    trials: loop.trials.map((t: any) =>
                      t.id === updatedTrial.id ? updatedTrial : t
                    ),
                  };
                }
                return loop;
              });
              setTrials(updatedLoops);
              const refreshedLoop = updatedLoops.find(
                (l: any) => l.id === openLoop.id
              );
              if (refreshedLoop) setOpenLoop(refreshedLoop);
            }}
            onAddBranch={(parentTrialId, newBranchTrial) => {
              const updatedLoops = trials.map((loop: any) => {
                if (loop.id === openLoop.id) {
                  return {
                    ...loop,
                    trials: [
                      ...loop.trials.map((t: any) =>
                        t.id === parentTrialId
                          ? {
                              ...t,
                              branches: [
                                ...(t.branches || []),
                                newBranchTrial.id,
                              ],
                            }
                          : t
                      ),
                      newBranchTrial,
                    ],
                  };
                }
                return loop;
              });
              setTrials(updatedLoops);
              const refreshedLoop = updatedLoops.find(
                (l: any) => l.id === openLoop.id
              );
              if (refreshedLoop) setOpenLoop(refreshedLoop);
            }}
          />
        )}
        {showLoopModal && (
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
              <LoopRangeModal
                trials={trials.filter((t) => "id" in t) as Trial[]}
                onConfirm={handleAddLoop}
                onClose={() => setShowLoopModal(false)}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Canvas;
