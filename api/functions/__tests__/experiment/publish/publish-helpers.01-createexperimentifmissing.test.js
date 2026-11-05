import { jest } from "@jest/globals";
const create = jest.fn();
jest.unstable_mockModule("../../../experiment/create.js", () => ({ createExperiment: create }));
const { createExperimentIfMissing } = await import("../../../experiment/publish/create-if-missing.js");
beforeEach(() => create.mockReset());

test("defaults provider and delegates reservation and folder setup together", async () => {
  create.mockResolvedValue({ success: true });
  await createExperimentIfMissing("EID", "repo", "u1");
  expect(create).toHaveBeenCalledWith("EID", "repo", "u1", "googledrive", {}, {});
});
test("passes the acquired mutation to preparation for every provider", async () => {
  const mutation = { data: { owner: "u1" } };
  create.mockResolvedValue({ success: true });
  await createExperimentIfMissing("EID", "repo", "u1", "osf", mutation);
  expect(create).toHaveBeenCalledWith("EID", "repo", "u1", "osf", {}, { mutation });
});
test("propagates folder failures so publication cannot continue", async () => {
  create.mockResolvedValue({ success: false, storageError: "quota exceeded" });
  await expect(createExperimentIfMissing("EID", "repo", "u1")).rejects.toMatchObject({ code: "EXPERIMENT_STORAGE_SETUP_FAILED", message: "quota exceeded" });
});
test("a concurrent creation error is never treated as proof of ownership", async () => {
  create.mockRejectedValue(new Error("EXPERIMENT_ALREADY_EXISTS"));
  await expect(createExperimentIfMissing("EID", "repo", "u1")).rejects.toThrow("EXPERIMENT_ALREADY_EXISTS");
});
