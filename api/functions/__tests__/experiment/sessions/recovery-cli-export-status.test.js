/**
 * SDD-EXP-OAUTH-001 · FR-07 (1.2.3) · administrative export reactivation.
 * Dry-run by default, explicit --apply, code filters, legacy review gate,
 * transactional validation and audit output without participant data.
 */
import { jest } from "@jest/globals";
import { makeTransactionalFirestore } from "../../helpers/transactional-firestore.js";

const store = makeTransactionalFirestore();
const mockApp = {};

jest.unstable_mockModule("../../../app.js", () => ({ db: store.db, app: mockApp }));
jest.unstable_mockModule("firebase-admin/database", () => ({ getDatabase: () => ({}) }));
jest.unstable_mockModule("firebase-admin/firestore", () => ({ FieldValue: { increment: value => ({ __op: "increment", value }) } }));

const { exportJobsCommand } = await import("../../../experiment/sessions/recovery/export-jobs.js");

function seed() {
  store.reset();
  store.records.set("experiments/EID", { owner: "u1", storageProvider: "googledrive" });
  const sessions = {
    S1: { lastErrorCode: "OAUTH_REAUTH_PENDING" },
    S2: { lastErrorCode: "INTEGRITY_CONFLICT" },
    S3: { lastErrorCode: null },
    S4: { lastErrorCode: "OAUTH_REAUTH_PENDING", deleting: true },
    S5: { lastErrorCode: "OAUTH_REAUTH_PENDING", leaseActive: true },
  };
  for (const [sid, extra] of Object.entries(sessions)) {
    store.records.set(`experiments/EID/sessions/${sid}`, {
      exportRequestedRevision: 1,
      exportConfirmedRevision: 0,
      exportLeaseUntil: extra.leaseActive ? Date.now() + 600_000 : 0,
      deleting: extra.deleting ?? false,
      exportStatus: "needs_attention",
    });
    store.records.set(`experiments/EID/sessions/${sid}/export_jobs/1`, {
      experimentID: "EID",
      sessionId: sid,
      revision: 1,
      status: "needs_attention",
      phase: "preparing",
      attempts: 8,
      dispatchDue: false,
      lastError: "Storage authorization may need to be reconnected",
      lastErrorCode: extra.lastErrorCode,
    });
  }
}

const base = { project: "demo-test" };

