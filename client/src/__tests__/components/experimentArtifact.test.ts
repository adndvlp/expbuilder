import { expect, it, vi } from "vitest";
import { buildExperimentArtifact } from "../../pages/ExperimentBuilder/modules/experiment-runtime/experimentArtifact";

it("saves the generated configuration and builds the artifact with appearance only", async () => {
  const appearance = {
    backgroundColor: "#123456",
    fullScreen: false,
    progressBar: true,
  };
  const fetchImpl = vi.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => ({ success: true, experimentUrl: "/exp" }),
  }));

  const result = await buildExperimentArtifact({
    experimentId: "exp",
    generatedCode: "jsPsych.run(timeline);",
    apiBaseUrl: "http://localhost:3000",
    saveConfiguration: true,
    appearance,
    fetchImpl,
  });

  expect(result.experimentUrl).toBe("/exp");
  expect(fetchImpl).toHaveBeenCalledTimes(2);
  const [save, build] = vi.mocked(fetchImpl).mock.calls as unknown as [
    [string, RequestInit],
    [string, RequestInit],
  ];
  expect(save[0]).toBe("http://localhost:3000/api/save-config/exp");
  expect(JSON.parse(save[1].body as string)).toEqual({
    config: { generatedCode: "jsPsych.run(timeline);" },
    isDevMode: false,
  });
  expect(build[0]).toBe("http://localhost:3000/api/run-experiment/exp");
  expect(JSON.parse(build[1].body as string)).toEqual({
    generatedCode: "jsPsych.run(timeline);",
    canvasStyles: appearance,
  });
});
