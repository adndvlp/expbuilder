export type SessionNameToken = {
  id: string;
  type: string;
  dateFormat: string;
  timeFormat: string;
  randomLength: number;
  customValue: string;
  counterDigits: number;
};

export type LocalExperimentCodeOptions = {
  experimentID: string | undefined;
  sessionNameTokens: SessionNameToken[];
  sessionNameSeparator: string;
  evaluateCondition: string;
  branchingEvaluation: string;
  baseCode: string;
  customCode: string | undefined;
  customPreInitCode: { local: string };
  extensions: string;
  localParams: Record<string, string>;
  progressBar: boolean;
};
