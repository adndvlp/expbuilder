import { useState } from "react";
import { TimelineItem } from "../../../../contexts/TrialsContext";

type Props = {
  timeline: TimelineItem[];
  onConfirm: (trialIds: (number | string)[]) => void;
  onClose?: () => void;
  selectedTrialId?: number | string | null;
};

function LoopRangeModal({ timeline, onConfirm, onClose }: Props) {
  const [selectedIds, setSelectedIds] = useState<Set<number | string>>(
    new Set(),
  );

  // Recursive function to obtain all branches of an item
  // IDs compare by string value: trials use numeric ids while loops use
  // strings, and either side can arrive stringified after a JSON round-trip.
  const getAllBranchIds = (
    itemId: number | string,
    visited = new Set<string>(),
  ): (number | string)[] => {
    const itemKey = String(itemId);
    if (visited.has(itemKey)) return [];
    visited.add(itemKey);

    const item = timeline.find((t) => String(t.id) === itemKey);
    if (!item || !item.branches || item.branches.length === 0) {
      return [];
    }

    const branchIds: (number | string)[] = [...item.branches];

    // Obtain recursively branches of branches
    for (const branchId of item.branches) {
      const nestedBranches = getAllBranchIds(branchId, visited);
      branchIds.push(...nestedBranches);
    }

    return branchIds;
  };

  // The sequence of a trial is the trial itself plus its recursive branch
  // descendants. Once the user selects something, only items inside the
  // selected sequences stay available; everything else is greyed out and
  // disabled so a loop can group a single trial or a sub-chain of one
  // sequence, but never items from unrelated sequences.
  const allowedKeys =
    selectedIds.size === 0
      ? null
      : new Set<string>(
          [...selectedIds].flatMap((id) => [
            String(id),
            ...getAllBranchIds(id).map((branchId) => String(branchId)),
          ]),
        );

  const handleToggle = (id: number | string) => {
    const newSelected = new Set(selectedIds);

    if (newSelected.has(id)) {
      // Deselect
      newSelected.delete(id);
    } else {
      // Select
      newSelected.add(id);
    }

    setSelectedIds(newSelected);
  };

  // Helper to show name with type indicator
  const getItemLabel = (item: TimelineItem) => {
    return item.type === "loop" ? `${item.name}` : item.name;
  };

  return (
    <div
      style={{
        background: "rgba(0,0,0,0.75)",
        padding: "20px 18px",
        borderRadius: "12px",
        boxShadow: "0 2px 12px rgba(0,0,0,0.14)",
        width: "400px",
        maxWidth: "95vw",
        maxHeight: "80vh",
        margin: "0 auto 20px auto",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        border: "1px solid var(--text-dark)",
      }}
    >
      <h5
        style={{
          margin: "0 0 18px 0",
          color: "#fff",
          fontWeight: 600,
          fontSize: 18,
        }}
      >
        Select trials/loops for loop
      </h5>

      <div
        style={{
          fontSize: 13,
          color: "#fff",
          marginBottom: 12,
          textAlign: "center",
          opacity: 0.8,
        }}
      >
        Select at least 1 item. Only items in the selected sequence stay
        available.
      </div>

      <div
        style={{
          width: "100%",
          maxHeight: "400px",
          overflowY: "auto",
          marginBottom: 16,
          padding: "8px",
        }}
      >
        {timeline.map((item) => {
          const isManuallySelected = selectedIds.has(item.id);
          const isExcluded =
            allowedKeys !== null && !allowedKeys.has(String(item.id));
          const isSelected = isManuallySelected;

          return (
            <label
              key={item.id}
              style={{
                display: "flex",
                alignItems: "center",
                padding: "8px 12px",
                marginBottom: "6px",
                borderRadius: "6px",
                cursor: isExcluded ? "default" : "pointer",
                opacity: isExcluded ? 0.45 : 1,
                background: isSelected
                  ? "rgba(76, 175, 80, 0.2)"
                  : "rgba(255, 255, 255, 0.05)",
                border: `1px solid ${
                  isSelected
                    ? "rgba(76, 175, 80, 0.5)"
                    : "rgba(255, 255, 255, 0.1)"
                }`,
                transition: "all 0.2s",
              }}
            >
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => handleToggle(item.id)}
                disabled={isExcluded}
                style={{
                  marginRight: "12px",
                  cursor: isExcluded ? "default" : "pointer",
                  width: "18px",
                  height: "18px",
                }}
              />
              <span
                style={{
                  color: "#fff",
                  fontSize: 15,
                  flex: 1,
                }}
              >
                {getItemLabel(item)}
              </span>
            </label>
          );
        })}
      </div>

      <div
        style={{
          marginTop: 8,
          display: "flex",
          gap: 24,
          justifyContent: "center",
          width: "100%",
        }}
      >
        {onClose && (
          <button
            onClick={onClose}
            style={{
              padding: "8px 24px",
              fontSize: 15,
              borderRadius: 6,
              border: "1px solid #e60d0dff",
              background: "#fb0000ff",
              color: "#fff",
              cursor: "pointer",
              fontWeight: 500,
              boxShadow: "0 1px 4px rgba(251,0,0,0.10)",
              transition: "background 0.2s",
            }}
          >
            Cancel
          </button>
        )}
        <button
          onClick={() => {
            /* v8 ignore start */
            if (selectedIds.size < 1) {
              alert("Please select at least 1 item to create a loop.");
              return;
            }
            /* v8 ignore stop */
            const ids = Array.from(selectedIds);
            onConfirm(ids);
            if (onClose) onClose();
          }}
          disabled={selectedIds.size < 1}
          style={{
            background: selectedIds.size < 1 ? "#ccc" : "#4caf50",
            color: "#fff",
            padding: "8px 24px",
            borderRadius: 6,
            fontSize: 15,
            border: "none",
            cursor: selectedIds.size < 1 ? "not-allowed" : "pointer",
            fontWeight: 500,
            boxShadow: "0 1px 4px rgba(76,175,80,0.12)",
            transition: "background 0.2s",
          }}
        >
          Confirm ({selectedIds.size} items)
        </button>
      </div>
    </div>
  );
}

export default LoopRangeModal;
