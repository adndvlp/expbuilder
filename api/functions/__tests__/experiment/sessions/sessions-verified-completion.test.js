import { jest } from "@jest/globals";
import { createHash } from "node:crypto";
import CSV from "csv-string";
import { makeTransactionalFirestore } from "../../helpers/transactional-firestore.js";
import { makeReq, makeRes } from "../../helpers/firestore-mock.js";

const store = makeTransactionalFirestore();
const upload = jest.fn(async () => ({ success: true, id: "file", fileUrl: "https://storage.test/file" }));
jest.unstable_mockModule("../../../app.js", () => ({ db: store.db, app: {} }));
jest.unstable_mockModule("firebase-functions/v2/https", () => ({ onRequest: (_options, handler) => handler }));
jest.unstable_mockModule("firebase-admin/firestore", () => ({ FieldValue: { increment: value => ({ __op: "increment", value }) } }));
jest.unstable_mockModule("firebase-admin/database", () => ({ getDatabase: () => ({ ref: () => ({ once: async () => ({ val: () => ({ state: "in-progress" }) }) }) }) }));
jest.unstable_mockModule("../../../experiment/sessions/logging/write-log.js", () => ({ default: async () => {} }));
jest.unstable_mockModule("../../../oauth/index.js", () => ({ getValidToken: async () => ({ success: true, access_token: "token" }) }));
jest.unstable_mockModule("../../../experiment/sessions/storage.js", () => ({
  createSession: async () => ({ success: true }), appendResult: upload, escapeDriveQueryValue: value => String(value),
  listSessions: jest.fn(), downloadSession: jest.fn(), deleteSession: jest.fn(), postFile: jest.fn(),
}));
const { apiData } = await import("../../../experiment/sessions/api/data-router.js");
const { finalizeSession } = await import("../../../experiment/sessions/finalization/finalize.js");
const base = "experiments/EID/sessions/S1";
const hash = source => createHash("sha256").update(source).digest("hex");
const event = (sequence, response = String(sequence)) => {
  const payload = { response, trial_type: "test" };
  return { eventId: `event-${sequence}`, sequence, payload, payloadHash: hash(JSON.stringify(payload)),
    checkpoint: { completed: response } };
};
const expected = events => ({ expectedEventCount: events.length, expectedLastSequence: events.length - 1,
  eventsHash: hash(JSON.stringify(events.map(({ eventId, payloadHash, sequence }) => ({ eventId, payloadHash, sequence })))) });
async function request(body) {
  const response = makeRes();
  await apiData(makeReq({ body: { experimentID: "EID", sessionId: "S1", ...body } }), response);
  return response;
}
const append = events => request({ action: "appendEvents", data: { protocolVersion: 1, events } });
const complete = events => request({ action: "completeSession", ...expected(events) });
beforeEach(() => {
  store.reset(); upload.mockClear();
  store.records.set("experiments/EID", { active: true, sessions: 1, storageProvider: "osf", owner: "owner", osfUploadLink: "folder" });
  store.records.set(base, { experimentID: "EID", sessionId: "S1", sessionProtocolVersion: 2, eventProtocolVersion: 1,
    participantNumber: 23, condition: 0, lifecycle: "active", trialCount: 0, receivedEventCount: 0, sessionName: "Subject A" });
  store.records.set("experiments/EID/session_metadata/S1", { sessionName: "Subject A" });
});

