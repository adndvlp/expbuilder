import { describe, expect, it, vi } from "vitest";
import { buildExperimentArtifact } from "./experimentArtifact";

const jsonResponse = (body: unknown) =>
  new Response(JSON.stringify(body), { status: 200 });

describe("buildExperimentArtifact", () => {
  it("uses one production service for configuration persistence and HTML build", async () => {
    const stages: string[] = [];
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ success: true }))
      .mockResolvedValueOnce(
        jsonResponse({ success: true, experimentUrl: "http://server/E1" }),
      );

    const result = await buildExperimentArtifact({
      experimentId: "E1",
      generatedCode: "jsPsych.run(timeline);",
      apiBaseUrl: "http://server",
      fetchImpl,
      saveConfiguration: true,
      onStage: (stage) => stages.push(stage),
    });

    expect(stages).toEqual(["saving", "building"]);
    expect(result.experimentUrl).toBe("http://server/E1");
    expect(fetchImpl.mock.calls.map(([url]) => url)).toEqual([
      "http://server/api/save-config/E1",
      "http://server/api/run-experiment/E1",
    ]);
  });
});
