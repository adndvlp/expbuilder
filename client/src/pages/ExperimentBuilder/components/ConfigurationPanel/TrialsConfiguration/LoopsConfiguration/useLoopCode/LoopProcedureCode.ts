import { LoopCondition } from "./types";
import { generateConditionalLoopFunction } from "./services/generateConditionalLoopFunction";
import { generateLoopResumeSampling } from "./services/generateLoopResume";

type Props = {
  code: string;
  itemDefinitions: string;
  loopIdSanitized: string;
  id: string | undefined;
  timelineRefs: string;
  repetitions: number;
  randomize: boolean;
  isConditionalLoop?: boolean | undefined;
  loopConditions?: LoopCondition[] | undefined;
};

export default function LoopProcedureCode({
  code, itemDefinitions, loopIdSanitized, id, timelineRefs,
  randomize, repetitions, isConditionalLoop, loopConditions,
}: Props) {
  code += `
    ${itemDefinitions}
    const ${loopIdSanitized}_procedure = {
      timeline: [${timelineRefs}],
      timeline_variables: test_stimuli_${loopIdSanitized}.length ? test_stimuli_${loopIdSanitized} : [{}],
      ${generateLoopResumeSampling(id, repetitions, randomize, Boolean(isConditionalLoop && loopConditions?.length))}
      ${generateConditionalLoopFunction(isConditionalLoop, loopConditions, id)}
`;
  return { code };
}
