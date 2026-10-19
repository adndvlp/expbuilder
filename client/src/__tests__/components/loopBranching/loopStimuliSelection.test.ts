import vm from "node:vm";
import { describe, expect, it } from "vitest";
import generateLoopCode from "../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/LoopsConfiguration/useLoopCode";

const rows = [1, 2, 3].map(row => ({
  row, "__canvasStyles_Behavioral$20$Statements": { width: 1440, height: 900 },
}));

function selectedRows(participantNumber: unknown, categories = false, stimuliOrders = [[2, 0, 1]]) {
  const code = generateLoopCode({
    id: "ordered", repetitions: 1, randomize: false,
    orders: true, stimuliOrders,
    categories, categoryData: categories ? ["a", "b", "a"] : [],
    trials: [{ id: 1, trialName: "Source", pluginName: "html-button-response",
      timelineProps: "const Source_timeline = {};" }],
    unifiedStimuli: rows,
  })();
  const sandbox: Record<string, unknown> = { window: {}, timeline: [], participantNumber };
  if (participantNumber === undefined) delete sandbox.participantNumber;
  return vm.runInNewContext(`${code}\nordered_procedure.timeline_variables;`, sandbox);
}

describe("ordered loop stimulus selection", () => {
  it.each([undefined, null, NaN, 0, -1, 1.5, Infinity, "1"])(
    "keeps the CSV rows and canvas variables without a valid participant number (%s)",
    participant => {
      expect(selectedRows(participant)).toEqual(rows);
      expect(selectedRows(participant, true)).toEqual(rows);
    },
  );

  it("applies the participant's order and category when a valid number exists", () => {
    expect(selectedRows(1)).toEqual([rows[2], rows[0], rows[1]]);
    expect(selectedRows(1, true)).toEqual([rows[2], rows[0]]);
    expect(selectedRows(2, true)).toEqual([rows[1]]);
  });

  it.each([{ orders: [] }, { orders: [[]] }, { orders: [[-1, 999]] }])("preserves rows when the configured order selects nothing ($orders)", ({ orders }) => {
    expect(selectedRows(1, false, orders)).toEqual(rows);
    expect(selectedRows(1, true, orders)).toEqual([rows[0], rows[2]]);
  });
});
