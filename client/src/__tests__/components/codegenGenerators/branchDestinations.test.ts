import { describe, expect, it, vi } from "vitest";
import { generateOnFinishCode } from "../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialCode/TrialCodeGenerators/onFinishGenerator";
import { getBranchEvaluatorRuntimeCode } from "../../../pages/ExperimentBuilder/modules/experiment-runtime/branchEvaluator";

describe("generated branching destinations", () => {
  it.each([1, 999, "FINISH_EXPERIMENT"])(
    "uses one hook and parameter policy for destination %s",
    (target) => {
      const requestBranch = vi.fn();
      const window = { ExpBuilderNavigation: { requestBranch } };
      const code = generateOnFinishCode({
        branches: target === "FINISH_EXPERIMENT" ? [] : [target],
        defaultNextTrialId: null,
        branchConditions: [
          {
            id: 1,
            rules: [],
            nextTrialId: target,
            customParameters: {
              stimulus: { source: "typed", value: "selected" },
            },
          },
        ],
        getVarName: (name) => name,
      });
      new Function(
        "window",
        `${getBranchEvaluatorRuntimeCode()}; ({${code}}).on_finish({ builder_id: 5 });`,
      )(window);
      expect(requestBranch).toHaveBeenCalledWith(
        { builder_id: 5 },
        expect.objectContaining({
          targetId: target,
          usedDefault: false,
          customParameters: {
            stimulus: { source: "typed", value: "selected" },
          },
        }),
      );
    },
  );
});
