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
