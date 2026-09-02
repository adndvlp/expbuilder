const idsMatch = (left, right) => String(left) === String(right);

export function allocateTrialId(experimentDoc, seed = Date.now()) {
  let candidate = seed;
  while (experimentDoc.trials.some((trial) => idsMatch(trial.id, candidate))) {
    candidate += 1;
  }
  return candidate;
}

export function allocateLoopId(experimentDoc, seed = Date.now()) {
  let candidate = seed;
  while (
    experimentDoc.loops.some((loop) => idsMatch(loop.id, `loop_${candidate}`))
  ) {
    candidate += 1;
  }
  return `loop_${candidate}`;
}
