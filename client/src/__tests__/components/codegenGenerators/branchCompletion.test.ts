import { expect, it } from "vitest";
import { generateOnFinishCode } from "../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialCode/TrialCodeGenerators/onFinishGenerator";
it("runs the custom lifecycle before selecting the configured connection", () => {
  const code = generateOnFinishCode({
    branches: [2],
    defaultNextTrialId: 2,
    getVarName: (name) => name,
    customOnFinish: "data.response = 'changed';",
  });
  expect(code.indexOf("data.response = 'changed'")).toBeLessThan(
    code.indexOf("ExpBuilderBranching.decide"),
  );
});
