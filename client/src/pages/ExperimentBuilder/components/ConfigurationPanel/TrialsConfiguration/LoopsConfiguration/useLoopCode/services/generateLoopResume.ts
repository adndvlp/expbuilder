const routeFields = [
  "NextTrialId",
  "SkipRemaining",
  "BranchingActive",
  "BranchUsedDefault",
  "BranchSourceId",
  "DeferredBranch",
  "BranchCustomParameters",
  "TargetExecuted",
  "InheritedTrialId",
  "InheritedTrialExecuted",
  "RouteInherited",
];

export function generateLoopResumeSampling(
  id: string | number | undefined,
  repetitions: number,
  randomize: boolean,
  conditional: boolean,
): string {
  const key = JSON.stringify(id);
  return `get repetitions() {
    return window.ExpBuilderNavigation?.remainingLoopRepetitions(${key}, ${repetitions}) ?? ${repetitions};
  },
  randomize_order: false,
  sample: { type: 'custom', fn: function(indices) {
    if (window.ExpBuilderNavigation) {
      return window.ExpBuilderNavigation.sampleLoop(${key}, indices, ${Boolean(randomize)}, ${Boolean(conditional)});
    }
    return ${randomize ? 'jsPsych.randomization.shuffle(indices)' : 'indices'};
  } },`;
}

export function generateLoopResumeStart(
  id: string | number | undefined,
  sanitizedId: string,
): string {
  const prefix = `loop_${sanitizedId}_`;
  const read = routeFields.map((field) => `${field}: ${prefix}${field}`).join(",\n");
  const write = routeFields.map((field) => `${prefix}${field} = saved.${field};`).join("\n");
  return `window.ExpBuilderNavigation?.startLoop(${JSON.stringify(id)},
    () => ({ ${read} }),
    saved => { ${write} }
  );`;
}
