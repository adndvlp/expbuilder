import { jest } from "@jest/globals";
import { makeReq, makeRes } from "../helpers/firestore-mock.js";
import { makeExperimentStore } from "../helpers/experiment-store.js";
const store = makeExperimentStore();
jest.unstable_mockModule("../../app.js", () => ({
  db: store.db,
  app: { options: { projectId: "test-project" } },
}));
jest.unstable_mockModule("firebase-functions/v2/https", () => ({
  onRequest: (...args) => args.at(-1),
}));
jest.unstable_mockModule("firebase-admin/auth", () => ({
  getAuth: () => ({ verifyIdToken: async () => ({ uid: "owner" }) }),
}));
const { getExperimentFunctionalSettings } = await import(
  "../../experiment/functional-settings/api.js"
);
const sections = {
  batchConfig: { useIndexedDB: true, batchSize: 5, resumeTimeoutMinutes: 30 },
  recruitmentConfig: { platform: "none", prolificCompletionCode: "" },
  captchaConfig: { enabled: false, provider: "hcaptcha", siteKey: "" },
};
const call = async (id = "study", auth = true) => {
  const res = makeRes();
  await getExperimentFunctionalSettings(
    makeReq({
      method: "POST",
      body: { experimentID: id },
      headers: auth ? { authorization: "Bearer test" } : {},
    }),
    res,
  );
  return res;
};
beforeEach(() => {
  store.reset();
});
test("only the owner can recover settings, without any write or unrelated data", async () => {
  store.seed("experiments/study", {
    owner: "owner",
    ...sections,
    secret: "private",
    sessions: 32,
  });
  const res = await call();
  expect(res.statusCode).toBe(200);
  expect(res.jsonBody).toEqual({
    success: true,
    experimentID: "study",
    projectId: "test-project",
    verifiedOwnerUid: "owner",
    settings: sections,
  });
  expect(store.changes).toHaveLength(0);
});
test.each([
  ["other", 403, "EXPERIMENT_FORBIDDEN"],
  [undefined, 409, "OWNERSHIP_UNRESOLVED"],
])(
  "denies owner=%s before inspecting missing fields",
  async (owner, status, code) => {
    store.seed("experiments/study", { ...(owner && { owner }) });
    const res = await call();
    expect(res.statusCode).toBe(status);
    expect(res.jsonBody.code).toBe(code);
    expect(store.changes).toHaveLength(0);
  },
);
test("requires auth and does not default incomplete legacy fields", async () => {
  store.seed("experiments/study", {
    owner: "owner",
    batchConfig: sections.batchConfig,
  });
  expect((await call("study", false)).statusCode).toBe(401);
  const res = await call();
  expect(res.statusCode).toBe(422);
  expect(res.jsonBody.code).toBe("SETTINGS_REVIEW_REQUIRED");
  expect((await call("missing")).statusCode).toBe(404);
});
