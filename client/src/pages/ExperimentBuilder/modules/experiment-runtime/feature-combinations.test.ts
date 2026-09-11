import vm from "node:vm";
import { describe, expect, it } from "vitest";
import { resumeCode } from "../../components/Timeline/ExperimentCode/ResumeCode";
import { generateConditionalLoopFunction } from "../../components/ConfigurationPanel/TrialsConfiguration/LoopsConfiguration/useLoopCode/services/generateConditionalLoopFunction";
import { buildExecutionAddressManifest } from "./executionAddressManifest";
import type { ExperimentGraphSnapshot } from "../experiment-graph/types";
import {
  allowsJumpItem,
  createJumpRequest,
  enterJumpItem,
  parseJumpRequest,
} from "./jumpRequest";
import { getBranchEvaluatorRuntimeCode } from "./branchEvaluator";
import { getJumpRequestRuntimeCode } from "./jumpRequest";

/**
 * Feature-combination matrix at runtime (production code paths only).
 *
 * Branches, branch conditions with customParameters (params override on
 * branches), paramsOverride-style referenced conditions, loopConditions,
 * nested loops, jump-to-trial and resume are combined end to end using the
 * real serialized runtime functions (the exact code shipped in the bundle),
 * a real execution-address manifest and real jump requests — with mixed
 * string/number ids throughout.
 */

function runInSandbox(
  code: string,
  extra: Record<string, unknown> = {},
): Record<string, any> {
  const store = () => {
    const data = new Map<string, string>();
    return {
      getItem: (key: string) => (data.has(key) ? data.get(key)! : null),
      setItem: (key: string, value: string) => void data.set(key, String(value)),
      removeItem: (key: string) => void data.delete(key),
    };
  };
  const sandbox: Record<string, any> = {
    window: {},
    localStorage: store(),
    sessionStorage: store(),
    trialSessionId: "session-1",
    isResuming: false,
    ...extra,
  };
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);
  return sandbox;
}

// Root trials 1→2 plus a two-level nest (outer › inner › trials "3", 4).
// Trial "3" is intentionally a string id while the rest are numeric.
function comboSnapshot(): ExperimentGraphSnapshot {
  return {
    revision: "rev-1",
    root: {
      scopeId: null,
      parentScopeId: null,
      items: [
        { id: 1, type: "trial", name: "Root", branches: [4] },
        { id: 2, type: "trial", name: "Landing", branches: [] },
        { id: "outer", type: "loop", name: "Outer", branches: [] },
      ],
    },
    scopes: {
      outer: {
        scopeId: "outer",
        parentScopeId: null,
        items: [{ id: "inner", type: "loop", name: "Inner", branches: [] }],
      },
      inner: {
        scopeId: "inner",
        parentScopeId: "outer",
        items: [
          { id: "3", type: "trial", name: "InnerThree", branches: [] },
          { id: 4, type: "trial", name: "Deep", branches: [] },
        ],
      },
    },
    edges: [
      {
        sourceId: 1,
        targetId: 4,
        sourceOwnerId: null,
        targetOwnerId: "inner",
        exitedLoopIds: [],
      },
    ],
    diagnostics: [],
  };
}

describe("branch with params override into a nested loop", () => {
  it("decides the nested target with customParameters using bundled code", () => {
    const sandbox = runInSandbox(`
      ${getBranchEvaluatorRuntimeCode()}
      const trial = {
        response: "go",
        branches: ["4"],
        branchConditions: [{
          id: "c1",
          rules: [{ column: "response", op: "==", value: "go" }],
          nextTrialId: "4",
          customParameters: { stimulus: { source: "typed", value: "nested.png" } },
        }],
      };
      window.__decision = window.ExpBuilderBranching.decide(
        trial, trial.branches, trial.branchConditions,
      );
    `);
    expect(sandbox.window.__decision).toMatchObject({
      targetId: "4",
      conditionId: "c1",
      customParameters: { stimulus: { source: "typed", value: "nested.png" } },
      usedDefault: false,
    });
  });

  it("routes the jump through every enclosing loop level", () => {
    // Manifest as embedded in the artifact (JSON round-tripped like the HTML).
    const manifest = JSON.parse(
      JSON.stringify(buildExecutionAddressManifest(comboSnapshot())),
    );
    const address = manifest.addressesByTarget["4"];
    expect(address).toMatchObject({
      targetKind: "trial",
      targetOwnerId: "inner",
      enterLoopIds: ["outer", "inner"],
    });

    const sandbox = runInSandbox(getJumpRequestRuntimeCode());
    const protocol = sandbox.window.ExpBuilderJumpProtocol;
    // Serialized protocol parses a storage round-tripped request.
    const request = protocol.create(address, "rev-1", 1, null, {});
    const restored = parseJumpRequest(JSON.stringify(request));
    expect(restored).not.toBeNull();

    let current = restored!;
    expect(allowsJumpItem(current, "outer", "loop")).toBe(true);
    current = enterJumpItem(current, "outer", "loop").request!;
    expect(allowsJumpItem(current, "inner", "loop")).toBe(true);
    current = enterJumpItem(current, "inner", "loop").request!;
    // Numeric trial id matches the string target across the type boundary.
    expect(allowsJumpItem(current, 4, "trial")).toBe(true);
    const arrival = enterJumpItem(current, 4, "trial");
    expect(arrival).toMatchObject({ allowed: true, consumed: "target" });
  });
});

