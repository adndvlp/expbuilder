import { app, db } from "../../../app.js";
import { sessionReference } from "../export/references.js";
import { evaluateExportJobForReactivation, reactivateExportJob } from "../export/status.js";

// Códigos recuperables administrativamente tras verificación explícita del
// operador. Los códigos de CONFIGURACIÓN solo pueden reactivarse mediante
// --code explícito después de corregir la configuración; nunca se reintentan
// automáticamente en el worker. Los errores de integridad no están aquí.
const RECOVERABLE_CODES = new Set([
  "OAUTH_REAUTH_PENDING",
  "OAUTH_TEMPORARY",
  "OAUTH_INVALID_RESPONSE",
  "OAUTH_UNKNOWN",
  "OAUTH_CONFIGURATION",
  "TOKEN_STORE_TEMPORARY",
  "TOKEN_STORE_UNKNOWN",
  "TOKEN_STORE_CONFIGURATION",
]);

const CONFIGURATION_CODES = new Set(["OAUTH_CONFIGURATION", "TOKEN_STORE_CONFIGURATION"]);

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

/**
 * Administrative inspection/reactivation of `needs_attention` export jobs.
 * Dry-run by default; `--apply` is explicit. Only OAuth-family lastErrorCode
 * jobs are reactivated; integrity-blocked jobs are never touched. Legacy jobs
 * without `lastErrorCode` require `--legacy-unclassified` after manual review.
 */
export async function exportJobsCommand(options) {
  const project = options.project;

  // Verificación del proyecto efectivo: la configuración se fija en cli.js
  // antes de importar app.js; aquí se comprueba que Firebase quedó inicializado
  // con el proyecto solicitado.
  if (process.env.GCLOUD_PROJECT && process.env.GCLOUD_PROJECT !== project) {
    throw new Error(`Firebase initialized with project ${process.env.GCLOUD_PROJECT} instead of ${project}`);
  }
  if (app?.options?.projectId && app.options.projectId !== project) {
    throw new Error(`Firebase initialized with project ${app.options.projectId} instead of ${project}`);
  }

  if (
    (process.env.FIRESTORE_EMULATOR_HOST || process.env.FIREBASE_DATABASE_EMULATOR_HOST) &&
    !project.startsWith("demo-")
  ) {
    throw new Error("Emulator export-jobs requires an isolated demo project");
  }

  const mode = options.mode;
  const applied = mode === "export-reactivate" && options.apply === true;
  const dryRun = !applied;
  const codes = Array.isArray(options.code) && options.code.length
    ? options.code
    : null;
  const limit = Math.min(
    Number.isFinite(Number(options.limit)) ? Number(options.limit) : DEFAULT_LIMIT,
    MAX_LIMIT,
  );

  // Reactivaciones legacy (sin lastErrorCode) exigen selección específica y
  // revisión explícita: nunca reactivación amplia de trabajos históricos.
  if (
    mode === "export-reactivate" &&
    options["legacy-unclassified"] &&
    (!options.experiment || !options.session)
  ) {
    throw new Error("--legacy-unclassified requires --experiment and --session for targeted review");
  }

  let query = db
    .collectionGroup("export_jobs")
    .where("status", "==", "needs_attention");
  if (options.experiment) query = query.where("experimentID", "==", options.experiment);
  if (options.session) query = query.where("sessionId", "==", options.session);
  if (codes) query = query.where("lastErrorCode", "in", codes);
  query = query.orderBy("__name__").limit(limit);
  if (options["page-token"]) {
    const lastPath = String(options["page-token"]);
    if (lastPath) {
      const lastSnap = await db.doc(lastPath).get();
      query = query.startAfter(lastSnap);
    }
  }

  let snapshot;
  try {
    snapshot = await query.get();
  } catch (error) {
    if (String(error?.message || "").toLowerCase().includes("index")) {
      throw new Error(
        "Firestore index required for this query: collectionGroup 'export_jobs' with status (asc), lastErrorCode (asc) [and __name__ ordering]. Create the composite index or retry without --code.",
      );
    }
    throw error;
  }

  const inspected = [];
  const skipped = [];
  const planned = [];
  const reactivated = [];
  const errors = [];

  for (const doc of snapshot.docs || []) {
    const jobData = doc.data();
    const identity = `${jobData.experimentID}/${jobData.sessionId}/${jobData.revision ?? doc.id}`;
    inspected.push(identity);

    const legacy = jobData.lastErrorCode == null;
    const oauthEligible = !legacy && RECOVERABLE_CODES.has(jobData.lastErrorCode);
    if (!legacy && !oauthEligible) {
      skipped.push({ id: identity, reason: "non_oauth_code" });
      continue;
    }
    // Los códigos de CONFIGURACIÓN solo se reactivan con --code explícito,
    // después de corregir la configuración. Nunca de forma amplia.
    if (
      !legacy &&
      CONFIGURATION_CODES.has(jobData.lastErrorCode) &&
      (!codes || !codes.includes(jobData.lastErrorCode))
    ) {
      skipped.push({ id: identity, reason: "code_filter" });
      continue;
    }
    if (legacy && !options["legacy-unclassified"]) {
      skipped.push({ id: identity, reason: "legacy_unclassified_review_required" });
      continue;
    }

    const ref = sessionReference(jobData.experimentID, jobData.sessionId);

    if (dryRun) {
      try {
        const verdict = await db.runTransaction(async (transaction) => {
          const session = await transaction.get(ref);
          const experiment = await transaction.get(
            db.collection("experiments").doc(jobData.experimentID),
          );
          const revision = Math.min(
            session.data()?.exportRequestedRevision || 0,
            (session.data()?.exportConfirmedRevision || 0) + 1,
          );
          if (revision !== jobData.revision) return { ok: false, reason: "revision_mismatch" };
          return evaluateExportJobForReactivation(
            session.data(),
            jobData,
            experiment.exists ? experiment.data() : null,
            { expectedCodes: [jobData.lastErrorCode] },
          );
        });
        if (verdict.ok) planned.push({ id: identity });
        else skipped.push({ id: identity, reason: verdict.reason });
      } catch (error) {
        errors.push({ id: identity, error: error.message });
      }
      continue;
    }

    try {
      const result = await reactivateExportJob(ref, {
        expectedCodes: [jobData.lastErrorCode],
        expectedRevision: jobData.revision,
      });
      if (result.ok) reactivated.push({ id: identity, revision: result.revision, status: result.status });
      else skipped.push({ id: identity, reason: result.reason });
    } catch (error) {
      errors.push({ id: identity, error: error.message });
    }
  }

  const pageToken =
    snapshot.docs && snapshot.docs.length === limit && snapshot.docs.length > 0
      ? snapshot.docs[snapshot.docs.length - 1].ref.path
      : null;

  return {
    generatedAt: new Date().toISOString(),
    project,
    mode,
    applied,
    dryRun,
    inspected: inspected.length,
    planned,
    reactivated,
    skipped,
    errors,
    ...(pageToken && { pageToken }),
    pageToken: pageToken || null,
  };
}
