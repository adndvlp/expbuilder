import { jest } from "@jest/globals";
import { createHash } from "node:crypto";
import { makeTransactionalFirestore } from "../../helpers/transactional-firestore.js";
import { makeReq, makeRes } from "../../helpers/firestore-mock.js";
import CSV from "csv-string";

const store = makeTransactionalFirestore();
const upload = jest.fn(async () => ({ success: true, id: "file", fileUrl: "https://storage.test/file" }));
jest.unstable_mockModule("../../../app.js", () => ({ db: store.db, app: {} }));
jest.unstable_mockModule("firebase-functions/v2/https", () => ({ onRequest: (_options, handler) => handler }));
jest.unstable_mockModule("firebase-admin/firestore", () => ({ FieldValue: {
  increment: value => ({ __op: "increment", value }),
} }));
jest.unstable_mockModule("../../../experiment/sessions/logging/write-log.js", () => ({ default: async () => {} }));
jest.unstable_mockModule("firebase-admin/database", () => ({ getDatabase: () => ({ ref: () => ({
  once: async () => ({ val: () => ({ state: "completed" }) }),
}) }) }));
jest.unstable_mockModule("../../../oauth/index.js", () => ({ getValidToken: async () => ({ success: true, access_token: "token" }) }));
jest.unstable_mockModule("../../../experiment/sessions/storage.js", () => ({
  createSession: async () => ({ success: true }), appendResult: upload, escapeDriveQueryValue: value => String(value),
  listSessions: jest.fn(), downloadSession: jest.fn(), deleteSession: jest.fn(), postFile: jest.fn(),
}));
const { apiData } = await import("../../../experiment/sessions/api/data-router.js");
const { finalizeSession } = await import("../../../experiment/sessions/finalization/finalize.js");

const base = "experiments/EID/sessions/S1";
const hash = source => createHash("sha256").update(source).digest("hex");
const event = (id = "event-a", response = "A", sequence = 0) => ({
  eventId: id, sequence,
  payload: { response, trial_index: sequence, trial_type: "test" },
  payloadHash: hash(JSON.stringify({ response, trial_index: sequence, trial_type: "test" })),
});
async function send(events, sessionId = "S1") {
  const data = { protocolVersion: 1, events };
  const req = makeReq({ body: { action: "appendEvents", experimentID: "EID", sessionId, data } });
  const res = makeRes();
  await apiData(req, res);
  return res;
}
const trialRecords = () => [...store.records.entries()].filter(([key]) => key.startsWith(`${base}/trials/`));
beforeEach(() => {
  store.reset();
  upload.mockClear();
  store.records.set("experiments/EID", { active: true, useValidation: false });
  store.records.set(base, { participantNumber: 23, trialCount: 0 });
});