describe("verified public completion", () => {
  test("confirms an empty session explicitly without creating a fake response file", async () => {
    expect((await complete([])).jsonBody.completion).toMatchObject({ confirmed: true, status: 'empty', expectedEventCount: 0 });
    expect(upload).not.toHaveBeenCalled();
  });
  test("confirms the complete set and provider save, then returns the same receipt on retry", async () => {
    const events = [event(0, "A"), event(1, "B")];
    await append(events);
    const response = await complete(events);
    expect(response.jsonBody).toMatchObject({ success: true, sessionId: "S1", completion: {
      confirmed: true, ...expected(events),
    } });
    expect(upload).toHaveBeenCalledTimes(1);
    const rows = CSV.parse(upload.mock.calls[0][5]);
    expect(rows.slice(1).map(row => row[rows[0].indexOf("response")])).toEqual(["A", "B"]);
    expect(rows.slice(1).map(row => row[rows[0].indexOf("session_state")])).toEqual(["completed", "completed"]);
    expect(store.records.get(base)).toMatchObject({ lifecycle: "completed", participantNumber: 23, condition: 0 });
    expect(store.records.get("experiments/EID").sessions).toBe(1);
    expect(store.records.get("experiments/EID/session_metadata/S1").sessionName).toBe("Subject A");
    expect((await complete(events)).jsonBody.completion).toEqual(response.jsonBody.completion);
    expect(upload).toHaveBeenCalledTimes(1);
  });

  test("rejects closing while the final event has not arrived", async () => {
    const a = event(0), b = event(1);
    await append([a]);
    const response = await complete([a, b]);
    expect(response.statusCode).toBe(409);
    expect(store.records.get(base).lifecycle).toBe("active");
    expect(upload).not.toHaveBeenCalled();
  });

  test("can verify an already exported partial set without sending it twice", async () => {
    const events = [event(0)]; await append(events);
    await finalizeSession("EID", "S1");
    expect((await complete(events)).jsonBody.completion?.confirmed).toBe(true);
    expect(upload).toHaveBeenCalledTimes(1);
  });

  test("rejects a matching count with a different event set or payload hashes", async () => {
    await append([event(0)]);
    expect((await complete([{ ...event(0), eventId: "another-event" }])).statusCode).toBe(409);
    expect((await complete([event(0, "different")])).statusCode).toBe(409);
    expect(upload).not.toHaveBeenCalled();
  });

  test("does not confirm a receipt whose payload is missing and was never exported", async () => {
    const events = [event(0), event(1)]; await append(events);
    store.records.delete(base + '/trials/event-0');
    expect((await complete(events)).statusCode).toBe(409);
    expect(upload).not.toHaveBeenCalled();
  });

  test("does not certify unaccounted legacy rows as part of the expected event set", async () => {
    const events = [event(0)]; await append(events);
    store.records.set(base + '/trials/legacy', { response: 'unaccounted' });
    expect((await complete(events)).statusCode).toBe(409);
    expect(upload).not.toHaveBeenCalled();
  });

  test("keeps OSF pending when an overwrite would discard an earlier partial export", async () => {
    await append([event(0)]); await finalizeSession('EID', 'S1');
    await append([event(1)]);
    expect((await complete([event(0), event(1)])).statusCode).toBe(409);
    expect(upload).toHaveBeenCalledTimes(1);
    expect(store.records.has(base + '/trials/event-1')).toBe(true);
  });

  test("cannot close a set with a hole in its sequences", async () => {
    const events = [event(0), event(2)];
    await append(events);
    const response = await request({ action: "completeSession", ...expected(events), expectedLastSequence: 2 });
    expect(response.statusCode).toBe(409);
    expect(upload).not.toHaveBeenCalled();
  });

  test("only one concurrent closer exports while another observes a pending completion", async () => {
    const events = [event(0)]; await append(events);
    let release, arrived;
    const blocked = new Promise(resolve => { release = resolve; });
    const entered = new Promise(resolve => { arrived = resolve; });
    upload.mockImplementationOnce(async () => { arrived(); await blocked; return { success: true, id: "file" }; });
    const first = complete(events);
    try {
      expect(await Promise.race([entered.then(() => true), first.then(() => false)])).toBe(true);
      const second = await complete(events);
      expect(second.statusCode).toBe(202);
      expect(second.jsonBody.completion.confirmed).toBe(false);
      expect(upload).toHaveBeenCalledTimes(1);
    } finally { release(); await first; }
  });

  test("a provider failure preserves data and allows retrying the same closed session", async () => {
    const events = [event(0)]; await append(events);
    upload.mockResolvedValueOnce({ success: false, errorText: "unavailable" });
    const response = await complete(events);
    expect(response.statusCode).toBe(503);
    expect(store.records.has(base + "/trials/event-0")).toBe(true);
    expect(store.records.get(base).completion.confirmed).toBe(false);
    expect((await complete(events)).jsonBody.completion.confirmed).toBe(true);
    expect(store.records.get("experiments/EID").sessions).toBe(1);
  });

  test("rejects a new response after verified closure but acknowledges an identical retry", async () => {
    const a = event(0); await append([a]); await complete([a]);
    expect((await append([event(1)])).statusCode).toBe(409);
    expect((await append([a])).statusCode).toBe(200);
  });

  test("stores checkpoint and response atomically, with no advancement on failed commit", async () => {
    await append([event(0, "A")]);
    expect(store.records.get(base).resumeCheckpoint).toEqual({ completed: "A" });
    store.failNextCommit(new Error("commit failed"));
    expect((await append([event(1, "B")])).jsonBody.success).toBe(false);
    expect(store.records.get(base).resumeCheckpoint).toEqual({ completed: "A" });
  });

  test("restores loop checkpoints containing nested response arrays through registration", async () => {
    const checkpoint = { completed: "A", cursor: { loops: [{ cycleRows: [{ response: [[1, 2], [3, 4]] }] }] } };
    expect((await append([{ ...event(0), checkpoint }])).statusCode).toBe(201);
    const resumed = await request({});
    expect(resumed.jsonBody.resumeCheckpoint).toEqual(checkpoint);
    expect(resumed.jsonBody.receivedEvents).toEqual([expect.objectContaining({ eventId: 'event-0', sequence: 0 })]);
  });
});
