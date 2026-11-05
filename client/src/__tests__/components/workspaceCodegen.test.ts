import { describe, it, expect, vi } from "vitest";
import { generateAllCodes } from "../../pages/ExperimentBuilder/utils/generateTrialLoopCodes";
import { buildExecutionAddressManifest } from "../../pages/ExperimentBuilder/modules/experiment-runtime/executionAddressManifest";
import { generateTrialCode } from "../../pages/ExperimentBuilder/utils/codegen/generateTrialCode";
import { buildExperimentGraph } from "../../../../server/routes/timeline/graph/buildExperimentGraph.js";
import { applyWorkspaceCommand } from "../../../../shared/experiment-workspace/commands.js";
import { trial } from "../helpers/trialFactories";
const fetchMetadata = vi.fn(
  async () =>
    new Response(
      JSON.stringify({
        parameters: {
          stimulus: { type: "STRING", default: "" },
          choices: { type: "KEYS", default: [] },
        },
        data: {},
      }),
    ),
) as typeof fetch;
const make = () => ({
  experimentID: "test",
  workspaceSchemaVersion: 2,
  entryItemId: 1,
  trials: [
    trial({
      id: 1,
      name: "Active",
      defaultNextTrialId: 2,
      branches: [2],
      branchConditions: [],
    }),
    trial({ id: 2, name: "End", branchConditions: [] }),
    trial({ id: 3, name: "Detached", branchConditions: [] }),
  ],
  loops: [],
  timeline: [1, 2, 3].map((id) => ({ id, type: "trial" as const })),
});
describe("workspace generation uses one executable projection", () => {
  it("omits detached definitions and addresses while single-trial generation still works", async () => {
    const document = make(),
      graph = { ...buildExperimentGraph(document), workspace: document };
    const getTrial = vi.fn(
      async (id) => document.trials.find((t) => t.id === id) ?? null,
    );
    const codes = await generateAllCodes(
      "test",
      [],
      getTrial,
      async () => [],
      async () => null,
      { graph, fetchImpl: fetchMetadata },
    );
    expect(codes.join("\n")).toContain("Active");
    expect(codes.join("\n")).not.toContain("Detached");
    expect(
      Object.keys(buildExecutionAddressManifest(graph).addressesByTarget),
    ).toEqual(["1", "2"]);
    const single = await generateTrialCode(
      document.trials[2],
      [],
      "test",
      getTrial,
      false,
      undefined,
      false,
      { fetchImpl: fetchMetadata },
    );
    expect(single.code).toContain("Detached");
  });
  it("regenerates copied WebGazer metadata and parameter references from its saved configuration", async () => {
    const source = make();
    source.trials[0] = {
      ...source.trials[0],
      plugin: "webgazer",
      parameters: { include_instructions: {}, minimum_percent: 65 },
      columnMapping: {},
      trialCode: 'throw new Error("stale generated cache");',
      paramsOverride: [
        {
          id: 1,
          rules: [{ trialId: 2, column: "response", op: "==", value: "yes" }],
          paramsToOverride: { stimulus: "new" },
        },
      ],
    };
    const { copyWorkspaceItems } = await import(
      "../../../../shared/experiment-workspace/commands.js"
    );
    const result = applyWorkspaceCommand(source, {
        kind: "pasteItems",
        args: { fragment: copyWorkspaceItems(source, [1, 2]) },
      }),
      copied = result.document.trials.slice(3);
    const code = (
      await generateTrialCode(
        copied[0],
        [],
        "test",
        async (id) => result.document.trials.find((t) => t.id === id) ?? null,
        false,
        undefined,
        false,
        { fetchImpl: fetchMetadata },
      )
    ).code;
    expect(code).not.toContain("stale generated cache");
    expect(code).toContain("builder_id: " + copied[0].id);
    expect(code).toContain(String(copied[1].id));
    expect(code).toContain("65");
  });
});

it("regenerates explicitly generated WebGazer caches even before any optional settings were saved", async () => {
  const configured = trial({
    id: 8,
    plugin: "webgazer",
    parameters: {},
    trialCodeSource: "generated",
    trialCode: "stale generated cache",
  });
  const { code } = await generateTrialCode(
    configured,
    [],
    "test",
    async () => configured,
    false,
    undefined,
    false,
    { fetchImpl: fetchMetadata },
  );
  expect(code).not.toContain("stale generated cache");
  expect(code).toContain("builder_id: 8");
  expect(code).toContain("recalibrate_timeline");
});