describe("exportJobsCommand", () => {
  beforeEach(seed);

  test("export-status lists needs_attention jobs with safe fields", async () => {
    const result = await exportJobsCommand({ ...base, mode: "export-status" });
    expect(result.inspected).toBe(5);
    expect(JSON.stringify(result)).not.toContain("token");
    expect(result.pageToken).toBeNull();
  });

  test("dry-run is the default: reactivate plans but never mutates", async () => {
    const result = await exportJobsCommand({ ...base, mode: "export-reactivate", code: ["OAUTH_REAUTH_PENDING"] });
    expect(result.dryRun).toBe(true);
    expect(result.applied).toBe(false);
    // S1 is eligible; S4 (deleting) and S5 (lease active) are skipped by validation.
    expect(result.planned.map(p => p.id)).toEqual(["EID/S1/1"]);
    expect(result.reactivated).toHaveLength(0);
    expect(store.records.get("experiments/EID/sessions/S1/export_jobs/1").attempts).toBe(8);
  });

  test("apply reactivates only OAuth-coded jobs and resets the attempt budget", async () => {
    const result = await exportJobsCommand({
      ...base, mode: "export-reactivate", code: ["OAUTH_REAUTH_PENDING"], apply: true,
    });
    expect(result.applied).toBe(true);
    expect(result.reactivated.map(r => r.id)).toEqual(["EID/S1/1"]);
    const job = store.records.get("experiments/EID/sessions/S1/export_jobs/1");
    expect(job).toMatchObject({ status: "pending", attempts: 0, dispatchDue: true, lastError: null, lastErrorCode: null });
    expect(store.records.get("experiments/EID/sessions/S1").exportStatus).toBe("pending");
    // Integrity and legacy jobs were never touched.
    expect(store.records.get("experiments/EID/sessions/S2/export_jobs/1").attempts).toBe(8);
    expect(store.records.get("experiments/EID/sessions/S3/export_jobs/1").attempts).toBe(8);
  });

  test("integrity-coded jobs are never reactivated, even with apply", async () => {
    const result = await exportJobsCommand({ ...base, mode: "export-reactivate", apply: true });
    expect(result.skipped.find(s => s.id === "EID/S2/1").reason).toBe("non_oauth_code");
    expect(store.records.get("experiments/EID/sessions/S2/export_jobs/1").attempts).toBe(8);
  });

  test("configuration-coded jobs recover only via explicit --code after fixing the config", async () => {
    store.records.set("experiments/EID/sessions/S7", {
      exportRequestedRevision: 1, exportConfirmedRevision: 0, exportLeaseUntil: 0, deleting: false,
    });
    store.records.set("experiments/EID/sessions/S7/export_jobs/1", {
      experimentID: "EID", sessionId: "S7", revision: 1, status: "needs_attention", phase: "preparing",
      attempts: 1, dispatchDue: false, lastErrorCode: "OAUTH_CONFIGURATION",
    });

    // Sin filtro explícito: no se reactivan (el worker nunca los reintenta solo).
    const without = await exportJobsCommand({ ...base, mode: "export-reactivate", apply: true });
    expect(without.skipped.find(s => s.id === "EID/S7/1").reason).toBe("code_filter");
    expect(store.records.get("experiments/EID/sessions/S7/export_jobs/1").attempts).toBe(1);

    // Con --code explícito tras corregir la configuración: sí.
    const withCode = await exportJobsCommand({ ...base, mode: "export-reactivate", code: ["OAUTH_CONFIGURATION"], apply: true });
    expect(withCode.reactivated.map(r => r.id)).toEqual(["EID/S7/1"]);
    expect(store.records.get("experiments/EID/sessions/S7/export_jobs/1").attempts).toBe(0);
  });

  test("legacy jobs without lastErrorCode require explicit review and targeted selection", async () => {
    // Sin selección específica: rechazo explícito, no reactivación amplia.
    await expect(
      exportJobsCommand({ ...base, mode: "export-reactivate", apply: true, "legacy-unclassified": true }),
    ).rejects.toThrow(/--experiment and --session/);

    const withFlag = await exportJobsCommand({
      ...base, mode: "export-reactivate", apply: true, "legacy-unclassified": true,
      experiment: "EID", session: "S3",
    });
    expect(withFlag.reactivated.map(r => r.id)).toContain("EID/S3/1");
    expect(store.records.get("experiments/EID/sessions/S3/export_jobs/1").attempts).toBe(0);
  });

  test("revision mismatch and deleting sessions are validated transactionally", async () => {
    store.records.set("experiments/EID/sessions/S6", {
      exportRequestedRevision: 2, exportConfirmedRevision: 0, exportLeaseUntil: 0, deleting: false,
    });
    store.records.set("experiments/EID/sessions/S6/export_jobs/2", {
      experimentID: "EID", sessionId: "S6", revision: 2, status: "needs_attention", phase: "preparing",
      attempts: 8, dispatchDue: false, lastErrorCode: "OAUTH_REAUTH_PENDING",
    });
    const result = await exportJobsCommand({ ...base, mode: "export-reactivate", code: ["OAUTH_REAUTH_PENDING"] });
    expect(result.skipped.find(s => s.id === "EID/S6/2").reason).toBe("revision_mismatch");
    expect(store.records.get("experiments/EID/sessions/S6/export_jobs/2").attempts).toBe(8);
  });

  test("emulator guard requires a demo- project", async () => {
    process.env.FIRESTORE_EMULATOR_HOST = "localhost:8080";
    await expect(exportJobsCommand({ ...base, project: "prod-project", mode: "export-status" }))
      .rejects.toThrow(/isolated demo project/);
    delete process.env.FIRESTORE_EMULATOR_HOST;
  });

  test("emulator guard allows an isolated demo- project", async () => {
    process.env.FIRESTORE_EMULATOR_HOST = "localhost:8080";
    const result = await exportJobsCommand({ ...base, project: "demo-test", mode: "export-status" });
    expect(result.inspected).toBeGreaterThan(0);
    delete process.env.FIRESTORE_EMULATOR_HOST;
  });

  test("verifies the effective Firebase project before operating", async () => {
    process.env.GCLOUD_PROJECT = "demo-test";
    mockApp.options = { projectId: "other-project" };
    await expect(exportJobsCommand({ ...base, mode: "export-status" }))
      .rejects.toThrow(/instead of demo-test/);
    delete mockApp.options;
    delete process.env.GCLOUD_PROJECT;
  });
});

describe("recoveryCommand — CLI safety flags", () => {
  test("--apply and --dry-run are mutually exclusive", async () => {
    const { recoveryCommand } = await import("../../../experiment/sessions/recovery/cli.js");
    await expect(
      recoveryCommand(["--project", "demo-test", "--mode", "export-reactivate", "--apply", "--dry-run"]),
    ).rejects.toThrow(/mutually exclusive/);
  });

  test("export-reactivate without --apply stays dry-run through the CLI", async () => {
    const { recoveryCommand } = await import("../../../experiment/sessions/recovery/cli.js");
    const result = await recoveryCommand(["--project", "demo-test", "--mode", "export-reactivate", "--code", "OAUTH_REAUTH_PENDING"]);
    expect(result.applied).toBe(false);
    expect(result.dryRun).toBe(true);
  });
});
