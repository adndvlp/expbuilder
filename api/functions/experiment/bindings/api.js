import { onRequest } from "firebase-functions/v2/https";
import { requireAuth } from "../../utils/auth.js";
import {
  getOwnedExperiment,
  assertExperimentID,
  sendExperimentAccessError,
} from "../access.js";
import { withExperimentMutation } from "../mutation.js";
import { bindingError, hash, backendProjectId } from "./common.js";
import { bindingFingerprint, deploymentContext } from "./context.js";
import { inspectBindings } from "./review.js";
import { persistBindings, resourceClaims } from "./claims.js";
import { inspectRepair, confirmRepair } from "./repair.js";
import { ensureRepositoryMarker } from "./github.js";

const endpoint = (work) =>
  onRequest({ cors: true, timeoutSeconds: 300 }, async (req, res) => {
    if (req.method === "OPTIONS") return res.status(204).send("");
    if (req.method !== "POST")
      return res.status(405).json({ success: false, message: "Use POST" });
    const uid = await requireAuth(req, res);
    if (!uid) return;
    try {
      assertExperimentID(req.body?.experimentID);
      if (
        req.body?.backendProjectId &&
        req.body.backendProjectId !== backendProjectId()
      )
        throw bindingError(
          "BACKEND_CONTEXT_CHANGED",
          "The selected backend changed. Inspect its destinations again.",
        );
      return res.status(200).json(await work(req.body, uid));
    } catch (error) {
      if (sendExperimentAccessError(res, error)) return;
      console.error("Could not verify publication destinations:", error);
      return res.status(500).json({
        success: false,
        message: "Could not verify publication destinations.",
      });
    }
  });
export const getExperimentDeploymentContext = endpoint(
  async ({ experimentID }, uid) => {
    try {
      const { data } = await getOwnedExperiment(experimentID, uid);
      return deploymentContext(
        { ...data, id: experimentID },
        experimentID,
        uid,
      );
    } catch (error) {
      if (error.code === "EXPERIMENT_NOT_FOUND")
        return deploymentContext(null, experimentID, uid);
      throw error;
    }
  },
);
export const configureExperimentBindings = endpoint(async (body, uid) => {
  const { experimentID, action, selection } = body;
  if (action === "repair-inspect") {
    const { data } = await getOwnedExperiment(experimentID, uid);
    const { preview } = await inspectRepair(
      { ...data, id: experimentID },
      uid,
      body.resource,
      selection,
    );
    return {
      ...deploymentContext({ ...data, id: experimentID }, experimentID, uid),
      preview,
    };
  }
  if (action === "repair-confirm")
    return withExperimentMutation(
      { experimentID, uid, operation: "repair" },
      (mutation) => confirmRepair(mutation, uid, body),
    );
  if (action === "inspect") {
    const { data } = await getOwnedExperiment(experimentID, uid);
    const { preview } = await inspectBindings(
      { ...data, id: experimentID },
      uid,
      selection,
    );
    return {
      ...deploymentContext({ ...data, id: experimentID }, experimentID, uid),
      preview,
    };
  }
  if (action !== "confirm")
    throw bindingError(
      "BINDING_ACTION_INVALID",
      "Inspect and explicitly confirm the existing destinations.",
      400,
    );
  return withExperimentMutation(
    { experimentID, uid, operation: "bind" },
    async (mutation) => {
      const data = { ...mutation.data, id: experimentID };
      const receipt = data.bindingConfirmation;
      if (
        receipt &&
        receipt.fingerprint === body.fingerprint &&
        receipt.contextFingerprint === body.contextFingerprint &&
        receipt.selectionHash === hash(selection || {}) &&
        receipt.resultFingerprint === bindingFingerprint(data)
      )
        return deploymentContext(data, experimentID, uid);
      if (
        !body.contextFingerprint ||
        bindingFingerprint(data) !== body.contextFingerprint
      )
        throw bindingError(
          "BINDING_PREVIEW_STALE",
          "The experiment destinations changed. Inspect them again.",
        );
      const reviewed = await inspectBindings(data, uid, selection);
      if (reviewed.preview.fingerprint !== body.fingerprint)
        throw bindingError(
          "BINDING_PREVIEW_STALE",
          "The account or selected resource changed. Inspect the destinations again.",
        );
      const resources = resourceClaims(
        reviewed.storage.binding,
        reviewed.github?.binding,
      );
      await persistBindings(mutation, {}, resources);
      if (reviewed.github)
        await ensureRepositoryMarker(
          reviewed.githubAccount,
          reviewed.github,
          experimentID,
        );
      const patch = {
        storageProvider: reviewed.storage.binding.provider,
        storageBinding: reviewed.storage.binding,
        ...reviewed.storage.projection,
        ...(reviewed.github && { githubBinding: reviewed.github.binding }),
      };
      await persistBindings(
        mutation,
        {
          ...patch,
          bindingConfirmation: {
            fingerprint: body.fingerprint,
            contextFingerprint: body.contextFingerprint,
            selectionHash: hash(selection || {}),
            resultFingerprint: bindingFingerprint({ ...data, ...patch }),
          },
        },
        resources,
      );
      return deploymentContext(mutation.data, experimentID, uid);
    },
  );
});
