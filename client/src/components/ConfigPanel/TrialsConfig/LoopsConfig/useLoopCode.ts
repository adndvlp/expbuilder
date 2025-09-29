type Trial = {
  trialName: string;
  pluginName: string;
  timelineProps: string;
};

type Props = {
  repetitions: number;
  randomize: boolean;
  trials: Trial[]; // Agregar array de trials
};

export default function useLoopCode({ repetitions, randomize, trials }: Props) {
  const sanitizeName = (name: string) => {
    return name.replace(/[^a-zA-Z0-9_]/g, "_");
  };

  const genLoopCode = () => {
    // Generar el código de cada trial
    const trialDefinitions = trials
      .map((trial) => {
        return `
    ${trial.timelineProps}
`;
      })
      .join("\n\n");

    // Generar la lista de nombres de trials para el timeline
    const timelineRefs = trials
      .map((trial) => {
        const trialNameSanitized = sanitizeName(trial.trialName);
        return `${trialNameSanitized}_timeline`;
      })
      .join(", ");

    const timelineVariablesRefs = trials
      .map((trial) => {
        const trialNameSanitized = sanitizeName(trial.trialName);
        return `test_stimuli_${trialNameSanitized}`;
      })
      .join(", ");

    const code = `
${trialDefinitions}

const loop_procedure = {
  timeline: [${timelineRefs}],
  timeline_variables: [${timelineVariablesRefs}],
  repetitions: ${repetitions},
  randomize_order: ${randomize},
};
timeline.push(loop_procedure);
`;

    return code;
  };
  return genLoopCode;
}
