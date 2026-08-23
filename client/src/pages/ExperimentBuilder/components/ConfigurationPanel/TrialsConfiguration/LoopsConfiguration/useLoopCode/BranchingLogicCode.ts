import { LoopCondition } from "./types";
import { generateConditionalLoopFunction } from "./services/generateConditionalLoopFunction";
import { generateLoopFinishLifecycle } from "./services/generateLoopFinishLifecycle";
import { generateLoopRoutingLifecycle } from "./services/generateLoopRoutingLifecycle";

type Props = {
  code: string;
  parentLoopIdSanitized: string | null;
  itemDefinitions: string;
  loopIdSanitized: string;
  id: string | undefined;
  hasBranchesLoop: boolean | undefined;
  itemWrappers: string;
  timelineRefs: string;
  repetitions: number;
  randomize: boolean;
  isConditionalLoop?: boolean | undefined;
  loopConditions?: LoopCondition[] | undefined;
  branches: (string | number)[] | undefined;
  descendantIdEntries: string;
};

export default function BranchingLogicCode({
  code,
  parentLoopIdSanitized,
  itemDefinitions,
  loopIdSanitized,
  id,
  hasBranchesLoop,
  itemWrappers,
  timelineRefs,
  randomize,
  repetitions,
  isConditionalLoop,
  loopConditions,
  branches,
  descendantIdEntries,
}: Props) {
  code += `
    
    ${itemDefinitions}

// --- Branching logic variables for loop ${id || "main"} ---
let loop_${loopIdSanitized}_NextTrialId = null;
let loop_${loopIdSanitized}_SkipRemaining = false;
let loop_${loopIdSanitized}_BranchingActive = false;
let loop_${loopIdSanitized}_BranchCustomParameters = null; // Store custom parameters for branching within loops
let loop_${loopIdSanitized}_TargetExecuted = false; // Indicates if the target trial has already been executed in this iteration
let loop_${loopIdSanitized}_RouteInherited = false; // Preserve inherited routes until their completion propagates outward
let loop_${loopIdSanitized}_IterationComplete = false; // Indicates that the current iteration is complete
const loop_${loopIdSanitized}_HasBranches = ${hasBranchesLoop ? "true" : "false"};
let loop_${loopIdSanitized}_ShouldBranchOnFinish = false;
const loop_${loopIdSanitized}_DescendantIds = [${descendantIdEntries}];

${itemWrappers}

const ${loopIdSanitized}_procedure = {
  timeline: [${timelineRefs}],
  timeline_variables: test_stimuli_${loopIdSanitized},
  repetitions: ${repetitions},
  randomize_order: ${randomize},
  ${generateConditionalLoopFunction(isConditionalLoop, loopConditions)}
  ${generateLoopRoutingLifecycle({
    id,
    isConditionalLoop: Boolean(isConditionalLoop),
    loopIdSanitized,
    parentLoopIdSanitized,
    resetGlobalBranching: Boolean(loopConditions?.length),
  })}
  ${generateLoopFinishLifecycle({
    branches,
    loopIdSanitized,
    parentLoopIdSanitized,
  })}
`;
  return { code };
}
