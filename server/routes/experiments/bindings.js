import { Router } from "express";
import {
  withDbRead,
  withDbMutation,
} from "../../modules/session-persistence/dbQueue.js";
import {
  resolveFirebaseFunctionsUrl,
  resolveFirebaseProjectId,
} from "../../utils/firebaseUrl.js";

const router = Router();
const failure = (code, status, message) =>
  Object.assign(new Error(message), { code, status });
const localExperiment = (data, id) => {
  const experiment = data.experiments.find(
    (value) => value.experimentID === id,
  );
  if (!experiment)
    throw failure("EXPERIMENT_NOT_FOUND", 404, "Local experiment not found.");
  return experiment;
};
async function proxy(req, remoteName, fields) {
  const id = req.params.experimentID,
    authorization = req.get("authorization");
  if (!/^Bearer\s+\S+$/i.test(authorization || ""))
    throw failure(
      "AUTH_REQUIRED",
      401,
      "Sign in before verifying publication destinations.",
    );
  await withDbRead((data) => localExperiment(data, id));
  const base = resolveFirebaseFunctionsUrl(),
    projectId = resolveFirebaseProjectId();
  if (!base || !projectId)
    throw failure(
      "BACKEND_UNAVAILABLE",
      503,
      "Select a backend before verifying publication destinations.",
    );
  if (req.body?.backendProjectId && req.body.backendProjectId !== projectId)
    throw failure(
      "BACKEND_CONTEXT_CHANGED",
      409,
      "The backend changed. Verify the destinations again.",
    );
  const response = await fetch(`${base}/${remoteName}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: authorization,
    },
    body: JSON.stringify({
      experimentID: id,
      ...fields,
      backendProjectId: projectId,
    }),
    signal: AbortSignal.timeout(
      remoteName === "getExperimentDeploymentContext" ? 30_000 : 310_000,
    ),
  });
  let body;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  if (!response.ok) {
    if (response.status === 404 && !body?.code)
      throw failure(
        "BACKEND_UPGRADE_REQUIRED",
        426,
        "Update or deploy the backend destination endpoints before publishing with this app.",
      );
    throw failure(
      body?.code || "BACKEND_UNAVAILABLE",
      response.status || 502,
      body?.message || "Could not verify the remote publication destinations.",
    );
  }
  if (
    !body?.success ||
    body.projectId !== projectId ||
    body.experimentID !== id ||
    typeof body.verifiedOwnerUid !== "string" ||
    !body.verifiedOwnerUid
  )
    throw failure(
      "CLOUD_BINDING_MISMATCH",
      409,
      "The returned project, owner or experiment identity could not be verified.",
    );
  if (
    resolveFirebaseFunctionsUrl() !== base ||
    resolveFirebaseProjectId() !== projectId
  )
    throw failure(
      "BACKEND_CONTEXT_CHANGED",
      409,
      "The selected backend changed. Verify the destinations again.",
    );
  if (body.exists)
    await withDbMutation((data) => {
      const experiment = localExperiment(data, id);
      experiment.cloudBinding = {
        projectId,
        experimentID: id,
        verifiedOwnerUid: body.verifiedOwnerUid,
        verifiedAt: new Date().toISOString(),
      };
      if (body.storage?.state === "bound") {
        experiment.storage = body.storage.provider;
        experiment.storageBinding = body.storage.binding;
      } else delete experiment.storageBinding;
      if (body.github?.state === "bound")
        experiment.githubBinding = body.github.binding;
      else delete experiment.githubBinding;
    });
  if (body.repairResult?.urlMayChange)
    await withDbMutation((data) => {
      delete localExperiment(data, id).pagesUrl;
    });
  return body;
}
const handler = (work) => async (req, res) => {
  try {
    res.json(await work(req));
  } catch (error) {
    res.status(error.status || 503).json({
      success: false,
      code: error.code || "BACKEND_UNAVAILABLE",
      message: error.status
        ? error.message
        : "The backend could not be reached. Verify the destinations and retry.",
    });
  }
};
router.get(
  "/api/deployment-context/:experimentID",
  handler((req) => proxy(req, "getExperimentDeploymentContext", {})),
);
router.post(
  "/api/deployment-bindings/:experimentID/inspect",
  handler((req) =>
    proxy(req, "configureExperimentBindings", {
      action: "inspect",
      selection: req.body.selection,
    }),
  ),
);
router.post(
  "/api/deployment-bindings/:experimentID/confirm",
  handler((req) =>
    proxy(req, "configureExperimentBindings", {
      action: "confirm",
      selection: req.body.selection,
      contextFingerprint: req.body.contextFingerprint,
      fingerprint: req.body.fingerprint,
    }),
  ),
);
for (const action of ["inspect", "confirm"])
  router.post(
    `/api/deployment-bindings/:experimentID/repair/${action}`,
    handler((req) =>
      proxy(req, "configureExperimentBindings", {
        action: `repair-${action}`,
        resource: req.body.resource,
        selection: req.body.selection,
        contextFingerprint: req.body.contextFingerprint,
        fingerprint: req.body.fingerprint,
        confirmReplacement: req.body.confirmReplacement,
        acknowledgeDataLoss: req.body.acknowledgeDataLoss,
      }),
    ),
  );
export default router;
