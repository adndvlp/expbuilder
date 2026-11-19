import { jest } from "@jest/globals";
import { makeTransactionalFirestore } from "../../helpers/transactional-firestore.js";
import { makeReq, makeRes } from "../../helpers/firestore-mock.js";

const store = makeTransactionalFirestore();
jest.unstable_mockModule("../../../app.js", () => ({ db: store.db }));
jest.unstable_mockModule("firebase-admin/firestore", () => ({ FieldValue: { increment: value => ({ __op: "increment", value }) } }));
jest.unstable_mockModule("../../../experiment/sessions/logging/write-log.js", () => ({ default: async () => {} }));
const { handleCreateSession } = await import("../../../experiment/sessions/handlers/create-session.js");
const experiment = "experiments/EID";
const session = experiment + "/sessions/S1";
async function create(id = "S1", batchSize = 0) {
  const res = makeRes();
  await handleCreateSession(makeReq({ body: { batchSize } }), res, "EID", id);
  return res;
}
beforeEach(() => {
  store.reset();
  store.records.set(experiment, { active: true, currentCondition: 0, nConditions: 2, sessions: 0 });
});

describe("durable session registration", () => {
  test("H08: batch zero keeps its participant and condition across reloads and counts once", async () => {
    const first = await create();
    const resumed = await create();
    expect(first.statusCode).toBe(201);
    expect(resumed.statusCode).toBe(200);
    expect(resumed.jsonBody.participantNumber).toBe(first.jsonBody.participantNumber);
    expect(store.records.get(session)).toMatchObject({ participantNumber: 0, condition: 0 });
    expect(store.records.get(experiment)).toMatchObject({ currentCondition: 1, sessions: 1 });
  });

  test("concurrent copies of the same creation request allocate exactly one participant", async () => {
    const results = await Promise.all([create("S1", 1), create("S1", 1)]);
    expect(results.map(result => result.jsonBody.participantNumber)).toEqual([0, 0]);
    expect(store.records.get(experiment)).toMatchObject({ currentCondition: 1, sessions: 1 });
  });

  test("resumes an existing session after the limit is reached but rejects a new identity", async () => {
    store.records.set(experiment, { ...store.records.get(experiment), limitSessions: true, maxSessions: 1 });
    await create("S1", 1);
    expect((await create("S1", 1)).statusCode).toBe(200);
    expect((await create("S2", 1)).statusCode).toBe(400);
    expect(store.records.has(experiment + "/sessions/S2")).toBe(false);
    expect(store.records.get(experiment).sessions).toBe(1);
  });

  test("competing new identities cannot both consume the last allowed session", async () => {
    store.records.set(experiment, { ...store.records.get(experiment), limitSessions: true, maxSessions: 1 });
    const results = await Promise.all([create("S1", 1), create("S2", 1)]);
    expect(results.map(result => result.statusCode).sort()).toEqual([201, 400]);
    expect(store.records.get(experiment).sessions).toBe(1);
  });

  test("rolls back identity, participant rotation and counter when registration cannot commit", async () => {
    store.failNextCommit(new Error("commit failed"));
    expect((await create("S1", 1)).jsonBody.success).not.toBe(true);
    expect(store.records.has(session)).toBe(false);
    expect(store.records.get(experiment)).toMatchObject({ currentCondition: 0, sessions: 0 });
    expect((await create("S1", 1)).jsonBody.participantNumber).toBe(0);
  });
  test('can recover an existing closed identity after the experiment stops accepting new participants', async () => {
    await create('S1', 1);
    store.records.set(session, { ...store.records.get(session), lifecycle: 'expired' });
    store.records.set(experiment, { ...store.records.get(experiment), active: false });
    expect((await create('S1', 1)).statusCode).toBe(200);
    expect((await create('S2', 1)).statusCode).toBe(400);
    expect(store.records.get(experiment).sessions).toBe(1);
  });
});
