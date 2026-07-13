import { useCallback, useState } from "react";
import type React from "react";

export function useComponentSelection() {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const selectedId = selectedIds[0] ?? null;
  const setSelectedId = useCallback<
    React.Dispatch<React.SetStateAction<string | null>>
  >((value) => {
    setSelectedIds((previousIds) => {
      const previousId = previousIds[0] ?? null;
      const nextId = typeof value === "function" ? value(previousId) : value;
      return nextId ? [nextId] : [];
    });
  }, []);

  return { selectedId, selectedIds, setSelectedId, setSelectedIds };
}