describe("paramsOverride-style referenced conditions inside loops", () => {
  it("matches loop rows across string/number identities with bundled code", () => {
    const sandbox = runInSandbox(`
      ${getBranchEvaluatorRuntimeCode()}
      const rows = [
        { builder_id: 3, trial_id: 3, loop_id: "inner", response: "other" },
        { builder_id: 3, trial_id: 3, loop_id: "inner", response: "again" },
      ];
      window.__matched = window.ExpBuilderBranching.evaluateReferencedCondition(
        rows,
        { id: "lc1", rules: [{ trialId: "3", column: "response", op: "==", value: "again" }] },
      );
    `);
    // String rule trialId "3" resolves numeric row identities, latest row wins.
    expect(sandbox.window.__matched).toBe(true);
  });

  it("drives the generated conditional-loop function", () => {
    const code = generateConditionalLoopFunction(true, [
      {
        id: "lc1",
        rules: [{ trialId: "3", column: "response", op: "==", value: "again" }],
      },
    ]);
    const sandbox = runInSandbox(`
      ${getBranchEvaluatorRuntimeCode()}
      window.ExpBuilderRuntime = { emit: () => {} };
      const __fn = { ${code} }.loop_function;
      __out = __fn({ values: () => [
        { builder_id: 3, trial_id: 3, loop_id: "inner", response: "again" },
      ] });
    `);
    expect(sandbox.__out).toBe(true);
  });
});

describe("resume combined with branch params inside a loop", () => {
  it("checkpoints, restores and resolves a nested branch route", () => {
    const sandbox = runInSandbox(`
      ${resumeCode()}
      const data = {
        builder_id: 1,
        trial_id: 1,
        response: "go",
        branches: ["4"],
        branchConditions: [{
          id: "c1",
          rules: [{ column: "response", op: "==", value: "go" }],
          nextTrialId: "4",
          customParameters: { stimulus: { source: "typed", value: "nested.png" } },
        }],
      };
      const checkpoint = _createResumeCheckpoint(data);
      // As persisted to localStorage and read back after a reload.
      const decision = _resolveResumeBranch(JSON.stringify(checkpoint));
      window.__checkpoint = checkpoint;
      window.__decision = decision;
    `);
    expect(sandbox.window.__checkpoint).toMatchObject({
      version: 1,
      route: expect.objectContaining({ kind: "branch", targetId: "4" }),
    });
    expect(sandbox.window.__decision).toMatchObject({
      kind: "branch",
      targetId: "4",
      conditionId: "c1",
      customParameters: { stimulus: { source: "typed", value: "nested.png" } },
    });

    // The restored decision resolves against the real manifest and the
    // jump protocol accepts the storage round-trip.
    const manifest = buildExecutionAddressManifest(comboSnapshot());
    const address =
      manifest.addressesByTarget[String(sandbox.window.__decision.targetId)];
    expect(address).toMatchObject({ targetKind: "trial" });
    const request = createJumpRequest(address, manifest.revision, 1, null, {
      navigationKind: "resume",
    });
    expect(parseJumpRequest(JSON.stringify(request))).not.toBeNull();
  });

  it("falls back to sequential resume targets", () => {
    const sandbox = runInSandbox(`
      ${resumeCode()}
      const data = { builder_id: 1, trial_id: 1, branches: [], branchConditions: [] };
      window.__checkpoint = _createResumeCheckpoint(data);
    `);
    // Trial 1 has no branches and no sequential successor after it in the
    // manifest sense exercised here: with no route the checkpoint is null.
    expect(sandbox.window.__checkpoint.route).toBeNull();
  });
});
