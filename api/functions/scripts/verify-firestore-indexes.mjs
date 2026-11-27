/**
 * SDD-EXP-OAUTH-001 · FR-07 · verificación contra el Firestore Emulator REAL.
 *
 * Uso (desde api/):
 *   firebase emulators:exec --only firestore --project demo-oauth-1 \
 *     "node --require ./functions/scripts/node26-slowbuffer-shim.cjs functions/scripts/verify-firestore-indexes.mjs"
 *
 * Requiere FIRESTORE_EMULATOR_HOST (lo define emulators:exec). Ejecuta las
 * mismas consultas de la CLI administrativa (collectionGroup export_jobs con
 * filtros status/lastErrorCode/experimentID/sessionID y paginación) contra el
 * emulador, usando los índices de api/firestore.indexes.json. Sin jest, sin
 * mocks: firebase-admin real. Sale con código 1 ante cualquier fallo.
 */

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  console.error("FIRESTORE_EMULATOR_HOST no está definido; ejecuta dentro de firebase emulators:exec.");
  process.exit(1);
}

const PROJECT = "demo-oauth-1";
process.env.GCLOUD_PROJECT = PROJECT;
process.env.FIREBASE_CONFIG = JSON.stringify({ projectId: PROJECT });

const { initializeApp, getApps, deleteApp } = await import("firebase-admin/app");
const { getFirestore } = await import("firebase-admin/firestore");
const { exportJobsCommand } = await import("../experiment/sessions/recovery/export-jobs.js");

if (!getApps().length) initializeApp({ projectId: PROJECT });
const db = getFirestore();

const summary = { checks: [] };
function check(name, condition, detail = "") {
  summary.checks.push({ name, ok: Boolean(condition), detail });
  console.log(`${condition ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
}

try {
  const batch = db.batch();
  batch.set(db.collection("experiments").doc("EID"), { owner: "u1" });
  for (const [sid, code] of Object.entries({
    S1: "OAUTH_REAUTH_PENDING",
    S2: "INTEGRITY_CONFLICT",
    S3: null,
  })) {
    batch.set(db.collection("experiments").doc("EID").collection("sessions").doc(sid), {
      exportRequestedRevision: 1, exportConfirmedRevision: 0, exportLeaseUntil: 0, deleting: false,
    });
    batch.set(
      db.collection("experiments").doc("EID").collection("sessions").doc(sid).collection("export_jobs").doc("1"),
      { experimentID: "EID", sessionId: sid, revision: 1, status: "needs_attention", phase: "preparing",
        attempts: 1, dispatchDue: false, lastErrorCode: code },
    );
  }
  await batch.commit();

  const all = await exportJobsCommand({ project: PROJECT, mode: "export-status" });
  check("export-status sin filtro lista todos los jobs", all.inspected === 3, `inspected=${all.inspected}`);

  const byCode = await exportJobsCommand({ project: PROJECT, mode: "export-status", code: ["OAUTH_REAUTH_PENDING"] });
  check("filtro --code usa el índice compuesto status+lastErrorCode", byCode.inspected === 1, `inspected=${byCode.inspected}`);

  const combo = await exportJobsCommand({
    project: PROJECT, mode: "export-reactivate",
    code: ["OAUTH_REAUTH_PENDING"], experiment: "EID", session: "S1",
  });
  check(
    "filtro combinado --code --experiment --session resuelve y queda en dry-run",
    combo.dryRun === true && combo.planned.map(p => p.id).join(",") === "EID/S1/1",
    JSON.stringify(combo.planned),
  );
} finally {
  const sessions = await db.collection("experiments").doc("EID").collection("sessions").listDocuments();
  for (const doc of sessions) {
    const jobs = await doc.collection("export_jobs").listDocuments();
    for (const job of jobs) await job.delete();
    await doc.delete();
  }
  await db.collection("experiments").doc("EID").delete();
  for (const app of getApps()) await deleteApp(app);
}

const failed = summary.checks.some(c => !c.ok);
if (failed) process.exit(1);
console.log("verify-firestore-indexes: OK");
