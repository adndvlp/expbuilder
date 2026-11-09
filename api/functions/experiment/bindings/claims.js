import { db } from "../../app.js";
import { assertExperimentOwner } from "../access.js";
import { backendProjectId, bindingError, hash } from "./common.js";

function assertUnchanged(previous, next, fields, code) {
  if (!previous || !next) return;
  if (fields.some((field) => String(previous[field]) !== String(next[field])))
    throw bindingError(
      code,
      "A fixed publication destination cannot be replaced by this operation.",
    );
}
export function resourceClaims(storage, github) {
  return [
    ...(storage
      ? [{ type: storage.provider, resourceId: storage.folderId }]
      : []),
    ...(github ? [{ type: "github", resourceId: github.repositoryId }] : []),
  ];
}
export async function persistBindings(
  mutation,
  patch,
  resources,
  { repairId } = {},
) {
  const projectId = backendProjectId(),
    experimentID = mutation.ref.id,
    uid = mutation.data.owner;
  const claims = resources.map((resource) => ({
    resource,
    ref: db
      .collection("experimentResourceBindings")
      .doc(hash(`${resource.type}:${resource.resourceId}`)),
  }));
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(mutation.ref),
      data = snapshot.data();
    assertExperimentOwner(data, uid);
    if (
      data.mutationLease?.leaseToken !== mutation.leaseToken ||
      data.mutationLease.expiresAt <= Date.now()
    )
      throw bindingError(
        "MUTATION_LEASE_LOST",
        "The experiment mutation permission expired or changed.",
      );
    let history;
    if (repairId) {
      const job = data.destinationRepair;
      if (
        !job ||
        job.id !== repairId ||
        job.status !== "preparing" ||
        patch.destinationRepair?.status !== "completed"
      )
        throw bindingError(
          "REPAIR_IN_PROGRESS",
          "The repair authorization changed.",
        );
      const storage = job.resource === "storage",
        previous = storage ? data.storageBinding : data.githubBinding,
        next = storage ? patch.storageBinding : patch.githubBinding;
      if (
        !next ||
        previous.accountId !== next.accountId ||
        (storage && previous.provider !== next.provider) ||
        (storage ? patch.githubBinding : patch.storageBinding)
      )
        throw bindingError(
          "REPAIR_TARGET_INVALID",
          "Repair cannot change accounts, providers or the other destination.",
        );
      history = {
        ref: mutation.ref.collection("destination_history").doc(repairId),
        data: {
          resource: job.resource,
          previous,
          replacement: next,
          owner: uid,
          projectId,
          experimentID,
          repairedAt: patch.destinationRepair.completedAt,
        },
      };
    } else {
      assertUnchanged(
        data.storageBinding,
        patch.storageBinding,
        ["provider", "accountId", "folderId"],
        "STORAGE_CHANGE_REQUIRES_MIGRATION",
      );
      assertUnchanged(
        data.githubBinding,
        patch.githubBinding,
        ["repositoryId", "accountId", "branch"],
        "GITHUB_BINDING_UNAVAILABLE",
      );
    }
    const existing = await Promise.all(
      claims.map((claim) => transaction.get(claim.ref)),
    );
    existing.forEach((snapshot) => {
      if (snapshot.exists) {
        const claim = snapshot.data();
        if (
          claim.experimentID !== experimentID ||
          claim.projectId !== projectId ||
          claim.owner !== uid
        )
          throw bindingError(
            "RESOURCE_ALREADY_BOUND",
            "This resource is already linked to another experiment.",
          );
      }
    });
    if (history) transaction.create(history.ref, history.data);
    claims.forEach((claim, index) => {
      if (!existing[index].exists)
        transaction.create(claim.ref, {
          ...claim.resource,
          experimentID,
          owner: uid,
          projectId,
          createdAt: new Date().toISOString(),
        });
    });
    if (Object.keys(patch).length) transaction.update(mutation.ref, patch);
  });
  Object.assign(mutation.data, patch);
}
