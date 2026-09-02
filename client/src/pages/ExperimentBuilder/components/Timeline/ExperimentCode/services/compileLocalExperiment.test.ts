import { describe, expect, it, vi } from "vitest";
import { compileLocalExperiment } from "./compileLocalExperiment";

describe("compileLocalExperiment", () => {
  it("builds the runnable local artifact without React state", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ extensions: [] })))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ tokens: [], separator: "_" })),
      );

    const code = await compileLocalExperiment({
      experimentID: "E1",
      apiBaseUrl: "http://127.0.0.1:4321",
      fetchImpl,
      getTrial: vi.fn(),
      getLoopTimeline: vi.fn(),
      getLoop: vi.fn(),
      canvasStyles: { fullScreen: false },
      baseCodeOverride: `
        const timeline = [];
        if (window.branchCustomParameters) {
          Object.entries(window.branchCustomParameters).forEach(() => {});
        }
        jsPsych.run(timeline);
      `,
    });

    expect(code).toContain("const jsPsych = initJsPsych");
    expect(code).toContain("jsPsych.run(timeline)");
    expect(code).toContain("/api/append-result/E1");
    expect(() => new Function(code)).not.toThrow();
    expect(fetchImpl.mock.calls.map(([url]) => url)).toEqual([
      "http://127.0.0.1:4321/api/trials-extensions/E1",
      "http://127.0.0.1:4321/api/session-name-config/E1",
    ]);
  });
});
