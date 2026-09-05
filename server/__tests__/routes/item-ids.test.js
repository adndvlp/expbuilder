import {
  allocateLoopId,
  allocateTrialId,
} from "../../routes/timeline/graph/itemIds.js";

describe("timeline item id allocation", () => {
  test("increments deterministic IDs when multiple mutations share a clock tick", () => {
    const doc = {
      trials: [{ id: 1000 }, { id: 1001 }],
      loops: [{ id: "loop_1000" }, { id: "loop_1001" }],
    };

    expect(allocateTrialId(doc, 1000)).toBe(1002);
    expect(allocateLoopId(doc, 1000)).toBe("loop_1002");
  });
});
