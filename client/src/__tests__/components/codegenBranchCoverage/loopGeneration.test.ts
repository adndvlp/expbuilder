import { describe, expect, it, vi } from "vitest";
import { loop, registerCodegenCoverageLifecycle } from "./testHarness";
import { generateSingleLoopCode } from "../../../pages/ExperimentBuilder/utils/generateTrialLoopCodes";
import { generateLoopRepeatLifecycle } from "../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/LoopsConfiguration/useLoopCode/services/generateLoopRepeatLifecycle";

describe("loop and branch code generation coverage", () => {
  registerCodegenCoverageLifecycle();
  it("returns empty loop code when loop timeline loading throws", async () => {
    const code = await generateSingleLoopCode(
      loop({ id: "loop-a" }),
      "experiment-a",
      [],
      vi.fn(),
      vi.fn(async () => {
        throw new Error("timeline failed");
      }),
      vi.fn(async () => loop({ id: "loop-a" })),
    );

    expect(code).toBe("");
    expect(console.error).toHaveBeenCalledWith(
      "Error generating code for loop loop-a:",
      expect.any(Error),
    );
  });

  it.each([true, false])(
    "preserves repeat navigation with matching condition = %s",
    (matches) => {
      const condition = {
        id: 1,
        jumpToTrialId: 10,
        rules: [{ column: "response", op: "==", value: "retry" }],
      };
      const code = generateLoopRepeatLifecycle({
        id: "loop-a",
        repeatConditions: [condition],
      });
      const lastRow = { response: "retry", trial_id: 2 };
      const runtime = {
        ExpBuilderBranching: {
          evaluateCondition: vi.fn(() => matches),
          decide: vi.fn(),
        },
        ExpBuilderNavigation: {
          requestJump:
            vi.fn<
              (
                target: number,
                source: Record<string, unknown>,
                data: unknown,
                pause: () => void,
              ) => void
            >(),
        },
      };
      const jsPsych = {
        data: {
          get: () => ({ filter: () => ({ values: () => [lastRow] }) }),
        },
        pauseExperiment: vi.fn(),
      };
      const lifecycle = new Function(
        "window",
        "jsPsych",
        "trialSessionId",
        `return ({${code}});`,
      )(runtime, jsPsych, "session-a");
      lifecycle.on_finish({ response: "unused" });

      expect(
        runtime.ExpBuilderBranching.evaluateCondition,
      ).toHaveBeenCalledWith(lastRow, condition);
      expect(runtime.ExpBuilderBranching.decide).not.toHaveBeenCalled();
      if (matches) {
        expect(runtime.ExpBuilderNavigation.requestJump).toHaveBeenCalledWith(
          10,
          { sourceId: "loop-a", conditionId: 1, sourceSessionId: "session-a" },
          lastRow,
          expect.any(Function),
        );
        runtime.ExpBuilderNavigation.requestJump.mock.calls[0][3]();
        expect(jsPsych.pauseExperiment).toHaveBeenCalledOnce();
      } else {
        expect(runtime.ExpBuilderNavigation.requestJump).not.toHaveBeenCalled();
      }
    },
  );
});
