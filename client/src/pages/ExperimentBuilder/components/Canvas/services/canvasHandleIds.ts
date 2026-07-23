export const CANVAS_HANDLE_IDS = {
  flowSource: "flow-source",
  flowTarget: "flow-target",
  loopEntrySource: "loop-entry-source",
  loopExitTarget: "loop-exit-target",
  loopReturnSource: "loop-return-source",
  loopReturnTarget: "loop-return-target",
} as const;

export const CANVAS_EDGE_HANDLES = {
  flow: {
    sourceHandle: CANVAS_HANDLE_IDS.flowSource,
    targetHandle: CANVAS_HANDLE_IDS.flowTarget,
  },
  loopEntry: {
    sourceHandle: CANVAS_HANDLE_IDS.loopEntrySource,
    targetHandle: CANVAS_HANDLE_IDS.flowTarget,
  },
  loopExit: {
    sourceHandle: CANVAS_HANDLE_IDS.flowSource,
    targetHandle: CANVAS_HANDLE_IDS.loopExitTarget,
  },
  loopReturn: {
    sourceHandle: CANVAS_HANDLE_IDS.loopReturnSource,
    targetHandle: CANVAS_HANDLE_IDS.loopReturnTarget,
  },
  singleItemLoop: {
    sourceHandle: CANVAS_HANDLE_IDS.flowSource,
    targetHandle: CANVAS_HANDLE_IDS.flowTarget,
  },
} as const;
