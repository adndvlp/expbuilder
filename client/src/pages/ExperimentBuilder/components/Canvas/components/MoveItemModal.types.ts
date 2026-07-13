export type MoveDestination = {
  id: number | string;
  name: string;
  type: "trial" | "loop";
  hasBranches: boolean;
};

export type MoveItemModalProps = {
  onConfirm: (destinationId: number | string, addAsBranch: boolean) => void;
  onClose: () => void;
  itemName?: string;
  availableDestinations: MoveDestination[];
};
