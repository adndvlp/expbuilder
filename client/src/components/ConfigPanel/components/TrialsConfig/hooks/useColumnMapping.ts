import { useState } from "react";
import type { ColumnMapping } from "../../../types";

export function useColumnMapping(initialMapping: ColumnMapping = {}) {
  const [columnMapping, setColumnMapping] =
    useState<ColumnMapping>(initialMapping);

  return {
    columnMapping,
    setColumnMapping,
  };
}
