import type { TimelineItem } from "../../../contexts/TrialsContext";
import { useMemo } from "react";
import type { Loop, Trial } from "../../ConfigurationPanel/types";
import { buildFlowLayout } from "../services/buildFlowLayout";
import { buildUnifiedFlowLayout } from "../services/buildUnifiedFlowLayout";

type LegacyFlowLayoutProps = {
  timeline: TimelineItem[];
  selectedTrial: Trial | null;
  selectedLoop: Loop | null;
  onSelectTrial: (trial: Trial) => void;
  onSelectLoop: (loop: Loop) => void;
  onAddBranch: (id: number | string) => void;
  onOpenLoop?: (loopId: string) => void;
  openLoop?: Loop | null;
};

type UnifiedFlowLayoutProps = Parameters<typeof buildUnifiedFlowLayout>[0];
type UseFlowLayoutProps = LegacyFlowLayoutProps | UnifiedFlowLayoutProps;

const isUnifiedLayout = (
  props: UseFlowLayoutProps,
): props is UnifiedFlowLayoutProps => "expandedPath" in props;

export function useFlowLayout(props: UseFlowLayoutProps) {
  return useMemo(() => {
    if (isUnifiedLayout(props)) return buildUnifiedFlowLayout(props);
    return buildFlowLayout({
      timeline: props.timeline,
      selectedTrialId: props.selectedTrial?.id,
      selectedLoopId: props.selectedLoop?.id,
      openLoopId: props.openLoop?.id,
      onSelectTrial: props.onSelectTrial,
      onSelectLoop: (item) => props.onSelectLoop(item as unknown as Loop),
      onAddBranch: props.onAddBranch,
      onOpenLoop: props.onOpenLoop,
    });
  }, [props]);
}
