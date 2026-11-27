/**
 * SDD-EXP-OAUTH-001 · T13 cadena completa con servicio OAuth REAL:
 * apiData (eventos) → worker con fallo OAuth transitorio real (HTTP simulado)
 * → reconciler → dispatch (taskQueue doble) → worker con credenciales
 * recuperadas → adaptador REAL de Google Drive sobre HTTP y almacenamiento
 * simulados → confirmación íntegra. Sin Retry saving, sin mocks del servicio
 * de tokens ni del adaptador.
 */
import { jest } from "@jest/globals";
import { createHash } from "node:crypto";
import CSV from "csv-string";
import fetchMock from "../../helpers/fetch-mock.js";
import { makeTransactionalFirestore } from "../../helpers/transactional-firestore.js";
import { makeReq, makeRes } from "../../helpers/firestore-mock.js";

process.env.GOOGLE_DRIVE_CLIENT_ID = "test-google-client";
process.env.GOOGLE_DRIVE_CLIENT_SECRET = "test-google-secret";

const store = makeTransactionalFirestore();
const enqueuedTasks = [];
let realtimeState = { state: "in-progress" };

jest.unstable_mockModule("../../../app.js", () => ({ db: store.db, app: {} }));
jest.unstable_mockModule("firebase-functions/v2/https", () => ({
  onRequest: (_options, handler) => handler,
}));
jest.unstable_mockModule("firebase-admin/firestore", () => ({
  FieldValue: { increment: value => ({ __op: "increment", value }) },
}));
jest.unstable_mockModule("firebase-admin/database", () => ({
  getDatabase: () => ({ ref: () => ({
    once: async () => ({ val: () => realtimeState }),
    update: async () => {},
  }) }),
}));
jest.unstable_mockModule("firebase-admin/functions", () => ({
  getFunctions: () => ({ taskQueue: () => ({ enqueue: async payload => { enqueuedTasks.push(payload); } }) }),
}));
jest.unstable_mockModule("../../../experiment/sessions/logging/write-log.js", () => ({ default: async () => {} }));

const { apiData } = await import("../../../experiment/sessions/api/data-router.js");
const { processSessionExport } = await import("../../../experiment/sessions/export/process.js");
const { reconcileSessionExports } = await import("../../../experiment/sessions/export/dispatch.js");

const hash = value => createHash("sha256").update(value).digest("hex");
function event(sequence, response = String(sequence)) {
  const payload = { response, trial_type: "test" };
  return { eventId: "event-" + sequence, sequence, payload, payloadHash: hash(JSON.stringify(payload)), checkpoint: { completed: response } };
}
function expected(events) {
  return { expectedEventCount: events.length, expectedLastSequence: events.length - 1,
    eventsHash: hash(JSON.stringify(events.map(({ eventId, payloadHash, sequence }) => ({ eventId, payloadHash, sequence })))) };
}
async function request(body) {
  const response = makeRes();
  await apiData(makeReq({ body: { experimentID: "EID", sessionId: "S1", ...body } }), response);
  return response;
}

const base = "experiments/EID/sessions/S1";
const job = () => store.records.get(`${base}/export_jobs/1`);

beforeEach(() => {
  store.reset();
  fetchMock.__reset();
  enqueuedTasks.length = 0;

  store.records.set("experiments/EID", {
    active: true, sessions: 1, storageProvider: "googledrive", owner: "u1", driveFolderId: "folder",
  });
  store.records.set("users/u1", {
    googleDriveTokens: { access_token: "old-at", refresh_token: "rf-old", expires_at: Date.now() - 1000 },
  });
  store.records.set(base, {
    experimentID: "EID", sessionId: "S1", participantNumber: 23, condition: 0, createdAt: "2026-11-05T00:00:00Z",
    sessionProtocolVersion: 2, eventProtocolVersion: 1, lifecycle: "active", trialCount: 0, receivedEventCount: 0,
    metadata: { browser: "Chrome" }, sessionName: "Subject A",
  });
  store.records.set("experiments/EID/session_metadata/S1", { sessionName: "Subject A" });
});

