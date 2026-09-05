const evidence = (file, title) => ({ file, title });

const serverLoopBranches = "server/__tests__/routes/loop-branches.test.js";
const graphIdentity = "server/__tests__/routes/graph-identity.test.js";
const experimentGraph = "server/__tests__/routes/experiment-graph.test.js";
const loopBranchCommand =
  "server/__tests__/routes/loop-branch-command.test.js";
const loopProjection =
  "client/src/__tests__/components/loopBranching/loopBranchProjection.test.ts";
const branchHook =
  "client/src/__tests__/components/loopBranching/useCanvasBranchActions.test.tsx";
const levelModal =
  "client/src/__tests__/components/loopBranching/LoopBranchLevelModal.test.tsx";
const canvasModals =
  "client/src/__tests__/components/loopBranching/CanvasModals.test.tsx";
const visual = "client/e2e/tests/loop-branching-visual.spec.ts";
const case2Visual =
  "client/e2e/tests/loop-branching-case2-visual.spec.ts";
const graphDiagnosticsVisual =
  "client/e2e/tests/graph-diagnostics-visual.spec.ts";
const loopLayout =
  "client/src/__tests__/components/loopBranching/loopBranchLayout.test.ts";
const edgeColors =
  "client/src/__tests__/components/canvasExpandedLayout/assignsBranchEdgeColors.test.ts";
const runtimeStateContract =
  "client/src/pages/ExperimentBuilder/modules/experiment-runtime/runtimeStateContract.test.ts";
const jumpRequest =
  "client/src/pages/ExperimentBuilder/modules/experiment-runtime/jumpRequest.test.ts";
const branchingRuntime =
  "client/runtime-e2e/scenarios/branching-runtime.spec.ts";
const nestedRuntime =
  "client/runtime-e2e/scenarios/nested-loop-runtime.spec.ts";
const navigationRuntime =
  "client/runtime-e2e/scenarios/navigation-runtime.spec.ts";
const navigationCoordinator =
  "client/src/__tests__/components/codegenRuntime/navigationCoordinator.test.ts";
const navigationNegativeRuntime =
  "client/runtime-e2e/scenarios/navigation-negative-runtime.spec.ts";
const loopRoutingCodegen =
  "client/src/__tests__/components/loopBranching/loopRoutingCodegen.test.ts";
const loopPlacementRuntime =
  "client/runtime-e2e/scenarios/loop-placement-runtime.spec.ts";
const publicConfiguration =
  "client/src/__tests__/components/codegenRuntime/publicConfiguration.test.ts";

