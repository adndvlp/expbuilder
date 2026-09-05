import { blockedRequirements } from "./blockedRequirements.mjs";
import { coveredRequirements } from "./coveredRequirements.mjs";

export const acceptanceCoverage = {
  ...coveredRequirements,
  ...blockedRequirements,
};

export const verticalCapabilities = {
  "RUNTIME-BRANCH-MATCH": "branching-runtime.spec.ts",
  "RUNTIME-LOOP-ROOT-EXIT": "branching-runtime.spec.ts",
  "RUNTIME-LOOP-PARALLEL-LEVEL": "loop-placement-runtime.spec.ts",
  "RUNTIME-LOOP-SEQUENTIAL-LEVEL": "loop-placement-runtime.spec.ts",
  "RUNTIME-ERROR-GUARD": "branching-runtime.spec.ts",
  "RUNTIME-DYNAMIC-ASSET": "branching-runtime.spec.ts",
  "RUNTIME-CORRUPT-ROUTE-GUARD": "branching-runtime.spec.ts",
  "RUNTIME-MOVE-ORDER": "composed-runtime.spec.ts",
  "RUNTIME-EXIT-PARAMS": "composed-runtime.spec.ts",
  "RUNTIME-PARAMS-OVERRIDE": "conditions-runtime.spec.ts",
  "RUNTIME-CONDITIONAL-LOOP": "conditions-runtime.spec.ts",
  "RUNTIME-JUMP-ROOT": "navigation-runtime.spec.ts",
  "RUNTIME-JUMP-INVALID": "navigation-negative-runtime.spec.ts",
  "RUNTIME-RESUME-BRANCH": "navigation-runtime.spec.ts",
  "RUNTIME-RESUME-SEQUENTIAL": "navigation-runtime.spec.ts",
  "RUNTIME-NESTED-ROOT-EXIT": "nested-loop-runtime.spec.ts",
  "RUNTIME-NESTED-PARENT-EXIT": "nested-loop-runtime.spec.ts",
  "RUNTIME-NESTED-ANCESTOR-EXIT": "nested-loop-runtime.spec.ts",
  "RUNTIME-BRANCH-CONDITIONAL-LOOP":
    "interaction-conditions-runtime.spec.ts",
  "RUNTIME-LOOP-EXIT-CONDITIONAL-LOOP":
    "interaction-conditions-runtime.spec.ts",
  "RUNTIME-PARAMS-CONDITIONAL-LOOP":
    "interaction-conditions-runtime.spec.ts",
  "RUNTIME-BRANCH-JUMP": "interaction-navigation-runtime.spec.ts",
  "RUNTIME-LOOP-EXIT-JUMP": "interaction-navigation-runtime.spec.ts",
  "RUNTIME-NESTED-EXIT-RESUME": "interaction-navigation-runtime.spec.ts",
  "RUNTIME-RESOLVED-MEGA": "mega-runtime.spec.ts",
};