function driveRouter(state) {
  return async (url, options = {}) => {
    const u = String(url);
    const resp = (status, body, etag = null) => ({ status, body, ...(etag ? { headers: { etag } } : {}) });
    if (u.includes("oauth2.googleapis.com/token")) {
      if (state.tokenFails) return resp(503, null);
      return resp(200, { access_token: "at-new", refresh_token: "rf-rotated", expires_in: 3600 });
    }
    if (u.includes("/drive/v3/files/generateIds")) return resp(200, { ids: ["stable-file"] });
    if (u.includes("/drive/v3/files?q=")) return resp(200, { files: [] });
    if (u.includes("/upload/drive/v3/files?uploadType=multipart")) {
      state.uploads += 1;
      const body = String(options.body ?? "");
      const marker = "Content-Type: text/csv\r\n\r\n";
      const start = body.indexOf(marker);
      const end = body.lastIndexOf("\r\n--");
      state.csv = start >= 0 && end > start ? body.slice(start + marker.length, end) : state.csv;
      state.version += 1;
      return resp(200, { id: "stable-file" });
    }
    if (u.includes("/drive/v3/files/stable-file?fields=")) {
      if (state.csv === null) return resp(404, {});
      return resp(200, { id: "stable-file", name: "EID_S1.csv", version: String(state.version), trashed: false }, "etag-1");
    }
    if (u.includes("/drive/v3/files/stable-file?alt=media")) {
      if (state.csv === null) return resp(404, {});
      return resp(200, state.csv);
    }
    return resp(404, {});
  };
}

test("T13 integrado: servicio OAuth real, clasificación, reconciler, worker y adaptador Drive real — recuperación sin Retry saving", async () => {
  const drive = { csv: null, uploads: 0, version: 1, tokenFails: true };
  fetchMock.__setRouter(driveRouter(drive));

  const events = [event(0, "A"), event(1, "B")];
  const appended = await request({ action: "appendEvents", data: { protocolVersion: 1, events } });
  expect(appended.statusCode).toBe(201);
  const closed = await request({ action: "completeSession", ...expected(events) });
  expect(closed.statusCode).toBe(202);

  // Primer intento: el servicio OAuth real clasifica el 503 como temporal.
  await expect(
    processSessionExport({ experimentID: "EID", sessionId: "S1", revision: 1 }, { now: () => Date.now() }),
  ).rejects.toThrow("Storage credentials temporarily unavailable");
  expect(job()).toMatchObject({ status: "retry_wait", dispatchDue: true, lastErrorCode: "OAUTH_TEMPORARY" });

  // Credenciales restauradas y tiempo avanzado: el reconciliador redespacha.
  drive.tokenFails = false;
  store.records.set(`${base}/export_jobs/1`, { ...job(), nextDispatchAt: Date.now() - 1000 });
  await reconcileSessionExports(Date.now());
  expect(enqueuedTasks).toHaveLength(1);
  expect(enqueuedTasks[0]).toMatchObject({ experimentID: "EID", sessionId: "S1", revision: 1 });

  // Doble del handler de tarea: worker con el servicio OAuth real recuperado
  // y el adaptador Drive real sobre HTTP simulado.
  const result = await processSessionExport(enqueuedTasks[0], { now: () => Date.now() });
  expect(result.status).toBe("confirmed");

  // El refresh real persistió el refresh token rotado vía CAS.
  const tokens = store.records.get("users/u1").googleDriveTokens;
  expect(tokens.access_token).toBe("at-new");
  expect(tokens.refresh_token).toBe("rf-rotated");

  // CSV íntegro, exactamente una vez; una sola escritura remota.
  const table = CSV.parse(drive.csv);
  const rows = table.slice(1).map(row => Object.fromEntries(table[0].map((key, i) => [key, row[i]])));
  expect(rows.map(row => row.response)).toEqual(["A", "B"]);
  expect(drive.uploads).toBe(1);

  // Hashes y receipts corresponden; limpieza solo tras la confirmación.
  const session = store.records.get(base);
  expect(session.exportReceipt).toMatchObject({ revision: 1, eventCount: 2 });
  expect(session.exportReceipt.csvHash).toBe(job().intent.csvHash);
  expect(job()).toMatchObject({ status: "confirmed", lastErrorCode: null });
  expect(store.records.has(`${base}/trials/event-0`)).toBe(false);
  expect(store.records.has(`${base}/trials/event-1`)).toBe(false);
});
