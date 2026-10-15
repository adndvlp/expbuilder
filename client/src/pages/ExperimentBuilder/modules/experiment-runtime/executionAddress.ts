export type ExecutionAddress = {
  targetId: string | number;
  targetKind: "trial" | "loop";
  targetOwnerId: string | null;
  enterLoopIds: string[];
};
