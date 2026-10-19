import { describe, expect, it } from "vitest";
import vm from "node:vm";
import { resumeCode } from "../../components/Timeline/ExperimentCode/ResumeCode";
import type { ExperimentGraphSnapshot } from "../experiment-graph/types";
import {
  buildExecutionAddressManifest,
  generateExecutionAddressManifestCode,
} from "./executionAddressManifest";

const graph = (): ExperimentGraphSnapshot => ({
  revision: "r1",
  root: {
    entryItemId: 1,
    scopeId: null,
    parentScopeId: null,
    items: [
      {
        id: 1,
        type: "trial",
        name: "First",
        branches: [2],
        defaultNextTrialId: 2,
      },
      {
        id: 2,
        type: "trial",
        name: "Root branch target",
        defaultNextTrialId: null,
      },
      { id: "loop-1", type: "loop", name: "Loop", nextItemId: 3 },
      { id: 3, type: "trial", name: "Last", defaultNextTrialId: null },
    ],
  },
  scopes: {},
  edges: [
    {
      sourceId: 9,
      targetId: 2,
      sourceOwnerId: "loop-1",
      targetOwnerId: null,
      exitedLoopIds: ["loop-1"],
    },
  ],
  diagnostics: [],
});

describe("execution address manifest", () => {
  it("[TRES-01] derives root continuation from canonical ownership and edges", () => {
    expect(buildExecutionAddressManifest(graph())).toEqual({
      version: 3,
      revision: "r1",
      nextBySource: { "1": "2" },
      entries: { root: "1" },
      loopContinuations: { "loop-1": "3" },
      scopes: { root: ["1", "2", "loop-1", "3"] },
      allScopes: { root: ["1", "2", "loop-1", "3"] },
      addressesByTarget: {
        "1": {
          targetId: 1,
          targetKind: "trial",
          targetOwnerId: null,
          enterLoopIds: [],
        },
        "2": {
          targetId: 2,
          targetKind: "trial",
          targetOwnerId: null,
          enterLoopIds: [],
        },
        "3": {
          targetId: 3,
          targetKind: "trial",
          targetOwnerId: null,
          enterLoopIds: [],
        },
        "loop-1": {
          targetId: "loop-1",
          targetKind: "loop",
          targetOwnerId: null,
          enterLoopIds: [],
        },
      },
    });
  });

  it("does not treat a root branch-only target as sequential", () => {
    const code = generateExecutionAddressManifestCode(graph());

    expect(code).toContain("window.ExpBuilderExecutionAddresses");
    expect(code).toContain('"1":"2"');
    expect(code).not.toContain('"2":"loop-1"');
  });

  it("requires an explicit selection for a root alternative after a nested route completes", () => {
    const storage = {
      getItem: () => null,
      setItem: () => undefined,
      removeItem: () => undefined,
    };
    const routes = vm.runInNewContext(
      `${resumeCode()}
       const nav = window.ExpBuilderNavigation;
       for (const id of ['1', '2', '3']) nav.registerTrial(id, { data: { builder_id: id } });
       nav.registerLoop('loop-1', { data: { loop_id: 'loop-1' }, timeline: [] });
       const timeline = [];
       nav.attach({ pauseExperiment() {} }, timeline);
       const root = timeline[0];
       root.on_timeline_start();
       root.timeline[0].on_timeline_start();
       const initial = root.timeline.map(entry => entry.timeline[0].data.builder_id || entry.timeline[0].data.loop_id);
       nav.requestBranch({ builder_id: '1' }, { targetId: '2' });
       const selected = root.timeline.map(entry => entry.timeline[0].data.builder_id);
       ({ initial, selected });`,
      {
        window: {
          ExpBuilderExecutionAddresses: buildExecutionAddressManifest(graph()),
        },
        localStorage: storage,
        sessionStorage: storage,
      },
    );
    expect(routes.initial).toEqual(["1"]);
    expect(routes.selected).toEqual(["1", "2"]);
  });

  it("compiles the full loop ancestry for nested trial and loop targets", () => {
    const nested = graph();
    nested.scopes = {
      "loop-1": {
        scopeId: "loop-1",
        parentScopeId: null,
        items: [
          { id: "inner", type: "loop", name: "Inner" },
          { id: 4, type: "trial", name: "Outer target" },
        ],
      },
      inner: {
        scopeId: "inner",
        parentScopeId: "loop-1",
        items: [{ id: 5, type: "trial", name: "Nested target" }],
      },
    };

    const manifest = buildExecutionAddressManifest(nested);
    expect(manifest.addressesByTarget.inner.enterLoopIds).toEqual(["loop-1"]);
    expect(manifest.addressesByTarget["4"].enterLoopIds).toEqual(["loop-1"]);
    expect(manifest.addressesByTarget["5"]).toEqual({
      targetId: 5,
      targetKind: "trial",
      targetOwnerId: "inner",
      enterLoopIds: ["loop-1", "inner"],
    });
  });
});
