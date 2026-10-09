import { generateLoopIteration } from "./services/generateLoopIteration";
import { LoopCondition } from "./types";
import { generateConditionalLoopFunction } from "./services/generateConditionalLoopFunction";
import { generateLoopFinishLifecycle } from "./services/generateLoopFinishLifecycle";
import { generateLoopRoutingLifecycle } from "./services/generateLoopRoutingLifecycle";
import { generateLoopResumeSampling } from "./services/generateLoopResume";

type Props = {
  code: string;
  parentLoopIdSanitized: string | null;
  itemDefinitions: string;
  loopIdSanitized: string;
  id: string | undefined;
  itemWrappers: string;
  timelineRefs: string;
  repetitions: number;
  randomize: boolean;
  isConditionalLoop?: boolean | undefined;
  loopConditions?: LoopCondition[] | undefined;
  descendantIdEntries: string;
  lastItemId: string | number | null;
};

export default function LoopProcedureCode({
  code,
  parentLoopIdSanitized,
  itemDefinitions,
  loopIdSanitized,
  id,
  itemWrappers,
  timelineRefs,
  randomize,
  repetitions,
  isConditionalLoop,
  loopConditions,
  descendantIdEntries,
  lastItemId,
}: Props) {
  code += `
    
    ${itemDefinitions}

// --- Trial routing state for loop ${id || "main"} ---
let loop_${loopIdSanitized}_NextTrialId = null;
let loop_${loopIdSanitized}_SkipRemaining = false;
let loop_${loopIdSanitized}_BranchingActive = false;
let loop_${loopIdSanitized}_BranchUsedDefault = false;
let loop_${loopIdSanitized}_BranchSourceId = null;
let loop_${loopIdSanitized}_DeferredBranch = null;
let loop_${loopIdSanitized}_BranchCustomParameters = null; // Store custom parameters for branching within loops
let loop_${loopIdSanitized}_TargetExecuted = false; // Indicates if the target trial has already been executed in this iteration
let loop_${loopIdSanitized}_InheritedTrialId = null;
let loop_${loopIdSanitized}_InheritedTrialExecuted = false;
let loop_${loopIdSanitized}_RouteInherited = false; // Preserve inherited routes until their completion propagates outward
const loop_${loopIdSanitized}_DescendantTrialIds = [${descendantIdEntries}];
const loop_${loopIdSanitized}_LastItemId = ${JSON.stringify(lastItemId)};

${itemWrappers}

${generateLoopIteration(loopIdSanitized, timelineRefs, id)}

const ${loopIdSanitized}_procedure = {
  timeline: [${loopIdSanitized}_iteration],
  timeline_variables: test_stimuli_${loopIdSanitized}.length ? test_stimuli_${loopIdSanitized} : [{}],
  ${generateLoopResumeSampling(id, repetitions, randomize, Boolean(isConditionalLoop && loopConditions?.length))}
  ${generateConditionalLoopFunction(isConditionalLoop, loopConditions, id)}
  ${generateLoopRoutingLifecycle({
    id,
    isConditionalLoop: Boolean(isConditionalLoop),
    loopIdSanitized,
    parentLoopIdSanitized,
    resetGlobalBranching: Boolean(loopConditions?.length),
  })}
  ${generateLoopFinishLifecycle({
    id,
    loopIdSanitized,
    parentLoopIdSanitized,
  })}
`;
  return { code };
}
