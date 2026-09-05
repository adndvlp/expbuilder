import { describe, expect, it } from "vitest";
import type { ExperimentGraphSnapshot } from "../experiment-graph/types";
import {
  buildExecutionAddressManifest,
  generateExecutionAddressManifestCode,
} from "./executionAddressManifest";

const graph = (): ExperimentGraphSnapshot => ({
  revision: "r1",
  root: {
    scopeId: null,
    parentScopeId: null,
    items: [
      { id: 1, type: "trial", name: "First" },
      { id: 2, type: "trial", name: "Root branch target" },
      { id: "loop-1", type: "loop", name: "Loop" },
      { id: 3, type: "trial", name: "Last" },
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
      version: 2,
      revision: "r1",
      nextBySource: { "1": "loop-1" },
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
    expect(code).toContain('\"1\":\"loop-1\"');
    expect(code).not.toContain('\"2\":\"loop-1\"');
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
