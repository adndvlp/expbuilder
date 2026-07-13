import { useMemo } from "react";
import { Loop, Trial } from "../../ConfigurationPanel/types";
import { buildFlowLayout } from "../services/buildFlowLayout";

interface UseFlowLayoutProps {
  timeline: any[];
  selectedTrial: Trial | null;
  selectedLoop: any;
  onSelectTrial: (trial: Trial) => void;
  onSelectLoop: (loop: Loop) => void;
  onAddBranch: (id: number | string) => void;
  onOpenLoop?: (loopId: string) => void;
  openLoop?: any;
  setOpenLoop?: (loop: any) => void;
}

export function useFlowLayout({
  timeline,
  selectedTrial,
  selectedLoop,
  onSelectTrial,
  onSelectLoop,
  onAddBranch,
  onOpenLoop,
  openLoop,
}: UseFlowLayoutProps) {
  const selectedTrialId = selectedTrial?.id;
  const selectedLoopId = selectedLoop?.id;
  const openLoopId = openLoop?.id;
  const { nodes, edges } = useMemo(
    () =>
      buildFlowLayout({
        timeline,
        selectedTrialId,
        selectedLoopId,
        openLoopId,
        onSelectTrial,
        onSelectLoop,
        onAddBranch,
        onOpenLoop,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [timeline, selectedTrialId, selectedLoopId, openLoopId],
  );

  return { nodes, edges };
}
