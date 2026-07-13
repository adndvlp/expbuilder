import { useState } from "react";
import { TimelineItem } from "../../../../contexts/TrialsContext";

type Props = {
  loopTimeline: TimelineItem[];
  addTrialAsBranch: (parentId: string | number) => Promise<void>;
  addTrialAsParent: (parentId: string | number) => Promise<void>;
  onRefreshMetadata?: () => void;
};

export function useSubCanvasBranchActions({
  loopTimeline,
  addTrialAsBranch,
  addTrialAsParent,
  onRefreshMetadata,
}: Props) {
  const [showAddTrialModal, setShowAddTrialModal] = useState(false);
  const [pendingParentId, setPendingParentId] = useState<
    number | string | null
  >(null);

  const handleAddBranchClick = async (parentId: number | string) => {
    // Check if the parent has branches
    const parentItem = loopTimeline.find((item) => item.id === parentId);
    if (!parentItem) return;

    const parentBranches = parentItem.branches || [];

    // If it has no branches, add directly as branch
    if (parentBranches.length === 0) {
      await addTrialAsBranch(parentId);
      if (onRefreshMetadata) {
        onRefreshMetadata();
      }
      return;
    }

    // If it has branches, show modal to ask
    setPendingParentId(parentId);
    setShowAddTrialModal(true);
  };

  // Handler when the user confirms in the modal
  const handleAddTrialConfirm = async (addAsBranch: boolean) => {
    /* v8 ignore start */
    if (pendingParentId === null) return;
    /* v8 ignore stop */

    setShowAddTrialModal(false);

    if (addAsBranch) {
      await addTrialAsBranch(pendingParentId);
    } else {
      await addTrialAsParent(pendingParentId);
    }

    setPendingParentId(null);

    // Refresh metadata if available
    if (onRefreshMetadata) {
      onRefreshMetadata();
    }
  };

  return {
    showAddTrialModal,
    setShowAddTrialModal,
    pendingParentId,
    setPendingParentId,
    handleAddBranchClick,
    handleAddTrialConfirm,
  };
}