export const coveredRequirements = {
  "TD-01": {
    status: "covered",
    evidence: [evidence(graphIdentity, "[TD-01] [TG-01] returns one unique")],
  },
  "TD-02": {
    status: "covered",
    evidence: [evidence(graphIdentity, "[TD-02] rejects missing parents")],
  },
  "TC-01": {
    status: "covered",
    evidence: [evidence(branchHook, "[TC-01] [TC-08]")],
  },
  "TD-03": {
    status: "covered",
    evidence: [evidence(serverLoopBranches, "[TD-03] [TD-06]")],
  },
  "TD-04": {
    status: "covered",
    evidence: [evidence(serverLoopBranches, "[TD-04] [TA-07]")],
  },
  "TD-05": {
    status: "covered",
    evidence: [evidence(branchHook, "[TD-05] [TC-09]")],
  },
  "TD-06": {
    status: "covered",
    evidence: [evidence(serverLoopBranches, "[TD-03] [TD-06]")],
  },
  "TD-07": {
    status: "covered",
    evidence: [evidence(graphIdentity, "[TD-07] [TD-08]")],
  },
  "TD-08": {
    status: "covered",
    evidence: [evidence(graphIdentity, "[TD-07] [TD-08]")],
  },
  "TD-09": {
    status: "covered",
    evidence: [evidence(graphIdentity, "[TD-09] diagnoses duplicate")],
  },
  "TD-10": {
    status: "covered",
    evidence: [evidence(graphIdentity, "[TD-10] canonicalizes")],
  },
  "TD-11": {
    status: "covered",
    evidence: [evidence(experimentGraph, "[TD-11] keeps one owned")],
  },
  "TD-12": {
    status: "covered",
    evidence: [
      evidence(loopProjection, "[TD-12] keeps the semantic source trial"),
      evidence(
        loopProjection,
        "[TD-12] projects the source to the nearest collapsed loop",
      ),
      evidence(loopProjection, "[TD-12] keeps the outermost projection"),
    ],
  },
  "TC-01A": {
    status: "covered",
    evidence: [evidence(branchHook, "[TC-01A] [TC-05]")],
  },
  "TC-04": {
    status: "covered",
    evidence: [evidence(levelModal, "[TC-04] requires one level")],
  },
  "TC-02": {
    status: "covered",
    evidence: [evidence(canvasModals, "[TC-02] closes through")],
  },
  "TC-03": {
    status: "covered",
    evidence: [evidence(levelModal, "[TC-03] lists ancestry")],
  },
  "TC-05": {
    status: "covered",
    evidence: [evidence(branchHook, "[TC-01A] [TC-05]")],
  },
  "TC-06": {
    status: "covered",
    evidence: [evidence(levelModal, "[TC-06] disables choices")],
  },
  "TC-07": {
    status: "covered",
    evidence: [evidence(branchHook, "[TC-07] reloads level options")],
  },
  "TC-08": {
    status: "covered",
    evidence: [evidence(branchHook, "[TC-01] [TC-08]")],
  },
  "TC-09": {
    status: "covered",
    evidence: [evidence(branchHook, "[TD-05] [TC-09]")],
  },
  "TC-10": {
    status: "covered",
    evidence: [evidence(visual, "[TC-10] [TL-01] [TL-02] [TL-03]")],
  },
  "TC-11": {
    status: "covered",
    evidence: [evidence(levelModal, "[TC-11] exposes labelled")],
  },
  "TC-12": {
    status: "covered",
    evidence: [evidence(levelModal, "[TC-12] keeps a long ancestry")],
  },
  "TA-01": {
    status: "covered",
    evidence: [
      evidence(serverLoopBranches, "[TA-01] creates a parallel"),
      evidence(loopPlacementRuntime, "[RUNTIME-LOOP-PARALLEL-LEVEL] [TA-01]"),
    ],
  },
  "TA-02": {
    status: "covered",
    evidence: [
      evidence(serverLoopBranches, "[TA-02] inserts sequentially"),
      evidence(loopPlacementRuntime, "[RUNTIME-LOOP-SEQUENTIAL-LEVEL] [TA-02]"),
    ],
  },
  "TA-03": {
    status: "covered",
    evidence: [evidence(loopBranchCommand, "[TA-03] rolls back")],
  },
  "TA-04": {
    status: "covered",
    evidence: [evidence(loopBranchCommand, "[TA-04] [TA-05] replays")],
  },
  "TA-05": {
    status: "covered",
    evidence: [evidence(loopBranchCommand, "[TA-04] [TA-05] replays")],
  },
  "TA-06": {
    status: "covered",
    evidence: [evidence(loopBranchCommand, "[TA-06] rejects a stale")],
  },
  "TA-07": {
    status: "covered",
    evidence: [evidence(serverLoopBranches, "[TD-04] [TA-07]")],
  },
  "TA-09": {
    status: "covered",
    evidence: [evidence(serverLoopBranches, "[TA-09] keeps external targets")],
  },
  "TA-10": {
    status: "covered",
    evidence: [evidence(serverLoopBranches, "[TA-10] keeps projections")],
  },
  "TA-08": {
    status: "covered",
    evidence: [evidence(loopBranchCommand, "[TA-08] returns the committed")],
  },
  "TA-11": {
    status: "covered",
    evidence: [evidence(loopBranchCommand, "[TA-11] [TA-12] [TG-03]")],
  },
  "TA-12": {
    status: "covered",
    evidence: [evidence(loopBranchCommand, "[TA-11] [TA-12] [TG-03]")],
  },
  "TA-14": {
    status: "covered",
    evidence: [
      evidence(
        branchingRuntime,
        "[RUNTIME-CORRUPT-ROUTE-GUARD] [TR-13] [TA-14]",
      ),
    ],
  },
  "TL-01": {
    status: "covered",
    evidence: [evidence(visual, "[TC-10] [TL-01] [TL-02] [TL-03]")],
  },
  "TL-02": {
    status: "covered",
    evidence: [evidence(visual, "[TC-10] [TL-01] [TL-02] [TL-03]")],
  },
  "TL-03": {
    status: "covered",
    evidence: [evidence(visual, "[TC-10] [TL-01] [TL-02] [TL-03]")],
  },
  "TL-04": {
    status: "covered",
    evidence: [evidence(case2Visual, "[TL-04] [TL-05] [TL-06]")],
  },
  "TL-05": {
    status: "covered",
    evidence: [evidence(case2Visual, "[TL-04] [TL-05] [TL-06]")],
  },
  "TL-06": {
    status: "covered",
    evidence: [evidence(case2Visual, "[TL-04] [TL-05] [TL-06]")],
  },
  "TL-07": {
    status: "covered",
    evidence: [evidence(case2Visual, "[TL-07] [TL-08] [TL-09]")],
  },
  "TL-08": {
    status: "covered",
    evidence: [evidence(case2Visual, "[TL-07] [TL-08] [TL-09]")],
  },
  "TL-09": {
    status: "covered",
    evidence: [
      evidence(case2Visual, "[TL-07] [TL-08] [TL-09]"),
      evidence(edgeColors, "[TL-09] derives colors from canonical identity"),
    ],
  },
  "TL-10": {
    status: "covered",
    evidence: [
      evidence(edgeColors, "[TL-10] does not classify loop routing edges"),
    ],
  },
  "TL-12": {
    status: "covered",
    evidence: [
      evidence(loopLayout, "[TL-12] anchors one exit outside its loop boundary"),
    ],
  },
  "TL-13": {
    status: "covered",
    evidence: [
      evidence(graphDiagnosticsVisual, "[TL-13] reports a dangling canonical edge"),
    ],
  },
  "TR-01": {
    status: "covered",
    evidence: [evidence(branchingRuntime, "[RUNTIME-LOOP-ROOT-EXIT] [TR-01]")],
  },
  "TR-02": {
    status: "covered",
    evidence: [evidence(nestedRuntime, "[RUNTIME-NESTED-PARENT-EXIT] [TR-02]")],
  },
  "TR-03": {
    status: "covered",
    evidence: [
      evidence(nestedRuntime, "[RUNTIME-NESTED-ANCESTOR-EXIT] [TR-03]"),
    ],
  },
  "TR-04": {
    status: "covered",
    evidence: [evidence(nestedRuntime, "[RUNTIME-NESTED-ROOT-EXIT] [TR-04]")],
  },
  "TR-05": {
    status: "covered",
    evidence: [evidence(branchingRuntime, "[TR-05] [TR-12] [TR-16]")],
  },
  "TR-12": {
    status: "covered",
    evidence: [evidence(branchingRuntime, "[TR-05] [TR-12] [TR-16]")],
  },
  "TR-13": {
    status: "covered",
    evidence: [
      evidence(
        branchingRuntime,
        "[RUNTIME-CORRUPT-ROUTE-GUARD] [TR-13]",
      ),
    ],
  },
  "TR-16": {
    status: "covered",
    evidence: [evidence(branchingRuntime, "[TR-05] [TR-12] [TR-16]")],
  },
  "TG-08": {
    status: "covered",
    evidence: [
      evidence(branchingRuntime, "[TA-14] [TG-08] rejects a dangling"),
    ],
  },
  "TG-01": {
    status: "covered",
    evidence: [evidence(graphIdentity, "[TD-01] [TG-01]")],
  },
  "TG-02": {
    status: "covered",
    evidence: [evidence(graphIdentity, "[TG-02] compiles the exact")],
  },
  "TG-03": {
    status: "covered",
    evidence: [evidence(loopBranchCommand, "[TA-11] [TA-12] [TG-03]")],
  },
  "TG-04": {
    status: "covered",
    evidence: [
      evidence(branchingRuntime, "[TR-16] [TG-04] [TG-10]"),
    ],
  },
  "TG-07": {
    status: "covered",
    evidence: [evidence(loopRoutingCodegen, "[TG-07] preserves domain IDs")],
  },
  "TG-09": {
    status: "covered",
    evidence: [evidence(publicConfiguration, "[TG-09] emits parseable code")],
  },
  "TG-10": {
    status: "covered",
    evidence: [evidence(branchingRuntime, "[TG-04] [TG-10] authors")],
  },
  "TG-13": {
    status: "covered",
    evidence: [
      evidence(runtimeStateContract, "[TG-13] validates reachable writers"),
    ],
  },
  "TJ-01": {
    status: "covered",
    evidence: [
      evidence(
        "client/runtime-e2e/scenarios/navigation-runtime.spec.ts",
        "[RUNTIME-JUMP-ROOT] [TJ-01]",
      ),
    ],
  },
  "TJ-04": {
    status: "covered",
    evidence: [evidence(jumpRequest, "[TJ-04] consumes each path segment")],
  },
  "TJ-05": {
    status: "covered",
    evidence: [
      evidence(
        navigationNegativeRuntime,
        "[RUNTIME-JUMP-INVALID] [TJ-05]",
      ),
    ],
  },
  "TJ-06": {
    status: "covered",
    evidence: [evidence(loopRoutingCodegen, "[TJ-06] keeps a nested jump")],
  },
  "TJ-08": {
    status: "covered",
    evidence: [
      evidence(jumpRequest, "[TJ-08] accepts a marked reload"),
      evidence(
        navigationCoordinator,
        "[TJ-08] rejects a reload attempt",
      ),
      evidence(
        navigationNegativeRuntime,
        "[RUNTIME-JUMP-INVALID] [TJ-05] [TJ-08]",
      ),
    ],
  },
  "TM-01": {
    status: "covered",
    evidence: [evidence(experimentGraph, "[TM-01] [TM-02] groups")],
  },
  "TM-02": {
    status: "covered",
    evidence: [evidence(experimentGraph, "[TM-01] [TM-02] groups")],
  },
  "TRES-02": {
    status: "covered",
    evidence: [
      evidence(
        navigationRuntime,
        "[RUNTIME-RESUME-BRANCH] [TRES-02] [TRES-09]",
      ),
    ],
  },
  "TRES-01": {
    status: "covered",
    evidence: [
      evidence(
        navigationRuntime,
        "[RUNTIME-RESUME-SEQUENTIAL] [TRES-01]",
      ),
    ],
  },
  "TRES-09": {
    status: "covered",
    evidence: [
      evidence(
        navigationRuntime,
        "[RUNTIME-RESUME-BRANCH] [TRES-02] [TRES-09]",
      ),
    ],
  },
};
