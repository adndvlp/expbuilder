import { useState } from "react";
import { vi } from "vitest";
import useLoadData from "../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/BranchedTrial/useLoadData";
import type { DataDefinition } from "../../../pages/ExperimentBuilder/components/ConfigurationPanel/types";
import type {
  Condition,
} from "../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/BranchedTrial/types";

export function useLoadDataHarness({
  isOpen = true,
  selectedTrial,
  initialConditions = [],
  targetTrialParameters = {},
  loadTargetTrialParameters = vi.fn(async () => {}),
  loadPluginParameters = vi.fn(async () => ({
    parameters: [],
    data: [{ key: "response", label: "Response", type: "string" }],
  })),
  getLoopTimeline = vi.fn(async () => []),
}: {
  isOpen?: boolean;
  selectedTrial: any;
  initialConditions?: Condition[];
  targetTrialParameters?: Record<string, any[]>;
  loadTargetTrialParameters?: (trialId: string | number) => Promise<void>;
  loadPluginParameters?: (...args: any[]) => Promise<{
    parameters: any[];
    data: DataDefinition[];
  }>;
  getLoopTimeline?: (loopId: string | number) => Promise<any>;
}) {
  const [conditions, setConditions] = useState<Condition[]>(initialConditions);
  const [data, setData] = useState<DataDefinition[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useLoadData({
    isOpen,
    conditions,
    selectedTrial,
    targetTrialParameters,
    loadTargetTrialParameters,
    setData,
    setError,
    setLoading,
    loadPluginParameters,
    getLoopTimeline,
    setConditions,
  });
  return {
    conditions,
    data,
    error,
    loading,
    setConditions,
  };
}
