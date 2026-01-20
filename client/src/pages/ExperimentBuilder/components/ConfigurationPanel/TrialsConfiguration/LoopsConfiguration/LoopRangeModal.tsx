import { useState, useEffect } from "react";
import { TimelineItem } from "../../../contexts/TrialsContext";

type Props = {
  timeline: TimelineItem[];
  onConfirm: (trialIds: (number | string)[]) => void;
  onClose?: () => void;
  selectedTrialId?: number | string | null;
};

function LoopRangeModal({
  timeline,
  onConfirm,
  onClose,
  selectedTrialId,
}: Props) {
  const [selectedIds, setSelectedIds] = useState<Set<number | string>>(
    new Set()
  );
  const [autoSelectedIds, setAutoSelectedIds] = useState<Set<number | string>>(
    new Set()
  );

  // Función recursiva para obtener todas las branches de un item
  const getAllBranchIds = (
    itemId: number | string,
    visited = new Set<number | string>()
  ): (number | string)[] => {
    if (visited.has(itemId)) return [];
    visited.add(itemId);

    const item = timeline.find((t) => t.id === itemId);
    if (!item || !item.branches || item.branches.length === 0) {
      return [];
    }

    const branchIds: (number | string)[] = [...item.branches];

    // Recursivamente obtener branches de las branches
    for (const branchId of item.branches) {
      const nestedBranches = getAllBranchIds(branchId, visited);
      branchIds.push(...nestedBranches);
    }

    return branchIds;
  };

  // Actualizar auto-selección cuando cambian las selecciones manuales
  useEffect(() => {
    const auto = new Set<number | string>();

    selectedIds.forEach((id) => {
      const branches = getAllBranchIds(id);
      branches.forEach((branchId) => auto.add(branchId));
    });

    setAutoSelectedIds(auto);
  }, [selectedIds, timeline]);

  const handleToggle = (id: number | string) => {
    const newSelected = new Set(selectedIds);

    if (newSelected.has(id)) {
      // Deseleccionar
      newSelected.delete(id);
    } else {
      // Seleccionar
      newSelected.add(id);
    }

    setSelectedIds(newSelected);
  };

  // Helper para mostrar el nombre con indicador de tipo
  const getItemLabel = (item: TimelineItem) => {
    return item.type === "loop" ? `${item.name}` : item.name;
  };

  // Combinar selecciones manuales y automáticas
  const allSelectedIds = new Set([...selectedIds, ...autoSelectedIds]);

  return (
    <div
      style={{
        background: "rgba(0,0,0,0.32)",
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
          color: "var(--text-dark)",
          fontWeight: 600,
          fontSize: 18,
        }}
      >
        Select trials/loops for loop
      </h5>

      <div
        style={{
          fontSize: 13,
          color: "var(--text-dark)",
          marginBottom: 12,
          textAlign: "center",
          opacity: 0.8,
        }}
      >
        Select items to include. Branches will be auto-included.
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
          const isAutoSelected = autoSelectedIds.has(item.id);
          const isSelected = isManuallySelected || isAutoSelected;

          return (
            <label
              key={item.id}
              style={{
                display: "flex",
                alignItems: "center",
                padding: "8px 12px",
                marginBottom: "6px",
                borderRadius: "6px",
                cursor:
                  isAutoSelected && !isManuallySelected ? "default" : "pointer",
                background: isSelected
                  ? isManuallySelected
                    ? "rgba(76, 175, 80, 0.2)"
                    : "rgba(76, 175, 80, 0.1)"
                  : "rgba(255, 255, 255, 0.05)",
                border: `1px solid ${
                  isSelected
                    ? isManuallySelected
                      ? "rgba(76, 175, 80, 0.5)"
                      : "rgba(76, 175, 80, 0.3)"
                    : "rgba(255, 255, 255, 0.1)"
                }`,
                transition: "all 0.2s",
              }}
            >
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => handleToggle(item.id)}
                disabled={isAutoSelected && !isManuallySelected}
                style={{
                  marginRight: "12px",
                  cursor:
                    isAutoSelected && !isManuallySelected
                      ? "default"
                      : "pointer",
                  width: "18px",
                  height: "18px",
                }}
              />
              <span
                style={{
                  color: "var(--text-dark)",
                  fontSize: 15,
                  flex: 1,
                }}
              >
                {getItemLabel(item)}
              </span>
              {isAutoSelected && !isManuallySelected && (
                <span
                  style={{
                    fontSize: 11,
                    color: "rgba(76, 175, 80, 0.8)",
                    fontStyle: "italic",
                  }}
                >
                  (auto-included)
                </span>
              )}
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
            if (allSelectedIds.size < 2) {
              alert("Please select at least 2 items to create a loop.");
              return;
            }
            const ids = Array.from(allSelectedIds);
            onConfirm(ids);
            if (onClose) onClose();
          }}
          disabled={allSelectedIds.size < 2}
          style={{
            background: allSelectedIds.size < 2 ? "#ccc" : "#4caf50",
            color: "#fff",
            padding: "8px 24px",
            borderRadius: 6,
            fontSize: 15,
            border: "none",
            cursor: allSelectedIds.size < 2 ? "not-allowed" : "pointer",
            fontWeight: 500,
            boxShadow: "0 1px 4px rgba(76,175,80,0.12)",
            transition: "background 0.2s",
          }}
        >
          Confirm ({allSelectedIds.size} items)
        </button>
      </div>
    </div>
  );
}

export default LoopRangeModal;