describe("idempotent public event reception", () => {
  test("rejects a receipt request without data instead of treating it as session creation", async () => {
    const response = makeRes();
    await apiData(makeReq({ body: { action: "appendEvents", experimentID: "EID", sessionId: "S1" } }), response);
    expect(response.statusCode).toBe(400);
    expect(response.jsonBody.success).toBe(false);
    expect(store.records.get(base).participantNumber).toBe(23);
  });

  test("acknowledges the exact persisted identities and hashes", async () => {
    const a = event(), b = event("event-b", "B", 1);
    const res = await send([a, b]);
    expect(res.statusCode).toBe(201);
    expect(res.jsonBody).toMatchObject({ success: true, experimentID: "EID", sessionId: "S1",
      acknowledged: [a, b].map(({ eventId, sequence, payloadHash }) => ({ eventId, sequence, payloadHash })),
    });
    expect(trialRecords()).toHaveLength(2);
    expect(store.records.get(base).trialCount).toBe(2);
  });

  test("an HTTP retry received concurrently does not duplicate a trial or increment its count", async () => {
    const a = event();
    const results = await Promise.all([send([a]), send([a])]);
    expect(results.every(res => res.jsonBody.success)).toBe(true);
    expect(trialRecords()).toHaveLength(1);
    expect(store.records.get(base).trialCount).toBe(1);
    expect(results[0].jsonBody.acknowledged).toEqual(results[1].jsonBody.acknowledged);
  });

  test("recognizes a retry after temporary trial data and its parent were cleaned", async () => {
    const a = event();
    await send([a]);
    for (const [key] of trialRecords()) store.records.delete(key);
    store.records.delete(base);
    const retry = await send([a]);
    expect(retry.statusCode).toBe(200);
    expect(retry.jsonBody.acknowledged).toEqual([{ eventId: a.eventId, sequence: 0, payloadHash: a.payloadHash }]);
    expect(trialRecords()).toHaveLength(0);
    expect(store.records.has(base)).toBe(false);
  });

  test("rejects a changed response under the same identity without replacing the original", async () => {
    await send([event()]);
    const res = await send([event("event-a", "changed")]);
    expect(res.statusCode).toBe(409);
    expect(res.jsonBody.success).toBe(false);
    expect(trialRecords()).toHaveLength(1);
    expect(trialRecords()[0][1].response).toBe("A");
  });

  test("validates hashes and IDs before persisting any event of the request", async () => {
    const a = event(), b = { ...event("event-b", "B", 1), payloadHash: "0".repeat(64) };
    const res = await send([a, b]);
    expect(res.statusCode).toBe(400);
    expect(trialRecords()).toHaveLength(0);
    const invalidId = await send([{ ...a, eventId: "other/session" }]);
    expect(invalidId.statusCode).toBe(400);
  });

  test("returns failure without a receipt when a transaction cannot commit", async () => {
    store.failNextCommit(new Error("simulated commit failure"));
    const res = await send([event()]);
    expect(res.statusCode).toBe(503);
    expect(res.jsonBody.success).toBe(false);
    expect(trialRecords()).toHaveLength(0);
    expect([...store.records.keys()].some(key => key.includes("/event_receipts/"))).toBe(false);
  });

  test("checks required fields inside each event, not just the batch container", async () => {
    store.records.set("experiments/EID", { active: true, useValidation: true, allowJSON: true, requiredFields: ["trial_type"] });
    const payload = { response: "A" };
    const res = await send([{ eventId: "event-a", sequence: 0, payload, payloadHash: hash(JSON.stringify(payload)) }]);
    expect(res.statusCode).toBe(400);
    expect(trialRecords()).toHaveLength(0);
  });

  test("allows distinct legitimate events with identical answers and keeps session receipts isolated", async () => {
    const a = event("event-a");
    await send([a, { ...a, eventId: "event-b", sequence: 1 }]);
    await send([event("event-a")], "S2");
    expect(trialRecords()).toHaveLength(2);
    expect([...store.records.keys()].filter(key => key.includes("/event_receipts/"))).toHaveLength(3);
  });

  test("exports each received event once in sequence order, including a lost-response retry", async () => {
    store.records.set("experiments/EID", { active: true, storageProvider: "osf", owner: "owner", osfUploadLink: "folder" });
    const events = ["A", "B"].map((response, sequence) => {
      const payload = { clientTimestamp: 2 - sequence, response, trial_index: sequence, trial_type: "test" };
      return { eventId: `event-${response}`, sequence, payload, payloadHash: hash(JSON.stringify(payload)) };
    });
    await send(events);
    await send(events);
    await finalizeSession("EID", "S1");
    expect(upload).toHaveBeenCalledTimes(1);
    const rows = CSV.parse(upload.mock.calls[0][5]);
    const column = rows[0].indexOf("response");
    expect(rows.slice(1).map(row => row[column])).toEqual(["A", "B"]);
    expect(trialRecords()).toHaveLength(0);
    expect((await send(events)).statusCode).toBe(200);
    expect(trialRecords()).toHaveLength(0);
    expect(upload).toHaveBeenCalledTimes(1);
  });

  test("preserves deterministic timestamp ordering for sessions that also contain legacy records", async () => {
    store.records.set("experiments/EID", { active: true, storageProvider: "osf", owner: "owner", osfUploadLink: "folder" });
    const events = [200, 50].map((clientTimestamp, sequence) => {
      const payload = { clientTimestamp, response: String(clientTimestamp), trial_index: sequence, trial_type: "test" };
      return { eventId: `event-${sequence}`, sequence, payload, payloadHash: hash(JSON.stringify(payload)) };
    });
    await send(events);
    store.records.set(`${base}/trials/legacy`, { response: "100", clientTimestamp: 100, trial_index: 0 });
    await finalizeSession("EID", "S1");
    const rows = CSV.parse(upload.mock.calls[0][5]);
    expect(rows.slice(1).map(row => row[rows[0].indexOf("response")])).toEqual(["50", "100", "200"]);
  });

  test("cleans only exported event IDs when another acknowledged event arrives during the upload", async () => {
    store.records.set("experiments/EID", { active: true, storageProvider: "osf", owner: "owner", osfUploadLink: "folder" });
    await send([event("event-a")]);
    upload.mockImplementationOnce(async () => {
      const received = await send([event("event-b", "B", 1)]);
      expect(received.jsonBody.success).toBe(true);
      return { success: true, id: "file" };
    });
    await finalizeSession("EID", "S1");
    expect(trialRecords().map(([, data]) => data.response)).toEqual(["B"]);
    expect(store.records.get(base).participantNumber).toBe(23);
    await finalizeSession("EID", "S1");
    expect(trialRecords()).toHaveLength(0);
    expect(upload).toHaveBeenCalledTimes(2);
  });
});
